// Weather data on activities: item.weather, destination timezone, and finding coordinates for manual activities.
// Nominatim is mocked, so these tests never touch the network.

process.env.NOMINATIM_DELAY_MS = '0';
delete process.env.GEOCODE_DISABLED;

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { todayString, addDays, timezoneFor } = require('../src/itinerary/itineraryLogic');
const { createLocalStore } = require('../src/itinerary/itineraryStore');
const { externalChecks } = require('../src/itinerary/externalChecks');
const { clearGeocodeCache } = require('../src/itinerary/geocode');
const { startApp } = require('./itineraryHelpers');

const D1 = addDays(todayString(), 30);

// ---- Nominatim mock: only nominatim.openstreetmap.org is intercepted, the test server calls pass through ----
const realFetch = globalThis.fetch;
let nominatimQueries = [];
const nominatim = {}; // lowercased query -> rows
const nominatimFailures = {};
const backupLocations = {};
let backupQueries = [];
globalThis.fetch = async (url, opts) => {
  if (String(url).includes('nominatim.openstreetmap.org')) {
    const q = new URL(url).searchParams.get('q').toLowerCase();
    nominatimQueries.push(q);
    if (nominatimFailures[q]) return Response.json({}, { status: nominatimFailures[q] });
    return Response.json(nominatim[q] || []);
  }
  if (String(url).includes('geocoding-api.open-meteo.com')) {
    const q = new URL(url).searchParams.get('name').toLowerCase();
    backupQueries.push(q);
    return Response.json({ results: backupLocations[q] || [] });
  }
  return realFetch(url, opts);
};
const row = (lat, lon) => [{ lat: String(lat), lon: String(lon) }];

