// Itinerary tests (node:test, no extra dependencies):
//   pnpm test:itinerary
// The routes are tested against the JSON store and a fake of the MongoDB driver. The same suite also runs
// against a real MongoDB (in a throwaway database that is dropped afterwards) when one is available:
//   MONGODB_URI=<connection string> pnpm test:itinerary

process.env.GEOCODE_DISABLED = 'true'; // no Nominatim calls here; itineraryWeather.test.js covers geocoding with a mock

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const logic = require('../src/itinerary/itineraryLogic');
const { createLocalStore, createMongoStore } = require('../src/itinerary/itineraryStore');
const { mountItinerary } = require('../src/itinerary/itineraryRoutes');
const { mountAuth } = require('../src/auth/authRoutes');
const { createMemoryAuthStore } = require('../src/auth/authStore');
const { createMongo } = require('../src/mongo');
const { startApp, fakeMongoDb } = require('./itineraryHelpers');

// Trip dates must not be in the past, so every date here is relative to today.
const TODAY = logic.todayString();
const D1 = logic.addDays(TODAY, 30);
const D2 = logic.addDays(D1, 1);
const BEYOND = logic.addDays(D1, 60);
const { addDays } = logic;

// ---------------------------------------------------------------------------------------------
// Pure logic
// ---------------------------------------------------------------------------------------------

const item = (id, startTime, endTime, extra = {}) => ({
  _id: id, title: `Item ${id}`, date: '2026-12-01', startTime, endTime, createdBy: 'alice', ...extra,
});

describe('conflict detection', () => {
  test('back-to-back items do not overlap, partial overlap does', () => {
    assert.equal(logic.overlaps(item('a', '10:00', '11:00'), item('b', '11:00', '12:00')), false);
    assert.equal(logic.overlaps(item('a', '10:00', '12:00'), item('b', '11:00', '13:00')), true);
  });

  test('flags overlapping items on both sides', async () => {
    const r = await logic.detectConflicts([item('a', '10:00', '12:00'), item('b', '11:00', '13:00')]);
    assert.equal(r.a[0].type, 'overlap');
    assert.equal(r.b[0].type, 'overlap');
  });

  test('does not flag items on different days', async () => {
    const r = await logic.detectConflicts([item('a', '10:00', '12:00'), item('b', '10:00', '12:00', { date: '2026-12-02' })]);
    assert.deepEqual(r, {});
  });

  test('flags an overlap between group members as group-overlap, naming the member', async () => {
    const r = await logic.detectConflicts([
      item('a', '10:00', '12:00'),
      item('b', '11:00', '13:00', { createdBy: 'u-2', createdByName: 'Bob' }),
    ]);
    assert.equal(r.a[0].type, 'group-overlap');
    assert.match(r.a[0].message, /added by Bob/);
  });

  test('flags travel time that is longer than the gap', async () => {
    const r = await logic.detectConflicts([item('a', '10:00', '11:00'), item('b', '11:10', '12:00')], {
      getTravelMinutes: async () => 30,
    });
    assert.equal(r.b[0].type, 'travel-time');
    assert.equal(r.a, undefined);
  });

  test('flags unsafe weather for outdoor and indoor & outdoor items, never indoor ones', async () => {
    const r = await logic.detectConflicts(
      [
        item('a', '10:00', '11:00', { setting: 'outdoor' }),
        item('b', '12:00', '13:00', { setting: 'both' }),
        item('c', '14:00', '15:00', { setting: 'indoor' }),
        item('d', '16:00', '17:00'),
      ],
      { getWeatherFlag: async () => ({ unsafe: true, reason: 'PSI 130' }) },
    );
    assert.equal(r.a[0].type, 'weather');
    assert.equal(r.b[0].type, 'weather');
    assert.equal(r.c, undefined);
    assert.equal(r.d, undefined);
  });
});

