// Storage for trips and their activities. Two interchangeable versions with the same methods
// (the routes do not know or care which one is running):
//   createMongoStore  MongoDB (collections `itinerary_trips` and `itinerary_items`), used when MONGODB_URI is set
//   createLocalStore  a JSON file (server/data/itinerary.json, ignored by Git), for running without a database
//
// trips: listForUser(userId), create(data), get(id), update(id, fields), addMember(id, userId), remove(id)
// items: listByTrip(tripId), get(id), create(data), update(id, fields), remove(id)
// get / update return null when nothing matches. Ids are strings (UUIDs), so they fit /api/trips/:tripId
// next to the budget and checklist, which also key everything by tripId.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const now = () => new Date();

const newTrip = (data) => ({ ...data, _id: crypto.randomUUID(), createdAt: now(), updatedAt: now() });

const ITEM_DEFAULTS = () => ({
  type: 'place',
  placeId: '',
  location: { address: '' },
  cost: 0,
  setting: 'indoor',
  notes: '',
  updatedBy: '',
});
const newItem = (data) => ({ ...ITEM_DEFAULTS(), ...data, _id: crypto.randomUUID(), createdAt: now(), updatedAt: now() });

/** `database` returns a Promise<Db>: the server's shared connection (../mongo.js). */
function createMongoStore({ database }) {
  let ready = null;

  function collections() {
    if (!ready) {
      ready = (async () => {
        const db = await database();
        const trips = db.collection('itinerary_trips');
        const items = db.collection('itinerary_items');
        await trips.createIndexes([{ key: { memberIds: 1, startDate: 1 }, name: 'member_start' }]);
        await items.createIndexes([{ key: { tripId: 1, date: 1, startTime: 1 }, name: 'trip_schedule' }]);
        return { trips, items };
      })().catch((err) => {
        ready = null; // try again on the next request
        throw err;
      });
    }
    return ready;
  }

  const update = (collection) => async (id, fields) => {
    const col = (await collections())[collection];
    return col.findOneAndUpdate({ _id: id }, { $set: { ...fields, updatedAt: now() } }, { returnDocument: 'after' });
  };

  return {
    trips: {
      async listForUser(userId) {
        const { trips } = await collections();
        return trips.find({ memberIds: userId }).sort({ startDate: 1, _id: 1 }).toArray();
      },
      async create(data) {
        const { trips } = await collections();
        const trip = newTrip(data);
        await trips.insertOne({ ...trip });
        return trip;
      },
      async get(id) {
        const { trips } = await collections();
        return trips.findOne({ _id: id });
      },
      update: update('trips'),
      async addMember(id, userId) {
        const { trips } = await collections();
        return trips.findOneAndUpdate(
          { _id: id },
          { $addToSet: { memberIds: userId }, $set: { updatedAt: now() } },
          { returnDocument: 'after' },
        );
      },
      async remove(id) {
        const { trips, items } = await collections();
        await items.deleteMany({ tripId: id });
        await trips.deleteOne({ _id: id });
      },
    },
    items: {
      async listByTrip(tripId) {
        const { items } = await collections();
        return items.find({ tripId }).toArray();
      },
      async get(id) {
        const { items } = await collections();
        return items.findOne({ _id: id });
      },
      async create(data) {
        const { items } = await collections();
        const item = newItem(data);
        await items.insertOne({ ...item });
        return item;
      },
      update: update('items'),
      async remove(id) {
        const { items } = await collections();
        await items.deleteOne({ _id: id });
      },
    },
  };
}

/** Everything lives in one JSON file, rewritten after every change. Fine for local testing. */
function createLocalStore(file) {
  let db = { trips: [], items: [] };
  try {
    db = { ...db, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const save = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(db, null, 2));
  };
  const copy = (x) => (x == null ? null : structuredClone(x));
  const stamp = (obj) => ({ ...obj, createdAt: obj.createdAt.toISOString(), updatedAt: obj.updatedAt.toISOString() });

  return {
    trips: {
      async listForUser(userId) {
        return copy(
          db.trips.filter((t) => t.memberIds.includes(userId)).sort((a, b) => a.startDate.localeCompare(b.startDate)),
        );
      },
      async create(data) {
        const trip = stamp(newTrip(data));
        db.trips.push(trip);
        save();
        return copy(trip);
      },
      async get(id) {
        return copy(db.trips.find((t) => t._id === id));
      },
      async update(id, fields) {
        const trip = db.trips.find((t) => t._id === id);
        if (!trip) return null;
        Object.assign(trip, fields, { updatedAt: now().toISOString() });
        save();
        return copy(trip);
      },
      async addMember(id, userId) {
        const trip = db.trips.find((t) => t._id === id);
        if (trip && !trip.memberIds.includes(userId)) trip.memberIds.push(userId);
        save();
        return copy(trip);
      },
      async remove(id) {
        db.trips = db.trips.filter((t) => t._id !== id);
        db.items = db.items.filter((i) => i.tripId !== id);
        save();
      },
    },
    items: {
      async listByTrip(tripId) {
        return copy(db.items.filter((i) => i.tripId === tripId));
      },
      async get(id) {
        return copy(db.items.find((i) => i._id === id));
      },
      async create(data) {
        const item = stamp(newItem(data));
        db.items.push(item);
        save();
        return copy(item);
      },
      async update(id, fields) {
        const item = db.items.find((i) => i._id === id);
        if (!item) return null;
        Object.assign(item, fields, { updatedAt: now().toISOString() });
        save();
        return copy(item);
      },
      async remove(id) {
        db.items = db.items.filter((i) => i._id !== id);
        save();
      },
    },
  };
}

module.exports = { createMongoStore, createLocalStore };