let dir, store, app;
before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'itinerary-weather-test-'));
  store = createLocalStore(join(dir, 'itinerary.json'));
  app = await startApp(store);
});
after(async () => {
  await app.close();
  globalThis.fetch = realFetch;
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => {
  clearGeocodeCache();
  nominatimQueries = [];
  backupQueries = [];
  delete process.env.GEOCODE_DISABLED;
  for (const source of [nominatimFailures, backupLocations]) for (const key of Object.keys(source)) delete source[key];
  for (const k of Object.keys(nominatim)) delete nominatim[k];
});

const call = (...args) => app.call(...args);

async function makeTrip(destination, destinationRows) {
  if (destinationRows) nominatim[destination.toLowerCase()] = destinationRows;
  const r = await call('POST', '/trips', { name: 'W', destination, startDate: D1, endDate: D1 });
  assert.equal(r.status, 201);
  return r.body;
}
const add = (tripId, extra = {}) =>
  call('POST', `/trips/${tripId}/items`, { title: 'Walk', date: D1, startTime: '10:00', endTime: '12:00', ...extra });

// ---------- trips ----------

test('a new trip stores its destination centre and timezone', async () => {
  const trip = await makeTrip('Singapore', row(1.2897, 103.8501));
  assert.deepEqual(trip.center, { lat: 1.2897, lng: 103.8501 });
  assert.equal(trip.timezone, 'Asia/Singapore');
});

test('a trip is still created when the destination cannot be found', async () => {
  const trip = await makeTrip('Nowhereland');
  assert.equal(trip.center, null);
  assert.equal(trip.timezone, '');
});

test('editing a trip looks the destination up again when it changes, and backfills older trips', async () => {
  const trip = await makeTrip('Singapore', row(1.29, 103.85));
  nominatim['tokyo, japan'] = row(35.68, 139.69);
  const moved = await call('PUT', `/trips/${trip._id}`, { name: 'W', destination: 'Tokyo, Japan', startDate: D1, endDate: D1 });
  assert.deepEqual(moved.body.center, { lat: 35.68, lng: 139.69 });
  assert.equal(moved.body.timezone, 'Asia/Tokyo');

  // an older trip that never had a centre: any edit fills it in
  const old = await store.trips.create({ name: 'Old', destination: 'Singapore', startDate: D1, endDate: D1, ownerId: 'alice', memberIds: ['alice'] });
  const fixed = await call('PUT', `/trips/${old._id}`, { name: 'Old', destination: 'Singapore', startDate: D1, endDate: D1 });
  assert.deepEqual(fixed.body.center, { lat: 1.29, lng: 103.85 });
});

// ---------- failed lookups and country destinations ----------

const swissBackup = { name: 'Switzerland', latitude: 47.00016, longitude: 8.01427, timezone: 'Europe/Zurich', feature_code: 'PCLI' };

test('a country destination is supported by the primary provider', async () => {
  const trip = await makeTrip('switzerland', [{ lat: '46.7985624', lon: '8.2319736', addresstype: 'country', place_rank: 4 }]);
  assert.equal(trip.timezone, 'Europe/Zurich');
  assert.equal(trip.destinationScope, 'country');
  assert.equal(backupQueries.length, 0);
});

test('a provider outage uses the backup and prefers a country over a town with the same name', async () => {
  nominatimFailures.switzerland = 503;
  backupLocations.switzerland = [
    { name: 'Switzerland', latitude: 30.07607, longitude: -81.64731, feature_code: 'PPL', timezone: 'America/New_York' },
    swissBackup,
  ];
  const trip = await makeTrip('Switzerland');
  assert.deepEqual(trip.center, { lat: 47.00016, lng: 8.01427 });
  assert.equal(trip.timezone, 'Europe/Zurich');
  assert.equal(trip.destinationScope, 'country');
  assert.deepEqual(backupQueries, ['switzerland']);
});

test('the backup keeps an international city and country query together', async () => {
  backupLocations['zurich, switzerland'] = [{ name: 'Zurich', latitude: 47.3769, longitude: 8.5417, feature_code: 'PPLA', timezone: 'Europe/Zurich' }];
  const trip = await makeTrip('Zurich, Switzerland');
  assert.deepEqual(trip.center, { lat: 47.3769, lng: 8.5417 });
  assert.equal(trip.destinationScope, 'place');
  assert.deepEqual(backupQueries, ['zurich, switzerland']);
});

test('reopening location resolution repairs an existing trip and its activity conditions', async () => {
  const trip = await makeTrip('Switzerland');
  assert.equal(trip.center, null);
  await add(trip._id);
  backupLocations.switzerland = [swissBackup];
  const recovered = await call('POST', `/trips/${trip._id}/location`);
  assert.equal(recovered.status, 200);
  assert.deepEqual(recovered.body.center, { lat: 47.00016, lng: 8.01427 });
  assert.equal(recovered.body.timezone, 'Europe/Zurich');
  assert.equal(recovered.body.name, trip.name);
  assert.equal(recovered.body.startDate, trip.startDate);
  const saved = await store.trips.get(trip._id);
  assert.deepEqual(saved.center, recovered.body.center);
  const items = await call('GET', `/trips/${trip._id}/items`);
  assert.deepEqual(items.body[0].weather.coordinates, saved.center);
  assert.equal(items.body[0].weather.timezone, 'Europe/Zurich');
  // The earlier empty result must not stop a later retry from reaching either provider.
  assert.equal(nominatimQueries.filter(q => q === 'switzerland').length, 2);
  assert.equal(backupQueries.filter(q => q === 'switzerland').length, 2);
});

test('location resolution failures leave the trip unchanged and offer a retry', async () => {
  const trip = await makeTrip('Nowhereland');
  const before = await store.trips.get(trip._id);
  const response = await call('POST', `/trips/${trip._id}/location`);
  assert.equal(response.status, 503);
  assert.match(response.body.error, /Retry/);
  assert.deepEqual(await store.trips.get(trip._id), before);
});

test('location resolution checks membership before making any provider request', async () => {
  const trip = await makeTrip('Switzerland');
  nominatimQueries = [];
  backupQueries = [];
  assert.equal((await call('POST', `/trips/${trip._id}/location`, undefined, 'bob')).status, 403);
  assert.equal((await call('POST', `/trips/${trip._id}/location`, undefined, null)).status, 401);
  assert.deepEqual(nominatimQueries, []);
  assert.deepEqual(backupQueries, []);
});

test('null, empty and out-of-range coordinates never become a location', async () => {
  for (const lat of [null, '', 999]) {
    nominatim.switzerland = [{ lat, lon: '8.23' }];
    backupLocations.switzerland = [{ ...swissBackup, latitude: lat }];
    clearGeocodeCache();
    const trip = await makeTrip('Switzerland');
    assert.equal(trip.center, null);
    assert.equal(trip.timezone, '');
  }
});

test('editing a trip with coordinates but no timezone repairs its location', async () => {
  const trip = await store.trips.create({ name: 'Old', destination: 'Switzerland', startDate: D1, endDate: D1, ownerId: 'alice', memberIds: ['alice'], center: { lat: 46.8, lng: 8.23 }, timezone: '' });
  backupLocations.switzerland = [swissBackup];
  const repaired = await call('PUT', `/trips/${trip._id}`, { name: 'Old', destination: 'Switzerland', startDate: D1, endDate: D1 });
  assert.equal(repaired.status, 200);
  assert.equal(repaired.body.timezone, 'Europe/Zurich');
});

test('GEOCODE_DISABLED also disables the backup provider', async () => {
  process.env.GEOCODE_DISABLED = 'true';
  const trip = await makeTrip('Switzerland');
  assert.equal(trip.center, null);
  assert.deepEqual(nominatimQueries, []);
  assert.deepEqual(backupQueries, []);
});


// ---------- confirmed search selections ----------
const zurichSelection = { label: 'Zurich, Switzerland', latitude: 47.3769, longitude: 8.5417, timezone: 'Europe/Zurich', scope: 'place' };

test('a selected destination saves coordinates without another geocoding request', async () => {
  const response = await call('POST', '/trips', { name: 'Selected city', destination: zurichSelection.label, destinationLocation: zurichSelection, startDate: D1, endDate: D1 });
  assert.equal(response.status, 201);
  assert.deepEqual(response.body.center, { lat: 47.3769, lng: 8.5417 });
  assert.equal(response.body.timezone, 'Europe/Zurich');
  assert.equal(response.body.destinationScope, 'place');
  assert.deepEqual(nominatimQueries, []);
  assert.deepEqual(backupQueries, []);
});

test('editing a trip with a selected destination replaces its old location without geocoding', async () => {
  const trip = await makeTrip('Switzerland');
  nominatimQueries = [];
  backupQueries = [];
  const response = await call('PUT', `/trips/${trip._id}`, { name: trip.name, destination: zurichSelection.label, destinationLocation: zurichSelection, startDate: D1, endDate: D1 });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.center, { lat: 47.3769, lng: 8.5417 });
  assert.equal(response.body.timezone, 'Europe/Zurich');
  assert.deepEqual(nominatimQueries, []);
  assert.deepEqual(backupQueries, []);
});

