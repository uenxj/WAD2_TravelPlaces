// Suggested places to visit for a destination (country, region or city).
//   1) Nominatim (OpenStreetMap) turns the destination name into a location: centre point, bounding box and,
//      for "City, Country" input, the city's boundary. No key needed.
//   2) OpenTripMap lists tourist attractions: inside the box for countries/regions, or within a radius of the
//      centre for cities. Needs OPENTRIPMAP_KEY.
//   3) For cities and regions, places outside the real boundary are dropped, so "Kyoto, Japan" only shows Kyoto.
// Results are cached in memory so repeat lookups do not use up the daily quota.

const cache = new Map(); // normalised destination -> { area, places }
const OUTDOOR_KINDS = [
  'natural',
  'gardens_and_parks',
  'beaches',
  'nature_reserves',
  'urban_environment',
  'view_points',
];

// Nominatim "place_rank": 4 = country, ~8 = state/prefecture, 16+ = city/town. Above 8 we treat it as a city.
const CITY_RANK = 8;
const MIN_RADIUS_M = 3000;
const MAX_RADIUS_M = 25000;

class PlacesError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// "São Paulo" and "Sao Paulo" should match each other
const norm = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// ---- point-in-polygon (GeoJSON coordinates are [lng, lat]) ----
function inRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inPolygon(lng, lat, rings) {
  return inRing(lng, lat, rings[0]) && !rings.slice(1).some((hole) => inRing(lng, lat, hole));
}
function insideGeometry(lng, lat, geometry) {
  if (!geometry) return true;
  if (geometry.type === 'Polygon') return inPolygon(lng, lat, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some((poly) => inPolygon(lng, lat, poly));
  return true; // a single point or line cannot be used to filter
}

// Half the box's diagonal, kept between 3 km and 25 km, so a prefecture with remote islands does not give a huge circle.
function searchRadius([south, north, west, east]) {
  const dy = (north - south) * 111000;
  const dx = (east - west) * 111000 * Math.cos((((north + south) / 2) * Math.PI) / 180);
  return Math.round(Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Math.hypot(dx, dy) / 2)));
}

