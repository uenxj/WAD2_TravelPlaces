// Turns text into coordinates with Nominatim (OpenStreetMap). No API key needed.
//   resolveDestination("New York City")        -> { center: { lat, lng }, timezone: 'America/New_York' }
//   geocodeAddress("Marina Gardens Dr", trip)  -> { lat, lng } | null
// Every function fails softly (null / empty), so a lookup problem never blocks saving a trip or an activity.
// Set GEOCODE_DISABLED=true to turn all lookups off (the API tests do this to stay offline).
const { timezoneFor } = require('./itineraryLogic');

const cache = new Map(); // request -> Nominatim rows (only successful responses are cached)
let nextSlot = 0;

function clearGeocodeCache() {
  cache.clear();
  nextSlot = 0;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Nominatim allows about 1 request per second
async function throttle() {
  const gap = Number(process.env.NOMINATIM_DELAY_MS ?? 1100);
  const start = Math.max(Date.now(), nextSlot);
  nextSlot = start + gap;
  if (start > Date.now()) await sleep(start - Date.now());
}

async function lookup(params) {
  if (process.env.GEOCODE_DISABLED === 'true') return null;
  const key = params.toString();
  if (cache.has(key)) return cache.get(key);
  await throttle();
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${key}`, {
      headers: { 'User-Agent': 'GoingSomewhere/1.0 (IS216 student project)', 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    cache.set(key, rows);
    return rows;
  } catch {
    return null;
  }
}

const toPoint = (row) => {
  const lat = Number(row?.lat);
  const lng = Number(row?.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

// A trip's destination -> its centre point and timezone (both saved on the trip)
async function resolveDestination(destination) {
  const q = String(destination || '').trim();
  if (!q) return { center: null, timezone: '' };
  const rows = await lookup(new URLSearchParams({ q, format: 'jsonv2', limit: '1', 'accept-language': 'en' }));
  const center = toPoint(rows?.[0]);
  return { center, timezone: center ? timezoneFor(center.lat, center.lng) || '' : '' };
}

// An activity's address -> coordinates. The destination is added to the search so "Marina Gardens Dr"
// is looked for in Singapore, and the trip's centre point is used as a (soft) hint.
async function geocodeAddress(address, trip = {}) {
  const text = String(address || '').trim();
  if (!text) return null;
  const params = new URLSearchParams({
    q: trip.destination ? `${text}, ${trip.destination}` : text,
    format: 'jsonv2',
    limit: '1',
    'accept-language': 'en',
  });
  const c = trip.center;
  if (c && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng))) {
    const d = 0.5; // about 50 km each way; a preference, not a hard limit
    params.set('viewbox', `${c.lng - d},${c.lat + d},${c.lng + d},${c.lat - d}`);
  }
  const rows = await lookup(params);
  return toPoint(rows?.[0]);
}

module.exports = { clearGeocodeCache, resolveDestination, geocodeAddress };
