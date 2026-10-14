const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/budgetLogic');

const budget = {
  total: 1000,
  homeCurrency: 'SGD',
  destCurrency: 'JPY',
  categories: [
    { name: 'Accommodation', allocated: 400 },
    { name: 'Food', allocated: 200 },
    { name: 'Transport', allocated: 200 },
    { name: 'Activities', allocated: 200 },
  ],
};

test('statusFor thresholds: ok / warning at 80% / over at 100%', () => {
  assert.equal(L.statusFor(79, 100), 'ok');
  assert.equal(L.statusFor(80, 100), 'warning');
  assert.equal(L.statusFor(99.99, 100), 'warning');
  assert.equal(L.statusFor(100, 100), 'over');
  assert.equal(L.statusFor(0, 0), 'ok');
  assert.equal(L.statusFor(5, 0), 'over');
});

test('validateBudget accepts a good budget and normalises currency codes', () => {
  const v = L.validateBudget({ ...budget, homeCurrency: 'sgd', destCurrency: 'jpy' });
  assert.equal(v.ok, true);
  assert.equal(v.value.homeCurrency, 'SGD');
});

test('validateBudget defaults to an even split when categories are omitted', () => {
  const v = L.validateBudget({ total: 1000, homeCurrency: 'SGD', destCurrency: 'JPY' });
  assert.equal(v.ok, true);
  assert.equal(v.value.categories.length, L.DEFAULT_CATEGORIES.length);
  assert.equal(v.value.categories[0].allocated, 200);
});

test('validateBudget rejects bad totals, codes, duplicates and over-allocation', () => {
  assert.equal(L.validateBudget({ ...budget, total: 0 }).ok, false);
  assert.equal(L.validateBudget({ ...budget, homeCurrency: 'SG' }).ok, false);
  assert.equal(
    L.validateBudget({ ...budget, categories: [{ name: 'Food', allocated: 1 }, { name: 'food', allocated: 1 }] }).ok,
    false,
  );
  const over = L.validateBudget({ ...budget, categories: [{ name: 'Food', allocated: 5000 }] });
  assert.equal(over.ok, false);
  assert.match(over.errors.join(' '), /more than the total/);
});

test('validateExpense requires a known category and positive amount', () => {
  assert.equal(L.validateExpense({ amount: 10, category: 'Food', currency: 'JPY' }, budget).ok, true);
  assert.equal(L.validateExpense({ amount: -1, category: 'Food', currency: 'JPY' }, budget).ok, false);
  assert.equal(L.validateExpense({ amount: 10, category: 'Spa', currency: 'JPY' }, budget).ok, false);
  const v = L.validateExpense({ amount: 10, category: 'food', currency: 'jpy' }, budget);
  assert.equal(v.value.category, 'Food');
  assert.equal(v.value.currency, 'JPY');
});

test('toHome rounds to 2 decimals', () => {
  assert.equal(L.toHome(1000, 0.00891), 8.91);
});

test('summarize: remaining = total - spent, per-category sums', () => {
  const s = L.summarize(budget, [
    { category: 'Food', amountHome: 50 },
    { category: 'Food', amountHome: 25.5 },
    { category: 'Transport', amountHome: 100 },
  ]);
  assert.equal(s.spentTotal, 175.5);
  assert.equal(s.remaining, 824.5);
  const food = s.categories.find((c) => c.name === 'Food');
  assert.equal(food.spent, 75.5);
  assert.equal(food.remaining, 124.5);
  assert.equal(food.percentUsed, 38);
  assert.equal(food.status, 'ok');
});

test('category crosses 80% => warning, crosses 100% => over', () => {
  const warn = L.summarize(budget, [{ category: 'Food', amountHome: 170 }]);
  assert.equal(warn.categories.find((c) => c.name === 'Food').status, 'warning');
  assert.ok(warn.conflicts.some((c) => c.category === 'Food' && c.severity === 'low'));

  const over = L.summarize(budget, [{ category: 'Food', amountHome: 250 }]);
  assert.equal(over.categories.find((c) => c.name === 'Food').status, 'over');
  const conflict = over.conflicts.find((c) => c.category === 'Food');
  assert.equal(conflict.type, 'budget');
  assert.equal(conflict.severity, 'medium');
  // donor suggestion: Accommodation has the most headroom (400 left)
  assert.match(conflict.suggestion, /Accommodation/);
});

test('total over budget produces a high-severity conflict', () => {
  const s = L.summarize(budget, [{ category: 'Accommodation', amountHome: 1100 }]);
  assert.equal(s.status, 'over');
  assert.equal(s.remaining, -100);
  assert.ok(s.conflicts.some((c) => c.severity === 'high' && !c.category));
});

test('projection: upcoming itinerary costs push projected total over budget', () => {
  const s = L.summarize(
    budget,
    [{ category: 'Food', amountHome: 100 }],
    [{ category: 'Activities', estimatedCost: 950 }],
  );
  assert.equal(s.status, 'ok'); // actual spend is fine...
  assert.equal(s.projectedTotal, 1050);
  assert.equal(s.projectedStatus, 'over'); // ...but the plan is not
  assert.ok(s.conflicts.some((c) => /Planned activities push/.test(c.message)));
});

test('no spend => no conflicts', () => {
  assert.deepEqual(L.summarize(budget, []).conflicts, []);
});
