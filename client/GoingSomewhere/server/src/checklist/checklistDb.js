// MongoDB access for the checklist: the `checklist_items` collection and its indexes,
// on the server's shared connection (../mongo.js).

const { createMongo } = require('../mongo');

const COLLECTION = 'checklist_items';

/**
 * `mongo` is the server's shared connection; tests may instead pass connection options
 * (uri, dbName) and get their own.
 */
function createChecklistDb({ mongo, ...options } = {}) {
  const shared = mongo ?? createMongo(options);
  let ready = null; // Promise<Collection> once set up

  /** Resolve the collection, setting up its indexes on first use. Failures are retried next time. */
  function collection() {
    if (!ready) {
      ready = shared.database().then(async (db) => {
        const col = db.collection(COLLECTION);
        await col.createIndexes([
          { key: { tripId: 1, createdAt: 1 }, name: 'trip_created' },
          // A catalogue item (default or suggestion) can only appear once per trip.
          {
            key: { tripId: 1, suggestionKey: 1 },
            name: 'trip_suggestion_unique',
            unique: true,
            partialFilterExpression: { suggestionKey: { $type: 'string' } },
          },
        ]);
        return col;
      }).catch((err) => {
        ready = null;
        throw err;
      });
    }
    return ready;
  }

  return { collection, close: shared.close };
}

module.exports = { createChecklistDb };
