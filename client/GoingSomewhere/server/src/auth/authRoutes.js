const logic = require('./authLogic');

const COOKIE = 'gs_session';

/**
 * Account API (JSON; errors are { error, details? } like the budget and checklist APIs):
 *   POST /api/auth/signup  { name, email, password } -> 201 { user }   and sets the session cookie
 *   POST /api/auth/login   { email, password }       -> 200 { user }   and sets the session cookie
 *   POST /api/auth/logout                            -> 204            and clears the cookie
 *   GET  /api/auth/me                                -> 200 { user } or 401 { error }
 *
 * The handlers only use req.body / req.headers / req.ip and res.status().json() / setHeader(),
 * so the tests can call them with plain fake objects, without starting Express.
 */
function createAuthHandlers({ store, secureCookie = false, limiter = logic.createRateLimiter(), now = () => Date.now() }) {
  // A real hash to compare against when the email is unknown, so "no such user" takes as
  // long as "wrong password" and the response time does not reveal which emails exist.
  let dummy = null;
  const dummyHash = () => (dummy ??= logic.hashPassword('not-a-real-password'));

  async function startSession(res, user) {
    const { token, tokenHash } = logic.newSessionToken();
    await store.createSession(user.id, tokenHash, new Date(now() + logic.SESSION_MS));
    res.setHeader('Set-Cookie', logic.sessionCookie(COOKIE, token, { secure: secureCookie }));
  }

  /** The signed-in user for this request, or null. */
  async function authenticate(req) {
    const token = logic.parseCookies(req.headers?.cookie)[COOKIE];
    if (!token) return null;
    const session = await store.findSession(logic.hashToken(token));
    return session ? store.findUserById(session.userId) : null;
  }

  async function signup(req, res) {
    const v = logic.validateSignup(req.body);
    if (!v.ok) return res.status(400).json({ error: 'Invalid sign-up details', details: v.errors });
    const passwordHash = await logic.hashPassword(v.value.password);
    const user = await store.createUser({ name: v.value.name, email: v.value.email, passwordHash });
    if (!user) return res.status(409).json({ error: 'An account with this email already exists' });
    await startSession(res, user);
    return res.status(201).json({ user: logic.publicUser(user) });
  }

  async function login(req, res) {
    const v = logic.validateLogin(req.body);
    if (!v.ok) return res.status(400).json({ error: 'Invalid login details', details: v.errors });

    const key = `${req.ip ?? ''}|${v.value.email}`;
    const wait = limiter.check(key);
    if (wait) {
      res.setHeader('Retry-After', String(wait));
      return res.status(429).json({ error: 'Too many failed attempts. Please try again later.' });
    }

    const user = await store.findUserByEmail(v.value.email);
    const ok = await logic.verifyPassword(v.value.password, user ? user.passwordHash : await dummyHash());
    if (!user || !ok) {
      limiter.fail(key);
      return res.status(401).json({ error: 'Incorrect email or password' });
    }
    limiter.reset(key);
    await startSession(res, user);
    return res.json({ user: logic.publicUser(user) });
  }

  async function logout(req, res) {
    const token = logic.parseCookies(req.headers?.cookie)[COOKIE];
    if (token) await store.deleteSession(logic.hashToken(token));
    res.setHeader('Set-Cookie', logic.clearCookie(COOKIE, secureCookie));
    return res.status(204).end();
  }

  async function me(req, res) {
    const user = await authenticate(req);
    if (!user) {
      if (req.headers?.cookie?.includes(COOKIE)) res.setHeader('Set-Cookie', logic.clearCookie(COOKIE, secureCookie));
      return res.status(401).json({ error: 'Not signed in' });
    }
    return res.json({ user: logic.publicUser(user) });
  }

  /**
   * Express middleware for routes that need a signed-in user (sets req.user).
   * Not applied to the budget or checklist routes yet; see the handoff notes.
   */
  async function requireAuth(req, res, next) {
    try {
      const user = await authenticate(req);
      if (!user) return res.status(401).json({ error: 'Please log in to continue' });
      req.user = logic.publicUser(user);
      return next();
    } catch (err) {
      return next(err);
    }
  }

  return { signup, login, logout, me, requireAuth, authenticate };
}

function handleAuthError(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' });
  if (err.status === 503) {
    console.error('[auth]', err.message, err.cause?.message || '');
    return res.status(503).json({ error: 'Accounts are unavailable right now. Please try again shortly.' });
  }
  console.error('[auth]', err);
  return res.status(500).json({ error: 'Server error' });
}

/** Mount the account API on an existing Express app (after its JSON body parser). */
function mountAuth(app, { store, secureCookie = false }) {
  const express = require('express'); // loaded here so tests of the handlers need no Express
  const handlers = createAuthHandlers({ store, secureCookie });
  const router = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  router.post('/auth/signup', wrap(handlers.signup));
  router.post('/auth/login', wrap(handlers.login));
  router.post('/auth/logout', wrap(handlers.logout));
  router.get('/auth/me', wrap(handlers.me));
  router.use('/auth', handleAuthError);

  app.use('/api', router);
  app.use('/api/auth', handleAuthError); // also covers errors raised before the router, such as bad JSON
  return handlers;
}

module.exports = { createAuthHandlers, mountAuth, COOKIE };
