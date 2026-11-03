// Shared MongoDB connection for the server (used by the checklist and the budget planner).
// One client for the whole server; the driver pools connections and reconnects on its own.
//
// Config (environment variables, in server/.env):
//   MONGODB_URI  e.g. mongodb://127.0.0.1:27017 or a MongoDB Atlas connection string
//   MONGODB_DB   database name (default: goingsomewhere)

const { MongoClient } = require('mongodb');

function unavailable(message, cause) {
  const err = new Error(message);
  err.status = 503;
  err.cause = cause;
  return err;
}

function createMongo({
  uri = process.env.MONGODB_URI,
  dbName = process.env.MONGODB_DB || 'goingsomewhere',
  timeoutMs = 4000,
} = {}) {
  let client = null;
  let ready = null; // Promise<Db> once a connect attempt is in flight

  /** The database, connecting on first use. Failed attempts are retried on the next call. */
  function database() {
    if (!uri) return Promise.reject(unavailable('Database is not configured (MONGODB_URI is not set)'));
    if (!ready) {
      ready = (async () => {
        client = new MongoClient(uri, { serverSelectionTimeoutMS: timeoutMs });
        await client.connect();
        return client.db(dbName);
      })().catch(async (err) => {
        ready = null;
        await client?.close().catch(() => {});
        throw unavailable('Could not connect to the database', err);
      });
    }
    return ready;
  }

  async function close() {
    ready = null;
    await client?.close();
  }

  return { database, close };
}

/** True for driver errors that mean "the database is unreachable", as opposed to a bad request. */
function isConnectionError(err) {
  return /^Mongo(ServerSelection|Network|NetworkTimeout|NotConnected|TopologyClosed)Error$/.test(err?.name || '');
}

module.exports = { createMongo, isConnectionError };
