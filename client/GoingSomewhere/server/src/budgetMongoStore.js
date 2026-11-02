// MongoDB version of store.js for the budget planner: same seven methods, same return
// values, so app.js and budgetLogic.js work unchanged. server.js uses it when MONGODB_URI
// is set (shared team database) and falls back to the JSON-file store otherwise.
//
// Collections: `budgets` (one document per trip, _id = tripId) and `expenses`.

const crypto = require('crypto');
const { isConnectionError } = require('./checklist/checklistDb');

/** `database` returns a Promise<Db>, e.g. createChecklistDb().database (one shared connection). */
function createMongoStore({ database }) {
  let ready = null;

  function collections() {
    if (!ready) {
      ready = (async () => {
        const db = await database();
        const budgets = db.collection('budgets');
        const expenses = db.collection('expenses');
        await expenses.createIndexes([
          { key: { id: 1 }, name: 'expense_id', unique: true },
          { key: { tripId: 1, date: -1 }, name: 'trip_date' },
        ]);
        return { budgets, expenses };
      })().catch((err) => {
        ready = null; // try again on the next request
        throw err;
      });
    }
    return ready;
  }

  // Match the JSON store: plain objects without Mongo's _id, undefined fields dropped.
  const plain = (doc) => {
    if (!doc) return null;
    const { _id, ...rest } = doc; // eslint-disable-line no-unused-vars
    return rest;
  };
  const clean = (obj) => JSON.parse(JSON.stringify(obj));

  // Database down -> 503 with a budget message (app.js sends err.status and err.message).
  async function run(fn) {
    try {
      return await fn(await collections());
    } catch (err) {
      if (err.status === 503 || isConnectionError(err)) {
        const e = new Error('Budget storage is unavailable. Please try again shortly.');
        e.status = 503;
        e.cause = err;
        throw e;
      }
      throw err;
    }
  }

  return {
    getBudget: (tripId) => run(async ({ budgets }) => plain(await budgets.findOne({ _id: tripId }))),

    saveBudget: (tripId, budget) => run(async ({ budgets }) => {
      const doc = clean({ tripId, ...budget, updatedAt: new Date().toISOString() });
      await budgets.replaceOne({ _id: tripId }, doc, { upsert: true });
      return doc;
    }),

    // Newest date first; same-date expenses stay in the order they were added (like the JSON store).
    listExpenses: (tripId) => run(async ({ expenses }) =>
      (await expenses.find({ tripId }).sort({ date: -1, createdAt: 1, _id: 1 }).toArray()).map(plain)),

    getExpense: (id) => run(async ({ expenses }) => plain(await expenses.findOne({ id }))),

    addExpense: (expense) => run(async ({ expenses }) => {
      const saved = clean({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...expense });
      await expenses.insertOne({ ...saved });
      return saved;
    }),

    updateExpense: (id, patch) => run(async ({ expenses }) => plain(await expenses.findOneAndUpdate(
      { id },
      { $set: clean({ ...patch, id, updatedAt: new Date().toISOString() }) },
      { returnDocument: 'after' },
    ))),

    deleteExpense: (id) => run(async ({ expenses }) => (await expenses.deleteOne({ id })).deletedCount === 1),
  };
}

module.exports = { createMongoStore };