describe('validation', () => {
  const trip = { startDate: D1, endDate: D2 };
  const good = { title: 'Museum', date: D1, startTime: '10:00', endTime: '11:00' };

  test('an activity needs a title, a date inside the trip and a start before its end', () => {
    assert.equal(logic.validateItem(good, trip), null);
    assert.match(logic.validateItem({ ...good, title: '  ' }, trip), /Title/);
    assert.match(logic.validateItem({ ...good, date: BEYOND }, trip), /within the trip/);
    assert.match(logic.validateItem({ ...good, endTime: '09:00' }, trip), /End time/);
    assert.match(logic.validateItem({ ...good, startTime: '25:00' }, trip), /times are required/);
    assert.match(logic.validateItem({ ...good, cost: -1 }, trip), /Cost/);
    assert.match(logic.validateItem({ ...good, setting: 'underwater' }, trip), /indoor/);
    assert.match(logic.validateItem({ ...good, type: 'spaceship' }, trip), /type/);
  });

  test('over-long text is refused', () => {
    assert.match(logic.validateItem({ ...good, title: 'x'.repeat(121) }, trip), /at most 120/);
    assert.match(logic.validateItem({ ...good, notes: 'x'.repeat(1001) }, trip), /at most 1000/);
    assert.match(logic.validateTrip({ name: 'x'.repeat(81), destination: 'SG', startDate: D1, endDate: D2 }), /at most 80/);
  });

  test('only known fields get through, and unsent ones are left out so an update cannot wipe them', () => {
    const fields = logic.pickItemFields({ ...good, createdBy: 'mallory', tripId: 'other', isOutdoor: true, cost: '' });
    assert.deepEqual(fields, { title: 'Museum', date: D1, startTime: '10:00', endTime: '11:00' });
  });

  test('cleanLocation keeps good coordinates and drops rubbish ones', () => {
    assert.deepEqual(logic.cleanLocation({ address: ' Zoo ', lat: '1.4', lng: 103.8 }), { address: 'Zoo', lat: 1.4, lng: 103.8 });
    assert.deepEqual(logic.cleanLocation({ address: 'x', lat: 999, lng: 'abc' }), { address: 'x' });
    assert.equal(logic.cleanLocation('nope'), null);
  });

  test('isRealDate rejects dates that are not on the calendar', () => {
    assert.equal(logic.isRealDate('2027-02-28'), true);
    assert.equal(logic.isRealDate('2027-02-30'), false);
    assert.equal(logic.isRealDate('tomorrow'), false);
  });
});

describe('weather shape', () => {
  const base = { _id: 'abc', date: '2026-11-07', startTime: '10:00', endTime: '12:30' };

  test('id, local date time, setting and own coordinates', () => {
    const w = logic.toWeatherActivity(
      { ...base, setting: 'outdoor', location: { address: 'x', lat: 1.28, lng: 103.86 } },
      { center: { lat: 1.3, lng: 103.8 }, timezone: 'Asia/Singapore' },
    );
    assert.equal(w.id, 'abc');
    assert.deepEqual(w.coordinates, { lat: 1.28, lng: 103.86 });
    assert.equal(w.coordinatesFrom, 'activity');
    assert.equal(w.timezone, 'Asia/Singapore');
    assert.equal(w.startLocal, '2026-11-07T10:00');
    assert.equal(w.endLocal, '2026-11-07T12:30');
    assert.equal(w.setting, 'outdoor');
  });

  test('falls back to the destination centre, then to nothing', () => {
    const noCoords = { ...base, location: { address: 'somewhere' } };
    const viaTrip = logic.toWeatherActivity(noCoords, { center: { lat: 40.71, lng: -74.0 }, timezone: 'America/New_York' });
    assert.deepEqual(viaTrip.coordinates, { lat: 40.71, lng: -74.0 });
    assert.equal(viaTrip.coordinatesFrom, 'destination');
    assert.equal(viaTrip.timezone, 'America/New_York');

    const none = logic.toWeatherActivity(noCoords, {});
    assert.equal(none.coordinates, null);
    assert.equal(none.coordinatesFrom, null);
    assert.equal(none.timezone, null);
    assert.equal(none.startLocal, '2026-11-07T10:00'); // still usable for display
    assert.equal(logic.toWeatherActivity(noCoords, { timezone: 'Asia/Tokyo' }).timezone, 'Asia/Tokyo');
  });

  test('"both" passes through; no setting means indoor', () => {
    assert.equal(logic.toWeatherActivity({ ...base, setting: 'both' }).setting, 'both');
    assert.equal(logic.toWeatherActivity(base).setting, 'indoor');
  });

  test('timezoneFor gives an IANA name from coordinates (needs tz-lookup), null for rubbish', () => {
    assert.equal(logic.timezoneFor(1.29, 103.85), 'Asia/Singapore');
    assert.equal(logic.timezoneFor('x', 5), null);
  });
});