test('stale or invalid destination selections cannot silently store the wrong location', async () => {
  for (const invalid of [
    { ...zurichSelection, label: 'Bern, Switzerland' },
    { ...zurichSelection, latitude: null },
    { ...zurichSelection, latitude: 100 },
    { ...zurichSelection, longitude: -190 },
    { ...zurichSelection, timezone: 'Not/A_Timezone' },
    { ...zurichSelection, scope: 'invalid' },
  ]) {
    const response = await call('POST', '/trips', { name: 'Invalid', destination: zurichSelection.label, destinationLocation: invalid, startDate: D1, endDate: D1 });
    assert.equal(response.status, 400);
    assert.match(response.body.error, /Select a destination/);
  }
  assert.deepEqual(nominatimQueries, []);
  assert.deepEqual(backupQueries, []);
});

// ---------- manual activities ----------

test('a manually added activity gets coordinates from its address', async () => {
  const trip = await makeTrip('Singapore', row(1.29, 103.85));
  nominatim['marina gardens dr, singapore'] = row(1.2816, 103.8636);
  const r = await add(trip._id, { title: 'Gardens', location: { address: 'Marina Gardens Dr' }, setting: 'outdoor' });
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.item.location, { address: 'Marina Gardens Dr', lat: 1.2816, lng: 103.8636 });
  assert.equal(r.body.item.weather.coordinatesFrom, 'activity');
  assert.equal(r.body.item.weather.setting, 'outdoor');
  assert.equal(r.body.item.weather.startLocal, `${D1}T10:00`);
});

test('an address that cannot be found falls back to the destination centre', async () => {
  const trip = await makeTrip('Singapore', row(1.29, 103.85));
  const r = await add(trip._id, { location: { address: 'zzz unknown place' } });
  assert.equal(r.body.item.location.lat, undefined);
  assert.deepEqual(r.body.item.weather.coordinates, { lat: 1.29, lng: 103.85 });
  assert.equal(r.body.item.weather.coordinatesFrom, 'destination');
});

