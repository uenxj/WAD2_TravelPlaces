// Turns text into coordinates with Nominatim, with Open-Meteo as a destination backup. No API key needed.
//   resolveDestination("New York City")        -> { center: { lat, lng }, timezone: 'America/New_York' }
//   geocodeAddress("Marina Gardens Dr", trip)  -> { lat, lng } | null
// Every function fails softly (null / empty), so a lookup problem never blocks saving a trip or an activity.
// Set GEOCODE_DISABLED=true to turn all lookups off (the API tests do this to stay offline).
const { timezoneFor } = require('./itineraryLogic');

const cache = new Map(); // Nominatim rows / backup destination results; empty or failed lookups are not cached
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
    if (!Array.isArray(rows)) return null;
    if (rows.length) cache.set(key, rows);
    return rows;
  } catch {
    return null;
  }
}

const toPoint = (row) => {
  const lat = row?.lat == null || row.lat === '' ? NaN : Number(row.lat);
  const lng = row?.lon == null || row.lon === '' ? NaN : Number(row.lon);
  return Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180 ? { lat, lng } : null;
};

const emptyDestination = () => ({ center: null, timezone: '', destinationScope: '' });
const norm = (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const validTimezone = (value) => {
  if (typeof value !== 'string' || !value) return '';
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return value; } catch { return ''; }
};

// A selected search result already carries its location. Reject stale/malformed
// selections rather than attaching yesterday's coordinates to newly typed text.
function destinationFromSelection(selection, destination) {
  if (!selection || typeof selection !== 'object' || typeof selection.label !== 'string' || selection.label.trim() !== String(destination || '').trim()) return null;
  const center = toPoint({ lat: selection.latitude, lon: selection.longitude });
  if (!center || !validTimezone(selection.timezone) || !['country', 'place'].includes(selection.scope)) return null;
  return { center, timezone: timezoneFor(center.lat, center.lng) || selection.timezone, destinationScope: selection.scope };
}

// Independent backup for provider outages. Prefer an exact country match to a town
// with the same name (e.g. Switzerland in the United States).
async function fallbackDestination(q) {
  const key = `open-meteo:${norm(q)}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const params = new URLSearchParams({ name: q, count: '10', language: 'en', format: 'json' });
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const rows = Array.isArray(data?.results) ? data.results : [];
    const candidates = rows.map(row => {
      const center = toPoint({ lat: row.latitude, lon: row.longitude });
      const timezone = center ? timezoneFor(center.lat, center.lng) || validTimezone(row.timezone) : '';
      return { row, center, timezone };
    }).filter(result => result.center && result.timezone);
    const exact = candidates.filter(result => norm(result.row.name) === norm(q));
    const chosen = exact.find(result => /^PCL/.test(result.row.feature_code || '')) || exact[0] || candidates[0];
    if (!chosen) return null;
    const result = { center: chosen.center, timezone: chosen.timezone, destinationScope: /^PCL/.test(chosen.row.feature_code || '') ? 'country' : 'place' };
    cache.set(key, result);
    return result;
  } catch { return null; }
}

// A trip's destination -> its centre point and timezone (both saved on the trip)
async function resolveDestination(destination) {
  const q = String(destination || '').trim();
  if (!q || process.env.GEOCODE_DISABLED === 'true') return emptyDestination();
  const rows = await lookup(new URLSearchParams({ q, format: 'jsonv2', limit: '1', 'accept-language': 'en' }));
  const center = toPoint(rows?.[0]);
  const timezone = center ? timezoneFor(center.lat, center.lng) || '' : '';
  if (center && timezone) return { center, timezone, destinationScope: rows[0].addresstype === 'country' || Number(rows[0].place_rank) === 4 ? 'country' : 'place' };
  return await fallbackDestination(q) || emptyDestination();
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

module.exports = { clearGeocodeCache, resolveDestination, geocodeAddress, destinationFromSelection };
