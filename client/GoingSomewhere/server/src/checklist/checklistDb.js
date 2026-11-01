// MongoDB access for the checklist. One client is shared for the whole server;
// the driver pools connections and reconnects on its own.
//
// Config (environment variables, see server/.env.example):
//   MONGODB_URI  e.g. mongodb://127.0.0.1:27017 or a MongoDB Atlas SRV string
//   MONGODB_DB   database name (default: goingsomewhere)

const { MongoClient } = require('mongodb');

const COLLECTION = 'checklist_items';

function unavailable(message, cause) {
  const err = new Error(message);
  err.status = 503;
  err.cause = cause;
  return err;
}

function createChecklistDb({
  uri = process.env.MONGODB_URI,
  dbName = process.env.MONGODB_DB || 'goingsomewhere',
  timeoutMs = 4000,
} = {}) {
  let client = null;
  let ready = null; // Promise<Collection> once a connect attempt is in flight

  async function connect() {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: timeoutMs });
    await client.connect();
    const col = client.db(dbName).collection(COLLECTION);
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
  }

  /** Resolve the collection, connecting on first use. Failed attempts are retried on the next call. */
  function collection() {
    if (!uri) {
      return Promise.reject(unavailable('Checklist storage is not configured (MONGODB_URI is not set)'));
    }
    if (!ready) {
      ready = connect().catch(async (err) => {
        ready = null;
        await client?.close().catch(() => {});
        throw unavailable('Could not connect to the checklist database', err);
      });
    }
    return ready;
  }

  async function close() {
    ready = null;
    await client?.close();
  }

  return { collection, close };
}

/** True for driver errors that mean "the database is unreachable", as opposed to a bad request. */
function isConnectionError(err) {
  return /^Mongo(ServerSelection|Network|NetworkTimeout|NotConnected|TopologyClosed)Error$/.test(err?.name || '');
}

module.exports = { createChecklistDb, isConnectionError, COLLECTION };
