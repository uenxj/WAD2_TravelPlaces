// Checklist API tests (node:test, no extra dependencies).
// The API tests run on the local JSON-file storage, and again on a real MongoDB when one is set:
//   MONGODB_URI=mongodb://127.0.0.1:27017 pnpm test:checklist

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { mountChecklist } = require('../src/checklist/checklistRoutes');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createChecklistDb } = require('../src/checklist/checklistDb');
const { createLocalChecklistDb } = require('../src/checklist/checklistLocalDb');
const logic = require('../src/checklist/checklistLogic');

async function startApp(db, access) {
  const app = express();
  app.use(express.json());
  mountChecklist(app, { db, access });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : body && JSON.stringify(body),
    });
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  };
  return { server, call };
}

describe('checklistLogic', () => {
  test('new item: trims the name and fills defaults', () => {
    const v = logic.validateNewItem({ name: '  Travel   pillow ' });
    assert.equal(v.ok, true);
    assert.deepEqual(
      { name: v.value.name, category: v.value.category, priority: v.value.priority, source: v.value.source },
      { name: 'Travel pillow', category: 'Essentials', priority: 'essential', source: 'custom' },
    );
  });

  test('new item: unpacked unless it arrives packed', () => {
    assert.equal(logic.validateNewItem({ name: 'Passport' }).value.done, false);
    assert.equal(logic.validateNewItem({ name: 'Passport', done: true }).value.done, true);
    assert.equal(logic.validateNewItem({ name: 'Passport', done: 'yes' }).ok, false);
  });

  test('new item: rejects bad fields', () => {
    const v = logic.validateNewItem({ name: '', category: 'Food', priority: 'maybe', suggestionKey: 'Bad Key' });
    assert.equal(v.ok, false);
    assert.equal(v.errors.length, 4);
  });

  test('patch: needs at least one editable field and a boolean done', () => {
    assert.equal(logic.validatePatch({ tripId: 'x' }).ok, false);
    assert.equal(logic.validatePatch({ done: 'yes' }).ok, false);
    assert.deepEqual(logic.validatePatch({ done: true, extra: 1 }).value, { done: true });
  });

  test('batch: every item needs a suggestionKey', () => {
    assert.equal(logic.validateBatch({ items: [{ name: 'Hat' }] }).ok, false);
    assert.equal(logic.validateBatch({ items: [] }).ok, false);
    assert.equal(logic.validateBatch({ items: [{ name: 'Hat', suggestionKey: 'hat' }] }).ok, true);
  });
});

describe('checklist API without a database', () => {
  let app;
  before(async () => {
    app = await startApp(createChecklistDb({ uri: '' }));
  });
  after(() => app.server.close());

  test('returns 503 when storage is not configured', async () => {
    const res = await app.call('GET', '/trips/demo-trip/checklist');
    assert.equal(res.status, 503);
    assert.match(res.body.error, /unavailable/);
  });

  test('validates ids before touching the database', async () => {
    assert.equal((await app.call('GET', '/trips/bad%20id/checklist')).status, 400);
    assert.equal((await app.call('PATCH', '/checklist/123', { done: true })).status, 400);
  });

  test('malformed JSON gets a JSON 400', async () => {
    const res = await app.call('POST', '/trips/demo-trip/checklist', '{oops');
    assert.equal(res.status, 400);
    assert.match(res.body.error, /not valid JSON/);
  });
});