// ---------------------------------------------------------------------------------------------
// The API, run once per kind of storage
// ---------------------------------------------------------------------------------------------

function defineApiSuite(name, openStore, options = {}) {
  describe(`itinerary API with ${name}`, options, () => {
    let store, closeStore, app;
    const call = (...args) => app.call(...args);

    before(async () => {
      ({ store, close: closeStore } = await openStore());
      app = await startApp(store);
    });
    after(async () => {
      await app.close();
      await closeStore?.();
    });

    test('trip + item lifecycle with conflict detection', async () => {
      const trip = await call('POST', '/trips', { name: 'T', destination: 'SG', startDate: D1, endDate: D2 });
      assert.equal(trip.status, 201);
      assert.deepEqual(trip.body.members, [{ id: 'alice', name: 'Alice' }]);
      const id = trip.body._id;

      const a = await call('POST', `/trips/${id}/items`, { title: 'Museum', date: D1, startTime: '10:00', endTime: '12:00' });
      assert.equal(a.status, 201);
      assert.deepEqual(a.body.conflicts, []);
      assert.equal(a.body.item.createdByName, 'Alice');

      const b = await call('POST', `/trips/${id}/items`, { title: 'Lunch', date: D1, startTime: '11:00', endTime: '13:00' });
      assert.equal(b.body.conflicts[0].type, 'overlap');

      // moving the lunch to day 2 removes the conflict
      const moved = await call('PUT', `/items/${b.body.item._id}`, { title: 'Lunch', date: D2, startTime: '11:00', endTime: '13:00' });
      assert.equal(moved.body.conflicts.length, 0);

      const list = await call('GET', `/trips/${id}/items`);
      assert.equal(list.body.length, 2);

      assert.equal((await call('DELETE', `/items/${a.body.item._id}`)).status, 204);
      assert.equal((await call('GET', `/trips/${id}/items`)).body.length, 1);
    });

    test('your trips list only has trips you belong to', async () => {
      const mine = await call('POST', '/trips', { name: 'Only Alice', destination: 'SG', startDate: D1, endDate: D1 });
      const bobs = await call('POST', '/trips', { name: 'Only Bob', destination: 'SG', startDate: D1, endDate: D1 }, 'bob');
      const alices = (await call('GET', '/trips')).body.map((t) => t._id);
      assert.ok(alices.includes(mine.body._id));
      assert.ok(!alices.includes(bobs.body._id));
    });

    test('validates input', async () => {
      const { body: trip } = await call('POST', '/trips', { name: 'T3', destination: 'SG', startDate: D1, endDate: D1 });
      const bad = await call('POST', `/trips/${trip._id}/items`, { title: 'X', date: D1, startTime: '15:00', endTime: '14:00' });
      assert.equal(bad.status, 400);
      const outside = await call('POST', `/trips/${trip._id}/items`, { title: 'X', date: BEYOND, startTime: '10:00', endTime: '11:00' });
      assert.equal(outside.status, 400);
      const noBody = await call('POST', `/trips/${trip._id}/items`);
      assert.equal(noBody.status, 400);
    });

    test('only trip members can see or edit; a group clash names the member who added it', async () => {
      const { body: trip } = await call('POST', '/trips', { name: 'Group', destination: 'SG', startDate: D1, endDate: D1 });
      assert.equal((await call('GET', `/trips/${trip._id}`, null, 'bob')).status, 403);
      assert.equal((await call('GET', `/trips/${trip._id}/items`, null, 'bob')).status, 403);
      assert.equal((await call('POST', `/trips/${trip._id}/items`, { title: 'x', date: D1, startTime: '10:00', endTime: '11:00' }, 'bob')).status, 403);

      const added = await call('POST', `/trips/${trip._id}/members`, { email: 'Bob@Example.com ' });
      assert.equal(added.status, 200);
      assert.deepEqual(added.body.members.map((m) => m.name), ['Alice', 'Bob']);

      await call('POST', `/trips/${trip._id}/items`, { title: 'Beach', date: D1, startTime: '10:00', endTime: '12:00' });
      const bobs = await call('POST', `/trips/${trip._id}/items`, { title: 'Safari', date: D1, startTime: '11:00', endTime: '13:00' }, 'bob');
      assert.equal(bobs.body.conflicts[0].type, 'group-overlap');
      assert.match(bobs.body.conflicts[0].message, /added by Alice/);
    });

    test('adding a traveller: by email only, existing accounts only, and adding twice is harmless', async () => {
      const { body: trip } = await call('POST', '/trips', { name: 'Invite', destination: 'SG', startDate: D1, endDate: D1 });
      const url = `/trips/${trip._id}/members`;
      assert.equal((await call('POST', url, {})).status, 400);
      const unknown = await call('POST', url, { email: 'nobody@example.com' });
      assert.equal(unknown.status, 404);
      assert.match(unknown.body.error, /sign up/);
      assert.equal((await call('POST', url, { email: 'bob@example.com' })).status, 200);
      const again = await call('POST', url, { email: 'bob@example.com' });
      assert.equal(again.body.memberIds.filter((m) => m === 'bob').length, 1);
      // someone outside the trip cannot add people (not even themselves)
      assert.equal((await call('POST', url, { email: 'cara@example.com' }, 'cara')).status, 403);
    });

    test('only the owner can delete a trip, and its items go with it', async () => {
      const { body: trip } = await call('POST', '/trips', { name: 'Del', destination: 'SG', startDate: D1, endDate: D1 });
      await call('POST', `/trips/${trip._id}/members`, { email: 'bob@example.com' });
      const added = await call('POST', `/trips/${trip._id}/items`, { title: 'x', date: D1, startTime: '10:00', endTime: '11:00' });
      assert.equal((await call('DELETE', `/trips/${trip._id}`, null, 'bob')).status, 403);
      assert.equal((await call('DELETE', `/trips/${trip._id}`)).status, 204);
      assert.equal((await call('GET', `/trips/${trip._id}`)).status, 404);
      assert.equal((await call('GET', `/trips/${trip._id}/items`)).status, 404);
      assert.equal(await store.items.get(added.body.item._id), null);
    });

    test('unknown ids return 404 instead of crashing', async () => {
      assert.equal((await call('GET', '/trips/not-a-real-id')).status, 404);
      assert.equal((await call('PUT', '/items/not-a-real-id', { title: 'x' })).status, 404);
      assert.equal((await call('DELETE', '/items/not-a-real-id')).status, 404);
    });

    test("nobody can touch another trip's activity", async () => {
      const { body: trip } = await call('POST', '/trips', { name: 'Private', destination: 'SG', startDate: D1, endDate: D1 });
      const made = await call('POST', `/trips/${trip._id}/items`, { title: 'Secret', date: D1, startTime: '10:00', endTime: '11:00' });
      const edit = { title: 'Hacked', date: D1, startTime: '10:00', endTime: '11:00' };
      assert.equal((await call('PUT', `/items/${made.body.item._id}`, edit, 'bob')).status, 403);
      assert.equal((await call('DELETE', `/items/${made.body.item._id}`, null, 'bob')).status, 403);
      assert.equal((await call('GET', `/trips/${trip._id}/items`)).body[0].title, 'Secret');
    });

    test('trip dates cannot be in the past', async () => {
      const yesterday = addDays(TODAY, -1);
      const past = await call('POST', '/trips', { name: 'Past', destination: 'SG', startDate: yesterday, endDate: TODAY });
      assert.equal(past.status, 400);
      assert.match(past.body.error, /past/);
      const pastEnd = await call('POST', '/trips', { name: 'Past end', destination: 'SG', startDate: TODAY, endDate: yesterday });
      assert.equal(pastEnd.status, 400);
      assert.equal((await call('POST', '/trips', { name: 'Today', destination: 'SG', startDate: TODAY, endDate: TODAY })).status, 201);
      assert.equal((await call('POST', '/trips', { name: 'Fake', destination: 'SG', startDate: '2027-02-30', endDate: '2027-03-01' })).status, 400);
    });

    test('a trip can be edited: name, destination and dates', async () => {
      const { body: trip } = await call('POST', '/trips', { name: 'Old', destination: 'SG', startDate: D1, endDate: D2 });
      const edited = await call('PUT', `/trips/${trip._id}`, { name: '  Japan trip ', destination: 'Tokyo, Japan', startDate: D1, endDate: addDays(D1, 5) });
      assert.equal(edited.status, 200);
      assert.equal(edited.body.name, 'Japan trip');
      assert.equal(edited.body.destination, 'Tokyo, Japan');
      assert.equal((await call('GET', `/trips/${trip._id}`)).body.endDate, addDays(D1, 5));

      assert.equal((await call('PUT', `/trips/${trip._id}`, { name: '', destination: 'x', startDate: D1, endDate: D2 })).status, 400);
      assert.equal((await call('PUT', `/trips/${trip._id}`, { name: 'x', destination: 'x', startDate: D2, endDate: D1 })).status, 400);
      assert.equal((await call('PUT', `/trips/${trip._id}`, { name: 'x', destination: 'x', startDate: addDays(TODAY, -1), endDate: D2 })).status, 400);
    });

    test('shortening a trip is refused while activities fall outside the new dates', async () => {
      const { body: trip } = await call('POST', '/trips', { name: 'Shrink', destination: 'SG', startDate: D1, endDate: addDays(D1, 3) });
      await call('POST', `/trips/${trip._id}/items`, { title: 'Late', date: addDays(D1, 3), startTime: '10:00', endTime: '11:00' });
      const refused = await call('PUT', `/trips/${trip._id}`, { name: 'Shrink', destination: 'SG', startDate: D1, endDate: D2 });
      assert.equal(refused.status, 409);
      assert.match(refused.body.error, /outside the new dates/);
      assert.equal((await call('GET', `/trips/${trip._id}`)).body.endDate, addDays(D1, 3)); // unchanged
      // lengthening is fine
      assert.equal((await call('PUT', `/trips/${trip._id}`, { name: 'Shrink', destination: 'SG', startDate: D1, endDate: addDays(D1, 6) })).status, 200);
    });

    test('only trip members can edit a trip', async () => {
      const { body: trip } = await call('POST', '/trips', { name: 'Mine', destination: 'SG', startDate: D1, endDate: D2 });
      const body = { name: 'Hacked', destination: 'SG', startDate: D1, endDate: D2 };
      assert.equal((await call('PUT', `/trips/${trip._id}`, body, 'bob')).status, 403);
      await call('POST', `/trips/${trip._id}/members`, { email: 'bob@example.com' });
      assert.equal((await call('PUT', `/trips/${trip._id}`, body, 'bob')).status, 200);
      assert.equal((await call('PUT', '/trips/not-a-real-id', body)).status, 404);
    });

    test('a trip that already started can still be renamed, but its dates cannot move into the past', async () => {
      const started = await store.trips.create({
        name: 'Started', destination: 'SG', startDate: addDays(TODAY, -1), endDate: addDays(TODAY, 2),
        ownerId: 'alice', memberIds: ['alice'],
      });
      const renamed = await call('PUT', `/trips/${started._id}`, { name: 'Renamed', destination: 'SG', startDate: started.startDate, endDate: started.endDate });
      assert.equal(renamed.status, 200);
      const earlier = await call('PUT', `/trips/${started._id}`, { name: 'Renamed', destination: 'SG', startDate: addDays(TODAY, -2), endDate: started.endDate });
      assert.equal(earlier.status, 400);
    });

    test('editing an activity without sending a cost keeps the cost it had', async () => {
      const { body: trip } = await call('POST', '/trips', { name: 'Cost', destination: 'SG', startDate: D1, endDate: D1 });
      const created = await call('POST', `/trips/${trip._id}/items`, { title: 'Show', date: D1, startTime: '10:00', endTime: '11:00', cost: 20 });
      await call('PUT', `/items/${created.body.item._id}`, { title: 'Show (renamed)', date: D1, startTime: '10:00', endTime: '11:00' });
      const list = await call('GET', `/trips/${trip._id}/items`);
      assert.equal(list.body[0].title, 'Show (renamed)');
      assert.equal(list.body[0].cost, 20);
      // a new activity with no cost starts at 0
      const free = await call('POST', `/trips/${trip._id}/items`, { title: 'Walk', date: D1, startTime: '12:00', endTime: '13:00' });
      assert.equal(free.body.item.cost, 0);
    });

    test('indoor / outdoor / both is saved as the activity setting (and nothing else)', async () => {
      const { body: trip } = await call('POST', '/trips', { name: 'Setting', destination: 'SG', startDate: D1, endDate: D1 });
      const add = (start, end, extra) => call('POST', `/trips/${trip._id}/items`, { title: 'X', date: D1, startTime: start, endTime: end, ...extra });

      const indoor = await add('08:00', '09:00', { setting: 'indoor' });
      assert.equal(indoor.body.item.setting, 'indoor');
      const outdoor = await add('10:00', '11:00', { setting: 'outdoor' });
      assert.equal(outdoor.body.item.setting, 'outdoor');
      const both = await add('12:00', '13:00', { setting: 'both' });
      assert.equal(both.body.item.setting, 'both');
      assert.equal(both.body.item.weather.setting, 'both');

      // not sent -> indoor. The old isOutdoor field is ignored and never stored.
      const plain = await add('14:00', '15:00', { isOutdoor: true });
      assert.equal(plain.body.item.setting, 'indoor');
      for (const r of [indoor, outdoor, both, plain]) assert.equal('isOutdoor' in r.body.item, false);

      // anything else is refused
      const bad = await add('18:00', '19:00', { setting: 'underwater' });
      assert.equal(bad.status, 400);
      assert.match(bad.body.error, /indoor/i);

      // editing changes it; an edit that does not send it keeps the saved value
      const id = outdoor.body.item._id;
      const edit = (extra) => call('PUT', `/items/${id}`, { title: 'X', date: D1, startTime: '10:00', endTime: '11:00', ...extra });
      assert.equal((await edit({ setting: 'both' })).body.item.setting, 'both');
      assert.equal((await edit({})).body.item.setting, 'both');
      assert.equal((await edit({ setting: 'indoor' })).body.item.setting, 'indoor');
    });

    test('every route needs a signed-in user', async () => {
      const { body: trip } = await call('POST', '/trips', { name: 'Auth', destination: 'SG', startDate: D1, endDate: D1 });
      const made = await call('POST', `/trips/${trip._id}/items`, { title: 'x', date: D1, startTime: '10:00', endTime: '11:00' });
      const attempts = [
        ['GET', '/trips'],
        ['POST', '/trips', { name: 'x', destination: 'x', startDate: D1, endDate: D1 }],
        ['GET', `/trips/${trip._id}`],
        ['PUT', `/trips/${trip._id}`, { name: 'x', destination: 'x', startDate: D1, endDate: D1 }],
        ['DELETE', `/trips/${trip._id}`],
        ['POST', `/trips/${trip._id}/members`, { email: 'bob@example.com' }],
        ['GET', `/trips/${trip._id}/items`],
        ['POST', `/trips/${trip._id}/items`, { title: 'x', date: D1, startTime: '10:00', endTime: '11:00' }],
        ['PUT', `/items/${made.body.item._id}`, { title: 'x' }],
        ['DELETE', `/items/${made.body.item._id}`],
        ['GET', '/places?destination=Japan'],
      ];
      for (const [method, url, body] of attempts) {
        assert.equal((await call(method, url, body, null)).status, 401, `${method} ${url}`);
      }
    });
  });
}

