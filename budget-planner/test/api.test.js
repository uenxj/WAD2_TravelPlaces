const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createStore } = require('../src/store');
const { createRateService } = require('../src/rates');

// Fake rates: 1 JPY = 0.01 SGD. No network needed.
const fakeRates = {
  async getRate(from, to) {
    if (from === to) return { from, to, rate: 1, date: null, stale: false };
    if (from === 'JPY' && to === 'SGD') return { from, to, rate: 0.01, date: '2026-10-13', stale: false };
    const e = new Error('unsupported pair in test');
    e.status = 502;
    throw e;
  },
};

async function start(rates = fakeRates) {
  const app = createApp({ store: createStore(null), rates });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return { call, close: () => server.close() };
}

const budgetBody = {
  total: 1000,
  homeCurrency: 'SGD',
  destCurrency: 'JPY',
  categories: [
    { name: 'Food', allocated: 200 },
    { name: 'Transport', allocated: 300 },
  ],
};

test('full journey: set budget -> log foreign expense -> warning -> over budget', async () => {
  const { call, close } = await start();
  try {
    // no budget yet
    assert.equal((await call('GET', '/trips/t1/budget/summary')).status, 404);

    // set budget
    const put = await call('PUT', '/trips/t1/budget', budgetBody);
    assert.equal(put.status, 200);

    // log 17,000 JPY of food => 170 SGD => 85% of 200 => warning
    const e1 = await call('POST', '/trips/t1/expenses', { amount: 17000, currency: 'JPY', category: 'Food' });
    assert.equal(e1.status, 201);
    assert.equal(e1.body.amountHome, 170);
    assert.equal(e1.body.rateUsed, 0.01);

    let s = (await call('GET', '/trips/t1/budget/summary')).body;
    assert.equal(s.spentTotal, 170);
    assert.equal(s.remaining, 830);
    assert.equal(s.categories.find((c) => c.name === 'Food').status, 'warning');

    // push Food over its limit
    await call('POST', '/trips/t1/expenses', { amount: 5000, currency: 'JPY', category: 'Food' });
    s = (await call('GET', '/trips/t1/budget/summary')).body;
    assert.equal(s.categories.find((c) => c.name === 'Food').status, 'over');
    assert.ok(s.conflicts.some((c) => c.category === 'Food' && c.type === 'budget'));
  } finally {
    close();
  }
});

test('rate is saved at logging time, so history does not shift', async () => {
  let rate = 0.01;
  const moving = { getRate: async (from, to) => (from === to ? { rate: 1 } : { rate, date: 'x', stale: false }) };
  const { call, close } = await start(moving);
  try {
    await call('PUT', '/trips/t2/budget', budgetBody);
    const e = await call('POST', '/trips/t2/expenses', { amount: 1000, currency: 'JPY', category: 'Food' });
    assert.equal(e.body.amountHome, 10);
    rate = 0.02; // rate moves
    const list = (await call('GET', '/trips/t2/expenses')).body;
    assert.equal(list[0].amountHome, 10); // unchanged
  } finally {
    close();
  }
});

test('validation errors come back as 400 with details', async () => {
  const { call, close } = await start();
  try {
    const bad = await call('PUT', '/trips/t3/budget', { total: -5, homeCurrency: 'SGD', destCurrency: 'JPY' });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.details.length > 0);

    await call('PUT', '/trips/t3/budget', budgetBody);
    const badExp = await call('POST', '/trips/t3/expenses', { amount: 5, currency: 'JPY', category: 'Nope' });
    assert.equal(badExp.status, 400);

    // expense on a trip with no budget
    assert.equal((await call('POST', '/trips/none/expenses', { amount: 5, category: 'Food' })).status, 404);
  } finally {
    close();
  }
});

test('edit and delete an expense', async () => {
  const { call, close } = await start();
  try {
    await call('PUT', '/trips/t4/budget', budgetBody);
    const e = (await call('POST', '/trips/t4/expenses', { amount: 1000, currency: 'JPY', category: 'Food' })).body;

    const up = await call('PUT', `/expenses/${e.id}`, { amount: 3000 });
    assert.equal(up.status, 200);
    assert.equal(up.body.amountHome, 30);

    assert.equal((await call('DELETE', `/expenses/${e.id}`)).status, 204);
    assert.equal((await call('DELETE', `/expenses/${e.id}`)).status, 404);
    assert.deepEqual((await call('GET', '/trips/t4/expenses')).body, []);
  } finally {
    close();
  }
});

test('summary POST accepts upcoming itinerary costs for projection', async () => {
  const { call, close } = await start();
  try {
    await call('PUT', '/trips/t5/budget', budgetBody);
    const s = await call('POST', '/trips/t5/budget/summary', {
      upcoming: [{ category: 'Transport', estimatedCost: 1200 }],
    });
    assert.equal(s.body.projectedTotal, 1200);
    assert.equal(s.body.projectedStatus, 'over');
  } finally {
    close();
  }
});

test('/rates validates input; rate failures surface as 502', async () => {
  const { call, close } = await start();
  try {
    assert.equal((await call('GET', '/rates?from=SG&to=JPY')).status, 400);
    assert.equal((await call('GET', '/rates?from=JPY&to=SGD')).body.rate, 0.01);
    assert.equal((await call('GET', '/rates?from=EUR&to=GBP')).status, 502);
  } finally {
    close();
  }
});

test('rate service: caches, then falls back to stale rate when API is down', async () => {
  let calls = 0;
  let down = false;
  let t = 0;
  const svc = createRateService({
    now: () => t,
    ttlMs: 1000,
    fetchImpl: async () => {
      calls += 1;
      if (down) throw new Error('network down');
      return { ok: true, json: async () => ({ date: '2026-10-13', rates: { SGD: 0.0089 } }) };
    },
  });

  const a = await svc.getRate('JPY', 'SGD');
  assert.equal(a.source, 'live');
  const b = await svc.getRate('JPY', 'SGD');
  assert.equal(b.source, 'cache');
  assert.equal(calls, 1);

  t = 5000; // cache expired, API down => stale fallback
  down = true;
  const c = await svc.getRate('JPY', 'SGD');
  assert.equal(c.stale, true);
  assert.equal(c.rate, 0.0089);

  // never-seen pair + API down => error
  await assert.rejects(() => svc.getRate('USD', 'EUR'), /Could not get exchange rate/);

  // same currency never hits the network
  assert.equal((await svc.getRate('SGD', 'SGD')).rate, 1);
});