// Turn "Kyoto, Japan", "Japan, Kyoto", "Kyoto" or "Japan" into a location.
// With a country added, the city/town is searched first so "Kyoto" means the city, not the whole prefecture.
// A single name is searched as typed and Nominatim picks the best-known place with that name ("Paris" -> France).
async function geocode(parts) {
  const typed = parts.join(', ');
  const attempts =
    parts.length > 1
      ? [
          { q: typed, settlement: true },
          { q: [...parts].reverse().join(', '), settlement: true },
          { q: typed, settlement: false },
        ]
      : [{ q: typed, settlement: false }];
  const delayMs = Number(process.env.NOMINATIM_DELAY_MS ?? 1100); // Nominatim allows 1 request/second

  for (let i = 0; i < attempts.length; i++) {
    if (i > 0) await sleep(delayMs);
    const { q, settlement } = attempts[i];
    const url =
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=5&accept-language=en&namedetails=1` +
      '&polygon_geojson=1&polygon_threshold=0.005' + // the outline, used to keep only places inside the city/region
      (settlement ? '&featuretype=settlement' : '');
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GoingSomewhere/1.0 (IS216 student project)', 'Accept-Language': 'en' },
    });
    if (!res.ok) throw new PlacesError(`Could not look up that destination (${res.status}).`, 502);
    const results = await res.json();

    // Only accept a match that mentions every part the user typed (so "Kyoto, Japan" cannot match somewhere else).
    // Compare against the English display name and every known name variant, ignoring accents and case.
    const matches = results.filter((r) => {
      const haystack = norm([r.display_name, ...Object.values(r.namedetails || {})].join(' | '));
      return parts.every((p) => haystack.includes(norm(p)));
    });
    if (matches.length) {
      // Prefer real areas (cities, regions, countries) over e.g. a "Tokyo Station" that shares the name, then the most important
      const isArea = (r) => (r.category === 'boundary' || r.category === 'place' ? 1 : 0);
      const best = matches.sort((a, b) => isArea(b) - isArea(a) || (b.importance || 0) - (a.importance || 0))[0];
      const names = best.display_name.split(', ');
      const [south, north, west, east] = best.boundingbox.map(Number);
      const lat = Number(best.lat);
      const lng = Number(best.lon);
      return {
        area: names.length > 2 ? `${names[0]}, ${names[names.length - 1]}` : best.display_name,
        box: [south, north, west, east],
        center:
          Number.isFinite(lat) && Number.isFinite(lng)
            ? { lat, lng }
            : { lat: (south + north) / 2, lng: (west + east) / 2 },
        rank: Number(best.place_rank),
        geometry: best.geojson || null,
      };
    }
  }
  throw new PlacesError('Destination not found. Check the spelling, or add the country, e.g. "Kyoto, Japan".', 404);
}

function clearPlacesCache() {
  cache.clear();
}

async function getTopPlaces(destination, { limit = 50 } = {}) {
  const parts = String(destination || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) throw new PlacesError('A destination is required.', 400);
  const key = parts.join(', ').toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const apiKey = process.env.OPENTRIPMAP_KEY;
  if (!apiKey) {
    throw new PlacesError(
      'Place suggestions are not set up yet. Add OPENTRIPMAP_KEY to server/.env and restart the server.',
      503,
    );
  }

  // 1) Destination -> location
  const { area, box, center, rank, geometry } = await geocode(parts);
  const [south, north, west, east] = box;

  // 2) Attractions: a circle around the centre for cities, the bounding box for countries and regions
  const params = new URLSearchParams({
    kinds: 'interesting_places',
    rate: '2', // minimum popularity: 1-3 (add "h" for heritage sites)
    format: 'json',
    limit: '500',
    apikey: apiKey,
  });
  let endpoint = 'bbox';
  if (rank > CITY_RANK) {
    endpoint = 'radius';
    params.set('radius', String(searchRadius(box)));
    params.set('lon', String(center.lng));
    params.set('lat', String(center.lat));
  } else {
    params.set('lon_min', String(west));
    params.set('lon_max', String(east));
    params.set('lat_min', String(south));
    params.set('lat_max', String(north));
  }
  const otmRes = await fetch(`https://api.opentripmap.com/0.1/en/places/${endpoint}?${params}`);
  if (otmRes.status === 429) throw new PlacesError('Too many place lookups right now. Try again in a minute.', 429);
  if (!otmRes.ok) throw new PlacesError(`OpenTripMap error (${otmRes.status}).`, 502);
  let raw = await otmRes.json();

  // 3) Keep only places inside the city's (or region's) real boundary. If that would leave nothing, keep them all.
  if (geometry) {
    const inside = raw.filter((p) => p.point && insideGeometry(p.point.lon, p.point.lat, geometry));
    if (inside.length) raw = inside;
  }

  // 4) Best-rated first, unnamed places dropped, de-duplicated by name
  const seen = new Set();
  const top = raw
    .filter((p) => p.name && p.point)
    .sort((a, b) => b.rate - a.rate)
    .filter((p) => {
      const n = p.name.toLowerCase();
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    })
    .slice(0, limit)
    .map((p) => {
      const kinds = String(p.kinds || '')
        .split(',')
        .filter(Boolean);
      return {
        id: p.xid,
        name: p.name,
        rate: p.rate,
        kinds: kinds.slice(0, 3).map((k) => k.replace(/_/g, ' ')),
        setting: kinds.some((k) => OUTDOOR_KINDS.includes(k)) ? 'outdoor' : 'indoor', // a guess from the place type; the user can change it
        lat: p.point.lat,
        lng: p.point.lon,
      };
    });

  const result = { area, places: top };
  cache.set(key, result);
  return result;
}

module.exports = { PlacesError, insideGeometry, clearPlacesCache, getTopPlaces };
