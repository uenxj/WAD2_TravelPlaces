// Local fallback for the checklist when MONGODB_URI is not set: the same items kept in one JSON
// file (rewritten after every change), like the other features' local stores. Fine for local
// testing, not for the shared app.
//
// It offers exactly the collection methods checklistRoutes.js uses, with the same behaviour
// (including "a catalogue item only once per trip"), so the routes don't need to know which
// storage they are on.

const fs = require('fs');
const path = require('path');
const { ObjectId } = require('mongodb');

const key = (v) => (v instanceof ObjectId ? v.toHexString() : v);

// filter: { field: value } or { field: { $in: [values] } }
function matches(doc, filter) {
  return Object.entries(filter).every(([field, want]) =>
    want && typeof want === 'object' && Array.isArray(want.$in)
      ? want.$in.some((v) => key(v) === key(doc[field]))
      : key(want) === key(doc[field]));
}

const byCreated = (a, b) => a.createdAt - b.createdAt || key(a._id).localeCompare(key(b._id));
const duplicateKey = () => Object.assign(new Error('duplicate key'), { code: 11000 });

function createLocalChecklistDb(file) {
  let docs = [];
  try {
    docs = JSON.parse(fs.readFileSync(file, 'utf8')).map((d) => ({
      ...d, _id: new ObjectId(d._id), createdAt: new Date(d.createdAt), updatedAt: new Date(d.updatedAt),
    }));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const save = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(docs.map((d) => ({ ...d, _id: d._id.toHexString() })), null, 2));
  };
  const copy = (d) => (d ? { ...d } : null);
  // Same rule as the unique index in checklistDb.js: one suggestionKey per trip.
  const taken = (doc) => typeof doc.suggestionKey === 'string' &&
    docs.some((d) => d.tripId === doc.tripId && d.suggestionKey === doc.suggestionKey);

  const collection = {
    find: (filter) => ({
      sort: () => ({ toArray: async () => docs.filter((d) => matches(d, filter)).sort(byCreated).map(copy) }),
    }),
    async findOne(filter) {
      return copy(docs.find((d) => matches(d, filter)));
    },
    async insertOne(doc) {
      if (taken(doc)) throw duplicateKey();
      const saved = { ...doc, _id: new ObjectId() };
      docs.push(saved);
      save();
      return { insertedId: saved._id };
    },
    // Only what the batch route sends: updateOne + upsert + $setOnInsert.
    async bulkWrite(ops) {
      const upsertedIds = {};
      ops.forEach(({ updateOne: { filter, update } }, i) => {
        if (docs.some((d) => matches(d, filter))) return; // already there: left untouched
        const saved = { ...update.$setOnInsert, _id: new ObjectId() };
        docs.push(saved);
        upsertedIds[i] = saved._id;
      });
      save();
      return { upsertedIds };
    },
    async findOneAndUpdate(filter, update) {
      const doc = docs.find((d) => matches(d, filter));
      if (!doc) return null;
      Object.assign(doc, update.$set);
      save();
      return copy(doc);
    },
    async deleteOne(filter) {
      const before = docs.length;
      docs = docs.filter((d) => !matches(d, filter));
      save();
      return { deletedCount: before - docs.length };
    },
    async drop() {
      docs = [];
      save();
    },
  };

  return { collection: async () => collection, close: async () => {} };
}

module.exports = { createLocalChecklistDb };
