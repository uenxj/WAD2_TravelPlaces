// Pure helpers for accounts: validation, password hashing, session tokens, cookies and a
// small login rate limiter. No Express or MongoDB in here, so it is easy to unit test.

const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

const SESSION_MS = 7 * 24 * 60 * 60 * 1000; // a login lasts 7 days
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD = 200; // bounds the work one request can ask the server to do

const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

function validateSignup(body) {
  const errors = [];
  const name = String(body?.name ?? '').trim();
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!name || name.length > 100) errors.push('Name is required (up to 100 characters)');
  if (!EMAIL_RE.test(email) || email.length > 254) errors.push('Enter a valid email address');
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (password.length > MAX_PASSWORD) errors.push(`Password must be at most ${MAX_PASSWORD} characters`);
  return errors.length ? { ok: false, errors } : { ok: true, value: { name, email, password } };
}

function validateLogin(body) {
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || email.length > 254 || !password || password.length > MAX_PASSWORD) {
    return { ok: false, errors: ['Enter your email and password'] };
  }
  return { ok: true, value: { email, password } };
}

// Stored as "scrypt$N$r$p$salt$hash" so the cost can be raised later without breaking old accounts.
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

async function verifyPassword(password, stored) {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  if (!salt.length || !expected.length) return false;
  const actual = await scrypt(password, salt, expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

// The browser holds the random token; the database only holds its SHA-256, so a leaked
// database cannot be used to log in as someone.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
function newSessionToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email });

function parseCookies(header) {
  const cookies = {};
  for (const part of String(header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const key = part.slice(0, i).trim();
    try { cookies[key] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore a malformed cookie */ }
  }
  return cookies;
}

// HttpOnly: page scripts cannot read it. SameSite=Lax: other sites cannot send it with a POST.
function sessionCookie(name, token, { secure = false, maxAgeMs = SESSION_MS } = {}) {
  return `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure ? '; Secure' : ''}`;
}
const clearCookie = (name, secure = false) => `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;

/**
 * Counts failed logins per key (email + IP). After `max` failures the key is blocked until
 * the window passes. In memory only, which is enough for a single server process.
 */
function createRateLimiter({ max = 10, windowMs = 15 * 60 * 1000, now = Date.now } = {}) {
  const failures = new Map(); // key -> { count, resetAt }
  return {
    /** Seconds to wait if the key is blocked, otherwise 0. */
    check(key) {
      const entry = failures.get(key);
      if (!entry) return 0;
      if (now() >= entry.resetAt) { failures.delete(key); return 0; }
      return entry.count >= max ? Math.ceil((entry.resetAt - now()) / 1000) : 0;
    },
    fail(key) {
      const entry = failures.get(key);
      if (!entry || now() >= entry.resetAt) failures.set(key, { count: 1, resetAt: now() + windowMs });
      else entry.count += 1;
      if (failures.size > 5000) failures.delete(failures.keys().next().value); // keep memory bounded
    },
    reset(key) { failures.delete(key); },
  };
}

module.exports = {
  SESSION_MS,
  normalizeEmail,
  validateSignup,
  validateLogin,
  hashPassword,
  verifyPassword,
  hashToken,
  newSessionToken,
  publicUser,
  parseCookies,
  sessionCookie,
  clearCookie,
  createRateLimiter,
};
