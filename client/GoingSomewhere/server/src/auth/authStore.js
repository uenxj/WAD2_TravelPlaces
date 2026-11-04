// Storage for accounts. Two interchangeable versions with the same methods:
//   createAuthStore       MongoDB (collections `users` and `sessions`), used when MONGODB_URI is set
//   createMemoryAuthStore in memory, used for tests and for running without a database
//
// Methods (all async):
//   createUser({ name, email, passwordHash }) -> user, or null if the email is already taken
//   findUserByEmail(email), findUserById(id)  -> user or null
//   createSession(userId, tokenHash, expiresAt)
//   findSession(tokenHash)                    -> { userId, expiresAt } or null (expired = null)
//   deleteSession(tokenHash)

const crypto = require('crypto');

const newUser = ({ name, email, passwordHash }) => ({
  id: crypto.randomUUID(), name, email, passwordHash, createdAt: new Date(),
});

/** `database` returns a Promise<Db>: the server's shared connection (mongo.js). */
function createAuthStore({ database }) {
  let ready = null;

  function collections() {
    if (!ready) {
      ready = (async () => {
        const db = await database();
        const users = db.collection('users');
        const sessions = db.collection('sessions');
        await users.createIndexes([
          { key: { email: 1 }, name: 'user_email', unique: true },
          { key: { id: 1 }, name: 'user_id', unique: true },
        ]);
        await sessions.createIndexes([
          { key: { tokenHash: 1 }, name: 'session_token', unique: true },
          // MongoDB deletes a session by itself once its expiresAt has passed.
          { key: { expiresAt: 1 }, name: 'session_expiry', expireAfterSeconds: 0 },
        ]);
        return { users, sessions };
      })().catch((err) => {
        ready = null; // try again on the next request
        throw err;
      });
    }
    return ready;
  }

  const plain = (doc) => {
    if (!doc) return null;
    const { _id, ...rest } = doc; // eslint-disable-line no-unused-vars
    return rest;
  };

  // Database down or not configured -> a 503 the routes can pass on.
  async function run(fn) {
    try {
      return await fn(await collections());
    } catch (err) {
      const { isConnectionError } = require('../mongo'); // loaded here so the in-memory store needs no MongoDB driver
      if (err.status === 503 || isConnectionError(err)) {
        const e = new Error('Accounts are unavailable right now. Please try again shortly.');
        e.status = 503;
        e.cause = err;
        throw e;
      }
      throw err;
    }
  }

  return {
    createUser: (fields) => run(async ({ users }) => {
      const user = newUser(fields);
      try {
        await users.insertOne({ ...user });
        return user;
      } catch (err) {
        if (err.code === 11000) return null; // duplicate email
        throw err;
      }
    }),
    findUserByEmail: (email) => run(async ({ users }) => plain(await users.findOne({ email }))),
    findUserById: (id) => run(async ({ users }) => plain(await users.findOne({ id }))),
    createSession: (userId, tokenHash, expiresAt) => run(async ({ sessions }) => {
      await sessions.insertOne({ userId, tokenHash, expiresAt, createdAt: new Date() });
    }),
    findSession: (tokenHash) => run(async ({ sessions }) => {
      const doc = await sessions.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
      return doc ? { userId: doc.userId, expiresAt: doc.expiresAt } : null;
    }),
    deleteSession: (tokenHash) => run(async ({ sessions }) => {
      await sessions.deleteOne({ tokenHash });
    }),
  };
}

function createMemoryAuthStore({ now = () => Date.now() } = {}) {
  const users = new Map(); // id -> user
  const sessions = new Map(); // tokenHash -> { userId, expiresAt }
  return {
    async createUser(fields) {
      if ([...users.values()].some((u) => u.email === fields.email)) return null;
      const user = newUser(fields);
      users.set(user.id, user);
      return { ...user };
    },
    async findUserByEmail(email) {
      const user = [...users.values()].find((u) => u.email === email);
      return user ? { ...user } : null;
    },
    async findUserById(id) {
      const user = users.get(id);
      return user ? { ...user } : null;
    },
    async createSession(userId, tokenHash, expiresAt) {
      sessions.set(tokenHash, { userId, expiresAt });
    },
    async findSession(tokenHash) {
      const session = sessions.get(tokenHash);
      if (!session) return null;
      if (session.expiresAt.getTime() <= now()) { sessions.delete(tokenHash); return null; }
      return { ...session };
    },
    async deleteSession(tokenHash) {
      sessions.delete(tokenHash);
    },
  };
}

module.exports = { createAuthStore, createMemoryAuthStore };