test('no coordinates anywhere: weather.coordinates is null', async () => {
  const trip = await makeTrip('Nowhereland');
  const r = await add(trip._id, { location: { address: 'zzz' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.item.weather.coordinates, null);
  assert.equal(r.body.item.weather.coordinatesFrom, null);
});

test('coordinates from Top Places are kept and not looked up again', async () => {
  const trip = await makeTrip('Singapore', row(1.29, 103.85));
  nominatimQueries = [];
  const r = await add(trip._id, { placeId: 'W1', location: { address: 'Singapore Zoo', lat: 1.4043, lng: 103.793 } });
  assert.deepEqual(r.body.item.location, { address: 'Singapore Zoo', lat: 1.4043, lng: 103.793 });
  assert.equal(nominatimQueries.length, 0);
});

test('rubbish coordinates from the client are ignored', async () => {
  const trip = await makeTrip('Singapore', row(1.29, 103.85));
  const r = await add(trip._id, { location: { address: '', lat: 999, lng: 'abc' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.item.location.lat, undefined);
});

test('editing keeps coordinates while the address is unchanged, and looks up a new address', async () => {
  const trip = await makeTrip('Singapore', row(1.29, 103.85));
  nominatim['marina gardens dr, singapore'] = row(1.2816, 103.8636);
  nominatim['stamford rd, singapore'] = row(1.2966, 103.8485);
  const created = await add(trip._id, { location: { address: 'Marina Gardens Dr' } });
  const id = created.body.item._id;
  const edit = (extra) => call('PUT', `/items/${id}`, { title: 'Walk', date: D1, startTime: '10:00', endTime: '12:00', ...extra });

  // the form may send only { address } on edit: the coordinates must survive
  assert.equal((await edit({ location: { address: 'Marina Gardens Dr' } })).body.item.location.lat, 1.2816);

  // or send the saved coordinates back with the same address
  assert.equal((await edit({ location: { address: 'Marina Gardens Dr', lat: 1.2816, lng: 103.8636 } })).body.item.location.lat, 1.2816);

  // a different address must not keep the old coordinates, even if the client sends them back
  const changed = await edit({ location: { address: 'Stamford Rd', lat: 1.2816, lng: 103.8636 } });
  assert.equal(changed.body.item.location.lat, 1.2966);
  assert.equal(changed.body.item.location.address, 'Stamford Rd');

  // not sending a location at all leaves it alone
  const untouched = await edit({ title: 'Renamed' });
  assert.equal(untouched.body.item.location.lat, 1.2966);
});

test('GET items includes item.weather for items that were saved without it', async () => {
  const trip = await makeTrip('Singapore', row(1.29, 103.85));
  await store.items.create({ tripId: trip._id, title: 'Old item', date: D1, startTime: '09:00', endTime: '10:00', createdBy: 'alice', setting: 'outdoor' });
  const list = await call('GET', `/trips/${trip._id}/items`);
  const w = list.body.find((i) => i.title === 'Old item').weather;
  assert.deepEqual(w.coordinates, { lat: 1.29, lng: 103.85 });
  assert.equal(w.coordinatesFrom, 'destination');
  assert.equal(w.startLocal, `${D1}T09:00`);
});

// ---------- the plug-in point for the weather check ----------

test('the weather check receives item.weather, for outdoor and "Indoor & Outdoor" activities but never indoor ones', async () => {
  const seen = [];
  const original = externalChecks.getWeatherFlag;
  externalChecks.getWeatherFlag = async (item) => {
    seen.push(item.weather.setting);
    return { unsafe: true, reason: 'heavy rain' };
  };
  try {
    const trip = await makeTrip('Singapore', row(1.29, 103.85));
    const outdoor = await add(trip._id, { setting: 'outdoor' });
    assert.deepEqual(seen, ['outdoor']);
    assert.equal(outdoor.body.conflicts.find((c) => c.type === 'weather').severity, 'warning');

    const both = await add(trip._id, { title: 'Market', setting: 'both', startTime: '13:00', endTime: '14:00' });
    assert.equal(both.body.conflicts.some((c) => c.type === 'weather'), true);

    const indoor = await add(trip._id, { title: 'Museum', setting: 'indoor', startTime: '15:00', endTime: '16:00' });
    assert.equal(indoor.body.conflicts.some((c) => c.type === 'weather'), false);
    assert.equal(seen.includes('indoor'), false);
  } finally {
    externalChecks.getWeatherFlag = original;
  }
});

test('timezoneFor agrees with the timezone saved on a trip', async () => {
  assert.equal(timezoneFor(48.8566, 2.3522), 'Europe/Paris');
  const trip = await makeTrip('Paris', row(48.8566, 2.3522));
  assert.equal(trip.timezone, 'Europe/Paris');
});