defineApiSuite('the JSON file store', () => {
  const dir = mkdtempSync(join(tmpdir(), 'itinerary-test-'));
  return { store: createLocalStore(join(dir, 'itinerary.json')), close: () => rmSync(dir, { recursive: true, force: true }) };
});

defineApiSuite('the MongoDB store (fake driver)', () => ({ store: createMongoStore({ database: fakeMongoDb() }) }));

defineApiSuite(
  'MongoDB',
  async () => {
    const mongo = createMongo({ dbName: `goingsomewhere_itinerary_test_${Date.now()}` });
    return {
      store: createMongoStore({ database: mongo.database }),
      close: async () => {
        await (await mongo.database()).dropDatabase();
        await mongo.close();
      },
    };
  },
  { skip: !process.env.MONGODB_URI && 'MONGODB_URI not set' },
);

// ---------------------------------------------------------------------------------------------
// With the real account API: sign-up, the session cookie and requireAuth
// ---------------------------------------------------------------------------------------------

describe('itinerary API behind the real account API', () => {
  let server, base, dir;

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'itinerary-auth-test-'));
    const authStore = createMemoryAuthStore();
    const app = express();
    app.use(express.json());
    const auth = mountAuth(app, { store: authStore });
    mountItinerary(app, { store: createLocalStore(join(dir, 'itinerary.json')), requireAuth: auth.requireAuth, users: authStore });
    server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    base = `http://127.0.0.1:${server.address().port}/api`;
  });
  after(() => {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  // Signs up and returns a `call` that sends that person's session cookie, like the browser does.
  async function signUp(name, email) {
    const res = await fetch(`${base}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password: 'correct horse battery' }),
    });
    assert.equal(res.status, 201);
    const cookie = res.headers.getSetCookie()[0].split(';')[0];
    return async (method, url, body) => {
      const r = await fetch(base + url, {
        method,
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await r.text();
      return { status: r.status, body: text ? JSON.parse(text) : null };
    };
  }

  test('signed-out visitors get 401; signed-in members plan a trip together', async () => {
    const anonymous = await fetch(`${base}/trips`);
    assert.equal(anonymous.status, 401);

    const ava = await signUp('Ava Tan', 'ava@example.com');
    const ben = await signUp('Ben Lim', 'ben@example.com');

    const trip = await ava('POST', '/trips', { name: 'Kyoto', destination: 'Kyoto', startDate: D1, endDate: D2 });
    assert.equal(trip.status, 201);
    assert.equal(trip.body.members[0].name, 'Ava Tan');
    assert.equal((await ben('GET', `/trips/${trip.body._id}`)).status, 403);

    assert.equal((await ava('POST', `/trips/${trip.body._id}/members`, { email: 'ben@example.com' })).status, 200);
    assert.equal((await ben('GET', '/trips')).body.length, 1);

    await ava('POST', `/trips/${trip.body._id}/items`, { title: 'Fushimi Inari', date: D1, startTime: '09:00', endTime: '11:00' });
    const clash = await ben('POST', `/trips/${trip.body._id}/items`, { title: 'Nishiki Market', date: D1, startTime: '10:00', endTime: '12:00' });
    assert.equal(clash.body.conflicts[0].type, 'group-overlap');
    assert.match(clash.body.conflicts[0].message, /added by Ava Tan/);
  });

  test('the session cookie decides who you are: a made-up x-user-id header changes nothing', async () => {
    const ava = await signUp('Ava Two', 'ava2@example.com');
    const res = await fetch(`${base}/trips`, { headers: { 'x-user-id': 'demo-user' } });
    assert.equal(res.status, 401);
    assert.equal((await ava('GET', '/trips')).status, 200);
  });
});
