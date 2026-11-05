// Shared by the itinerary tests (not a test itself, so `node --test server/test/itinerary*.test.js` skips it).
//   startApp(store)   the real itinerary routes on a throwaway Express app, with a fake sign-in
//   fakeMongoDb()     just enough of the MongoDB driver for itineraryStore.js, to run without a database

const express = require('express');
const { mountItinerary } = require('../src/itinerary/itineraryRoutes');

// People the tests can act as. The fake sign-in reads the `x-user-id` header; the real server reads the session cookie.
const USERS = {
  alice: { id: 'alice', name: 'Alice', email: 'alice@example.com' },
  bob: { id: 'bob', name: 'Bob', email: 'bob@example.com' },
  cara: { id: 'cara', name: 'Cara', email: 'cara@example.com' },
};

const users = {
  async findUserById(id) {
    return USERS[id] ? { ...USERS[id] } : null;
  },
  async findUserByEmail(email) {
    const user = Object.values(USERS).find((u) => u.email === email);
    return user ? { ...user } : null;
  },
};

function requireAuth(req, res, next) {
  const user = USERS[req.get('x-user-id')];
  if (!user) return res.status(401).json({ error: 'Please log in to continue' });
  req.user = { ...user };
  return next();
}

async function startApp(store, extra = {}) {
  const app = express();
  app.use(express.json());
  mountItinerary(app, { store, requireAuth, users, ...extra });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  // call(method, url, body, as): `as` is the signed-in user ('alice' unless said otherwise, null = nobody)
  const call = async (method, url, body, as = 'alice') => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(as ? { 'x-user-id': as } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return { server, call, close: () => new Promise((resolve) => server.close(resolve)) };
}

// ---- a tiny in-memory stand-in for the MongoDB driver --------------------------------------------
// Supports exactly what itineraryStore.js uses: equality filters (a filter on an array field matches when the
// array contains the value, like MongoDB), sort, $set / $addToSet, and the collection methods below.

const matches = (doc, filter) =>
  Object.entries(filter).every(([key, want]) => {
    const have = doc[key];
    return Array.isArray(have) ? have.includes(want) : have === want;
  });

function fakeCollection() {
  let docs = [];
  const copy = (x) => (x == null ? null : structuredClone(x));
  return {
    async createIndexes() {},
    find(filter) {
      let list = docs.filter((d) => matches(d, filter));
      const cursor = {
        sort(spec) {
          const keys = Object.entries(spec);
          list = [...list].sort((a, b) => {
            for (const [k, dir] of keys) {
              const c = String(a[k] ?? '').localeCompare(String(b[k] ?? ''));
              if (c) return c * dir;
            }
            return 0;
          });
          return cursor;
        },
        async toArray() {
          return copy(list);
        },
      };
      return cursor;
    },
    async findOne(filter) {
      return copy(docs.find((d) => matches(d, filter)));
    },
    async insertOne(doc) {
      docs.push(copy(doc));
    },
    async findOneAndUpdate(filter, update) {
      const doc = docs.find((d) => matches(d, filter));
      if (!doc) return null;
      Object.assign(doc, update.$set);
      for (const [k, v] of Object.entries(update.$addToSet ?? {})) if (!doc[k].includes(v)) doc[k].push(v);
      return copy(doc);
    },
    async deleteOne(filter) {
      const i = docs.findIndex((d) => matches(d, filter));
      if (i >= 0) docs.splice(i, 1);
    },
    async deleteMany(filter) {
      docs = docs.filter((d) => !matches(d, filter));
    },
  };
}

function fakeMongoDb() {
  const collections = new Map();
  const db = { collection: (name) => collections.get(name) ?? collections.set(name, fakeCollection()).get(name) };
  return async () => db; // the shape of createMongo().database
}

module.exports = { USERS, users, requireAuth, startApp, fakeMongoDb };