// The same API tests on each storage: `open()` gives a fresh, empty checklist storage.
function apiTests(name, open, options = {}) {
  describe(`checklist API with ${name}`, options, () => {
    let db;
    let app;
    const trip = '/trips/test-trip/checklist';

    before(async () => {
      db = open();
      app = await startApp(db);
    });
    after(async () => {
      // Drop the test collection (an empty database then disappears). A read/write-only
      // user, like an Atlas app user, may not drop whole databases.
      const col = await db.collection();
      await col.drop();
      await db.close();
      app.server.close();
    });

    test('add, list, update, delete', async () => {
      const created = await app.call('POST', trip, { name: 'Passport', category: 'Documents' });
      assert.equal(created.status, 201);
      const id = created.body.id;

      const updated = await app.call('PATCH', `/checklist/${id}`, { done: true });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.done, true);
      assert.equal(updated.body.name, 'Passport');

      const list = await app.call('GET', trip);
      assert.deepEqual(list.body.map((i) => [i.name, i.done]), [['Passport', true]]);

      assert.equal((await app.call('DELETE', `/checklist/${id}`)).status, 204);
      assert.equal((await app.call('DELETE', `/checklist/${id}`)).status, 404);
      assert.equal((await app.call('PATCH', `/checklist/${id}`, { done: false })).status, 404);
    });

    test('batch never duplicates and keeps existing state', async () => {
      const items = [
        { name: 'Charger', category: 'Electronics', source: 'default', suggestionKey: 'phone-charger' },
        { name: 'Sunscreen', category: 'Health', source: 'suggested', reason: 'Beach trip', suggestionKey: 'sunscreen' },
      ];
      const first = await app.call('POST', `${trip}/batch`, { items });
      assert.equal(first.body.added.length, 2);
      await app.call('PATCH', `/checklist/${first.body.added[0].id}`, { done: true });

      const [a, b] = await Promise.all([
        app.call('POST', `${trip}/batch`, { items }),
        app.call('POST', `${trip}/batch`, { items }),
      ]);
      assert.equal(a.status, 200);
      assert.equal(b.status, 200);
      assert.equal(a.body.added.length + b.body.added.length, 0);

      const list = await app.call('GET', trip);
      assert.equal(list.body.filter((i) => i.suggestionKey === 'phone-charger').length, 1);
      assert.equal(list.body.find((i) => i.suggestionKey === 'phone-charger').done, true);
    });

    test('trips do not share items', async () => {
      await app.call('POST', '/trips/trip-a/checklist', { name: 'Only on A' });
      const b = await app.call('GET', '/trips/trip-b/checklist');
      assert.deepEqual(b.body, []);
    });

    test('access: a private trip refuses outsiders on every route; other trips stay open', async () => {
      // Stand-in for server.js: "private-trip" is a real trip whose only member sends x-user: ava.
      const access = async (req, tripId) => {
        if (tripId !== 'private-trip') return null;
        if (!req.headers['x-user']) return { status: 401, error: 'Please log in to continue' };
        return req.headers['x-user'] === 'ava' ? null : { status: 403, error: 'You are not in this trip.' };
      };
      const guarded = await startApp(db, access);
      try {
        const path = '/trips/private-trip/checklist';
        const ava = { 'x-user': 'ava' };
        const item = (await guarded.call('POST', path, { name: 'Passport' }, ava)).body;
        assert.equal((await guarded.call('GET', path)).status, 401);
        assert.equal((await guarded.call('GET', path, undefined, { 'x-user': 'bob' })).status, 403);
        assert.equal((await guarded.call('POST', path, { name: 'Hat' }, { 'x-user': 'bob' })).status, 403);
        assert.equal((await guarded.call('POST', `${path}/batch`, { items: [{ name: 'Hat', suggestionKey: 'hat' }] })).status, 401);
        assert.equal((await guarded.call('PATCH', `/checklist/${item.id}`, { done: true }, { 'x-user': 'bob' })).status, 403);
        assert.equal((await guarded.call('DELETE', `/checklist/${item.id}`)).status, 401);
        assert.equal((await guarded.call('GET', path, undefined, ava)).body.length, 1); // untouched
        assert.equal((await guarded.call('PATCH', `/checklist/${item.id}`, { done: true }, ava)).body.done, true);
        assert.equal((await guarded.call('DELETE', `/checklist/${item.id}`, undefined, ava)).status, 204);
        assert.equal((await guarded.call('GET', '/trips/preview-tokyo/checklist')).status, 200); // sample trip: open
      } finally {
        guarded.server.close();
      }
    });
  });
}

apiTests('MongoDB', () => createChecklistDb({ dbName: `checklist_test_${process.pid}` }),
  { skip: !process.env.MONGODB_URI && 'MONGODB_URI not set' });

const localDir = mkdtempSync(join(tmpdir(), 'checklist-local-'));
apiTests('a local JSON file', () => createLocalChecklistDb(join(localDir, 'checklist.json')));

describe('local JSON-file storage', () => {
  after(() => rmSync(localDir, { recursive: true, force: true }));

  test('items survive a restart (new storage, same file)', async () => {
    const file = join(localDir, 'restart.json');
    const first = await startApp(createLocalChecklistDb(file));
    const added = await first.call('POST', '/trips/t1/checklist', { name: 'Passport' });
    await first.call('PATCH', `/checklist/${added.body.id}`, { done: true });
    first.server.close();

    const again = await startApp(createLocalChecklistDb(file));
    try {
      const list = await again.call('GET', '/trips/t1/checklist');
      assert.deepEqual(list.body.map((i) => [i.id, i.name, i.done]), [[added.body.id, 'Passport', true]]);
    } finally {
      again.server.close();
    }
  });
});
