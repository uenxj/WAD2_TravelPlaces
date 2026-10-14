// Tiny storage layer: in-memory with optional JSON-file persistence.
// Every method is async so you can swap this file for MongoDB/Firebase/Supabase
// later without touching routes or logic. Keep the same method names.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function createStore(filePath) {
  let db = { budgets: {}, expenses: [] }; // budgets keyed by tripId

  if (filePath && fs.existsSync(filePath)) {
    try {
      db = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.warn('Could not read data file, starting fresh:', e.message);
    }
  }

  function persist() {
    if (!filePath) return;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, filePath);
  }

  return {
    async getBudget(tripId) {
      return db.budgets[tripId] || null;
    },
    async saveBudget(tripId, budget) {
      db.budgets[tripId] = { tripId, ...budget, updatedAt: new Date().toISOString() };
      persist();
      return db.budgets[tripId];
    },
    async listExpenses(tripId) {
      return db.expenses
        .filter((e) => e.tripId === tripId)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    },
    async getExpense(id) {
      return db.expenses.find((e) => e.id === id) || null;
    },
    async addExpense(expense) {
      const saved = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...expense };
      db.expenses.push(saved);
      persist();
      return saved;
    },
    async updateExpense(id, patch) {
      const i = db.expenses.findIndex((e) => e.id === id);
      if (i === -1) return null;
      db.expenses[i] = { ...db.expenses[i], ...patch, id, updatedAt: new Date().toISOString() };
      persist();
      return db.expenses[i];
    },
    async deleteExpense(id) {
      const i = db.expenses.findIndex((e) => e.id === id);
      if (i === -1) return false;
      db.expenses.splice(i, 1);
      persist();
      return true;
    },
  };
}

module.exports = { createStore };
