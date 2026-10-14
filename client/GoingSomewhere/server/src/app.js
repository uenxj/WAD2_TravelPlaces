const path = require('path');
const express = require('express');
const logic = require('./budgetLogic');

/**
 * Build the Express app. Dependencies are injected so tests can pass a fake
 * store and fake rate service.
 *
 * To mount inside your team's existing server instead:
 *   app.use('/api', require('./budget-planner/src/app').createRouter({ store, rates }));
 */
function createRouter({ store, rates }) {
  const router = express.Router();

  // --- helpers -------------------------------------------------------------
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  async function requireBudget(req, res) {
    const budget = await store.getBudget(req.params.tripId);
    if (!budget) {
      res.status(404).json({ error: 'No budget set for this trip yet' });
      return null;
    }
    return budget;
  }

  // Itinerary items not yet done can supply estimated costs. Until the
  // Itinerary Planner exists, the client may pass them in the request body
  // of the summary call (POST) or we simply use none.
  function parseUpcoming(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((u) => ({ category: String(u?.category || ''), estimatedCost: Number(u?.estimatedCost) }))
      .filter((u) => u.category && Number.isFinite(u.estimatedCost) && u.estimatedCost >= 0);
  }

  // --- rates ---------------------------------------------------------------
  router.get('/rates', wrap(async (req, res) => {
    const { from, to } = req.query;
    if (!/^[A-Za-z]{3}$/.test(from || '') || !/^[A-Za-z]{3}$/.test(to || '')) {
      return res.status(400).json({ error: 'from and to must be 3-letter currency codes' });
    }
    res.json(await rates.getRate(from, to));
  }));

  // --- budget --------------------------------------------------------------
  router.get('/trips/:tripId/budget', wrap(async (req, res) => {
    const budget = await requireBudget(req, res);
    if (budget) res.json(budget);
  }));

  router.put('/trips/:tripId/budget', wrap(async (req, res) => {
    const v = logic.validateBudget(req.body);
    if (!v.ok) return res.status(400).json({ error: 'Invalid budget', details: v.errors });
    res.json(await store.saveBudget(req.params.tripId, v.value));
  }));

  // GET for the simple case; POST lets the Itinerary Planner send upcoming costs.
  const summaryHandler = wrap(async (req, res) => {
    const budget = await requireBudget(req, res);
    if (!budget) return;
    const expenses = await store.listExpenses(req.params.tripId);
    const upcoming = parseUpcoming(req.body?.upcoming);
    res.json(logic.summarize(budget, expenses, upcoming));
  });
  router.get('/trips/:tripId/budget/summary', summaryHandler);
  router.post('/trips/:tripId/budget/summary', summaryHandler);

  // --- expenses ------------------------------------------------------------
  router.get('/trips/:tripId/expenses', wrap(async (req, res) => {
    const category = req.query.category;
    let list = await store.listExpenses(req.params.tripId);
    if (category) list = list.filter((e) => e.category.toLowerCase() === String(category).toLowerCase());
    res.json(list);
  }));

  router.post('/trips/:tripId/expenses', wrap(async (req, res) => {
    const budget = await requireBudget(req, res);
    if (!budget) return;
    const v = logic.validateExpense(req.body, budget);
    if (!v.ok) return res.status(400).json({ error: 'Invalid expense', details: v.errors });

    // Convert once, at logging time, and save the rate so history never shifts.
    const r = await rates.getRate(v.value.currency, budget.homeCurrency);
    const saved = await store.addExpense({
      tripId: req.params.tripId,
      ...v.value,
      rateUsed: r.rate,
      rateDate: r.date,
      amountHome: logic.toHome(v.value.amount, r.rate),
    });
    res.status(201).json(saved);
  }));

  router.put('/expenses/:id', wrap(async (req, res) => {
    const existing = await store.getExpense(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Expense not found' });
    const budget = await store.getBudget(existing.tripId);

    const v = logic.validateExpense({ ...existing, ...req.body }, budget);
    if (!v.ok) return res.status(400).json({ error: 'Invalid expense', details: v.errors });

    // Re-convert only if amount or currency changed; otherwise keep the saved rate.
    let { rateUsed, rateDate } = existing;
    if (v.value.currency !== existing.currency) {
      const r = await rates.getRate(v.value.currency, budget.homeCurrency);
      rateUsed = r.rate;
      rateDate = r.date;
    }
    const updated = await store.updateExpense(existing.id, {
      ...v.value,
      rateUsed,
      rateDate,
      amountHome: logic.toHome(v.value.amount, rateUsed),
    });
    res.json(updated);
  }));

  router.delete('/expenses/:id', wrap(async (req, res) => {
    const ok = await store.deleteExpense(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Expense not found' });
    res.status(204).end();
  }));

  // --- errors --------------------------------------------------------------
  router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
  });

  return router;
}

function createApp({ store, rates }) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', createRouter({ store, rates }));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  return app;
}

module.exports = { createApp, createRouter };
