// Budget API trip access: a real trip's budget is only for that trip's members; sample trips
// (preview-…) and demo-trip stay open. Uses the real budget routes (app.js), the real access rule
// (tripAccess.js) and the real local trip store; only the sign-in is faked (the `x-user` header).
//   node --test server/test/budgetAccess.test.js

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createApp } = require('../src/app');
const { createStore } = require('../src/store');
const { createTripAccess } = require('../src/tripAccess');
const { createLocalStore } = require('../src/itinerary/itineraryStore');

const rates = { async getRate(from, to) { return { from, to, rate: from === to ? 1 : 0.01, date: '2026-10-29', stale: false }; } };
const USERS = { ava: { id: 'ava', name: 'Ava' }, bob: { id: 'bob', name: 'Bob' } };
const BUDGET = { total: 1000, homeCurrency: 'SGD', destCurrency: 'JPY' };
const EXPENSE = { amount: 2000, currency: 'JPY', category: 'Food', date: '2026-12-12', note: 'Ramen' };

describe('budget API: who may use a trip\'s budget', () => {
  const dir = mkdtempSync(join(tmpdir(), 'budget-access-'));
  let server;
  let tripId;

  // call(method, path, body, as): `as` is the signed-in user id, or undefined for nobody.
  async function call(method, path, body, as) {
    const headers = { 'Content-Type': 'application/json' };
    if (as) headers['x-user'] = as;
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method, headers, body: body && JSON.stringify(body),
    });
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  }

  before(async () => {
    const trips = createLocalStore(join(dir, 'itinerary.json'));
    const trip = await trips.trips.create({ name: 'Tokyo', destination: 'Tokyo, Japan', memberIds: ['ava'] });
    tripId = trip._id;
    const access = createTripAccess({
      trips: trips.trips,
      authenticate: async (req) => USERS[req.headers['x-user']] || null,
    });
    const app = createApp({ store: createStore(join(dir, 'db.json')), rates, access });
    server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  });

  after(() => {
    server?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const tripRoutes = () => [
    ['GET', `/trips/${tripId}/budget`],
    ['PUT', `/trips/${tripId}/budget`, BUDGET],
    ['GET', `/trips/${tripId}/budget/summary`],
    ['POST', `/trips/${tripId}/budget/summary`, { upcoming: [] }],
    ['GET', `/trips/${tripId}/expenses`],
    ['POST', `/trips/${tripId}/expenses`, EXPENSE],
  ];

  test('a real trip: 401 with no login and 403 for a non-member on every trip route', async () => {
    for (const [method, path, body] of tripRoutes()) {
      const nobody = await call(method, path, body);
      assert.equal(nobody.status, 401, `${method} ${path} without login`);
      assert.equal(nobody.body.error, 'Please log in to continue');
      const outsider = await call(method, path, body, 'bob');
      assert.equal(outsider.status, 403, `${method} ${path} as a non-member`);
      assert.equal(outsider.body.error, 'You are not in this trip.');
    }
  });

  test('a real trip: a member sets the budget, logs, edits and deletes expenses', async () => {
    assert.equal((await call('GET', `/trips/${tripId}/budget`, undefined, 'ava')).status, 404); // no budget yet
    assert.equal((await call('PUT', `/trips/${tripId}/budget`, BUDGET, 'ava')).status, 200);
    assert.equal((await call('GET', `/trips/${tripId}/budget`, undefined, 'ava')).status, 200);
    assert.equal((await call('GET', `/trips/${tripId}/budget/summary`, undefined, 'ava')).status, 200);
    assert.equal((await call('POST', `/trips/${tripId}/budget/summary`, { upcoming: [] }, 'ava')).status, 200);
    const added = await call('POST', `/trips/${tripId}/expenses`, EXPENSE, 'ava');
    assert.equal(added.status, 201);
    const list = await call('GET', `/trips/${tripId}/expenses`, undefined, 'ava');
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);

    const edited = await call('PUT', `/expenses/${added.body.id}`, { note: 'Ramen + gyoza' }, 'ava');
    assert.equal(edited.status, 200);
    assert.equal(edited.body.note, 'Ramen + gyoza');
    assert.equal((await call('DELETE', `/expenses/${added.body.id}`, undefined, 'ava')).status, 204);
  });

  test('a real trip\'s expense: edit and delete by id are refused to outsiders, and 404 when missing', async () => {
    const { body: expense } = await call('POST', `/trips/${tripId}/expenses`, EXPENSE, 'ava');
    const path = `/expenses/${expense.id}`;
    assert.equal((await call('PUT', path, { amount: 1 })).status, 401);
    assert.equal((await call('PUT', path, { amount: 1 }, 'bob')).status, 403);
    assert.equal((await call('DELETE', path)).status, 401);
    assert.equal((await call('DELETE', path, undefined, 'bob')).status, 403);

    // Nothing changed: the member still sees the original expense.
    const list = await call('GET', `/trips/${tripId}/expenses`, undefined, 'ava');
    assert.deepEqual(list.body.map((e) => [e.id, e.amount]), [[expense.id, EXPENSE.amount]]);

    assert.equal((await call('PUT', '/expenses/no-such-id', { amount: 1 }, 'ava')).status, 404);
    assert.equal((await call('DELETE', '/expenses/no-such-id', undefined, 'ava')).status, 404);
  });

  test('sample trips (preview-…) and demo-trip stay open without a login', async () => {
    for (const id of ['preview-tokyo', 'demo-trip']) {
      assert.equal((await call('GET', `/trips/${id}/budget`)).status, 404, id); // open, just no budget yet
      assert.equal((await call('PUT', `/trips/${id}/budget`, BUDGET)).status, 200, id);
      assert.equal((await call('GET', `/trips/${id}/budget/summary`)).status, 200, id);
      const added = await call('POST', `/trips/${id}/expenses`, EXPENSE);
      assert.equal(added.status, 201, id);
      assert.equal((await call('GET', `/trips/${id}/expenses`)).status, 200, id);
      assert.equal((await call('PUT', `/expenses/${added.body.id}`, { amount: 3000 })).status, 200, id);
      assert.equal((await call('DELETE', `/expenses/${added.body.id}`)).status, 204, id);
    }
  });

  test('GET /rates stays open', async () => {
    const res = await call('GET', '/rates?from=JPY&to=SGD');
    assert.equal(res.status, 200);
    assert.equal(res.body.rate, 0.01);
  });
});
