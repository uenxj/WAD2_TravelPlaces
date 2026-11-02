// The MongoDB budget store must behave exactly like the JSON store: run the same requests
// through the real budget routes (app.js) on both and compare every response.
// Needs a real MongoDB; skipped without one:
//   MONGODB_URI=<connection string> pnpm test:checklist

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createApp } = require('../src/app');
const { createStore } = require('../src/store');
const { createMongoStore } = require('../src/budgetMongoStore');
const { createChecklistDb } = require('../src/checklist/checklistDb');

// Fixed exchange rate so both runs convert the same way.
const rates = { async getRate(from, to) { return { from, to, rate: from === to ? 1 : 0.01, date: '2026-10-29', stale: false }; } };

async function start(store) {
  const server = await new Promise((resolve) => {
    const s = createApp({ store, rates }).listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
    });
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  };
  return { server, call };
}

// Ids and timestamps differ between runs; replace them so the rest can be compared.
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) =>
      [k, ['id', 'createdAt', 'updatedAt'].includes(k) ? `<${k}>` : normalize(v)]));
  }
  return value;
}

// One realistic session: set a budget, log, edit and delete expenses, read summaries.
async function scenario({ call }) {
  const out = [];
  const log = async (...args) => {
    const r = await call(...args);
    out.push(normalize(r));
    return r.body;
  };
  const trip = '/trips/budget-test';
  await log('GET', `${trip}/budget`); // 404: no budget yet
  await log('PUT', `${trip}/budget`, { total: 1000, homeCurrency: 'SGD', destCurrency: 'JPY' });
  await log('GET', `${trip}/budget/summary`);
  const ramen = await log('POST', `${trip}/expenses`, { amount: 2000, currency: 'JPY', category: 'Food', date: '2026-12-12', note: 'Ramen' });
  await log('POST', `${trip}/expenses`, { amount: 30, category: 'Transport', date: '2026-12-13', note: 'Train' });
  const sushi = await log('POST', `${trip}/expenses`, { amount: 4000, currency: 'JPY', category: 'Food', date: '2026-12-12', note: 'Sushi' });
  await log('GET', `${trip}/expenses`); // newest date first, same-day in added order
  await log('GET', `${trip}/expenses?category=food`);
  await log('PUT', `/expenses/${ramen.id}`, { amount: 2500, note: 'Ramen + gyoza' });
  await log('PUT', `/expenses/${ramen.id}`, { currency: 'SGD' });
  await log('DELETE', `/expenses/${sushi.id}`);
  await log('DELETE', `/expenses/${sushi.id}`); // 404 the second time
  await log('PUT', '/expenses/no-such-id', { amount: 1 });
  await log('GET', `${trip}/expenses`);
  await log('GET', `${trip}/budget/summary`);
  await log('PUT', `${trip}/budget`, { total: 1500, homeCurrency: 'SGD', destCurrency: 'JPY' });
  await log('GET', `${trip}/budget`);
  await log('GET', '/trips/other-trip/expenses'); // trips don't share expenses
  return out;
}

describe('MongoDB budget store matches the JSON store', { skip: !process.env.MONGODB_URI && 'MONGODB_URI not set' }, () => {
  const dbName = `budget_test_${process.pid}`;
  const dir = mkdtempSync(join(tmpdir(), 'budget-json-'));
  let mongo;
  let jsonApp;
  let mongoApp;

  before(async () => {
    mongo = createChecklistDb({ dbName });
    jsonApp = await start(createStore(join(dir, 'db.json')));
    mongoApp = await start(createMongoStore({ database: mongo.database }));
  });

  after(async () => {
    // Drop only the test collections (a read/write-only user may not drop databases).
    const db = await mongo.database();
    for (const name of ['budgets', 'expenses', 'checklist_items']) await db.collection(name).drop().catch(() => {});
    await mongo.close();
    jsonApp.server.close();
    mongoApp.server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  test('same requests give the same responses', async () => {
    const fromJson = await scenario(jsonApp);
    const fromMongo = await scenario(mongoApp);
    assert.equal(fromMongo.length, fromJson.length);
    fromJson.forEach((expected, i) => assert.deepEqual(fromMongo[i], expected, `request #${i + 1}`));
  });

  test('data survives a restart (new store, same database)', async () => {
    const again = await start(createMongoStore({ database: mongo.database }));
    try {
      const r = await again.call('GET', '/trips/budget-test/budget');
      assert.equal(r.status, 200);
      assert.equal(r.body.total, 1500);
    } finally {
      again.server.close();
    }
  });
});

describe('MongoDB budget store when the database is down', () => {
  test('budget requests answer 503 with a clear message', async () => {
    const down = createChecklistDb({ uri: '' }); // not configured
    const app = await start(createMongoStore({ database: down.database }));
    try {
      const r = await app.call('GET', '/trips/x/budget');
      assert.equal(r.status, 503);
      assert.match(r.body.error, /Budget storage is unavailable/);
    } finally {
      app.server.close();
    }
  });
});
