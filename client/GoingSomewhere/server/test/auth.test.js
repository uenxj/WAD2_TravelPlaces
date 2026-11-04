const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../src/auth/authLogic');
const { createMemoryAuthStore } = require('../src/auth/authStore');
const { createAuthHandlers, COOKIE } = require('../src/auth/authRoutes');

// Plain fakes: the handlers only need these few members, so no Express is started.
function fakeRes() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(key, value) { this.headers[key] = value; },
    end() { return this; },
  };
}
const cookieFrom = (res) => (res.headers['Set-Cookie'] ?? '').split(';')[0]; // "gs_session=<token>"
const req = (body, cookie, ip = '1.2.3.4') => ({ body, headers: cookie ? { cookie } : {}, ip });
const newApi = (options = {}) => {
  const store = createMemoryAuthStore();
  return { store, api: createAuthHandlers({ store, ...options }) };
};
const SIGNUP = { name: ' Seth ', email: ' Seth@Example.com ', password: 'correct horse battery' };

describe('authLogic', () => {
  test('sign-up: trims and lower-cases, rejects bad fields', () => {
    const ok = logic.validateSignup(SIGNUP);
    assert.deepEqual(ok.value, { name: 'Seth', email: 'seth@example.com', password: 'correct horse battery' });
    const bad = logic.validateSignup({ name: '', email: 'nope', password: 'short' });
    assert.equal(bad.ok, false);
    assert.equal(bad.errors.length, 3);
    assert.equal(logic.validateSignup({ ...SIGNUP, password: 'x'.repeat(201) }).ok, false);
    assert.equal(logic.validateSignup({ ...SIGNUP, password: 12345678 }).ok, false);
  });

  test('login: needs an email and a password', () => {
    assert.equal(logic.validateLogin({ email: 'a@b.co', password: 'x' }).ok, true);
    assert.equal(logic.validateLogin({ email: 'a@b.co' }).ok, false);
    assert.equal(logic.validateLogin(undefined).ok, false);
  });

  test('passwords are salted and verify only when correct', async () => {
    const a = await logic.hashPassword('hunter2hunter2');
    const b = await logic.hashPassword('hunter2hunter2');
    assert.notEqual(a, b);
    assert.ok(a.startsWith('scrypt$'));
    assert.equal(await logic.verifyPassword('hunter2hunter2', a), true);
    assert.equal(await logic.verifyPassword('hunter3hunter3', a), false);
    assert.equal(await logic.verifyPassword('anything', 'not-a-hash'), false);
  });

  test('session tokens are random and only their hash is kept', () => {
    const a = logic.newSessionToken();
    const b = logic.newSessionToken();
    assert.notEqual(a.token, b.token);
    assert.equal(a.tokenHash, logic.hashToken(a.token));
    assert.notEqual(a.tokenHash, a.token);
  });

  test('cookies: parsed, HttpOnly and SameSite, Secure only when asked', () => {
    assert.deepEqual(logic.parseCookies('a=1; gs_session=abc%20def; b'), { a: '1', gs_session: 'abc def' });
    const c = logic.sessionCookie('gs_session', 'tok');
    assert.match(c, /HttpOnly/);
    assert.match(c, /SameSite=Lax/);
    assert.doesNotMatch(c, /Secure/);
    assert.match(logic.sessionCookie('gs_session', 'tok', { secure: true }), /; Secure/);
    assert.match(logic.clearCookie('gs_session'), /Max-Age=0/);
  });

  test('rate limiter blocks after max failures, then lets the key back in', () => {
    let t = 0;
    const limiter = logic.createRateLimiter({ max: 3, windowMs: 1000, now: () => t });
    for (let i = 0; i < 3; i++) { assert.equal(limiter.check('k'), 0); limiter.fail('k'); }
    assert.ok(limiter.check('k') > 0);
    assert.equal(limiter.check('other'), 0);
    t = 1500;
    assert.equal(limiter.check('k'), 0);
    limiter.fail('k'); limiter.reset('k');
    assert.equal(limiter.check('k'), 0);
  });
});

describe('account handlers', () => {
  test('sign-up creates the account, signs in, and never returns the password hash', async () => {
    const { api } = newApi();
    const res = fakeRes();
    await api.signup(req(SIGNUP), res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.user.email, 'seth@example.com');
    assert.equal(res.body.user.name, 'Seth');
    assert.equal(JSON.stringify(res.body).includes('passwordHash'), false);
    assert.match(res.headers['Set-Cookie'], new RegExp(`^${COOKIE}=`));

    const me = fakeRes();
    await api.me(req(undefined, cookieFrom(res)), me);
    assert.equal(me.statusCode, 200);
    assert.equal(me.body.user.id, res.body.user.id);
  });

  test('sign-up rejects bad details (400) and a repeated email (409)', async () => {
    const { api } = newApi();
    const bad = fakeRes();
    await api.signup(req({ name: 'A', email: 'x', password: '1' }), bad);
    assert.equal(bad.statusCode, 400);
    assert.ok(bad.body.details.length >= 2);

    await api.signup(req(SIGNUP), fakeRes());
    const dup = fakeRes();
    await api.signup(req({ ...SIGNUP, email: 'SETH@example.com' }), dup);
    assert.equal(dup.statusCode, 409);
  });

  test('login works with the right password and fails the same way for a wrong password or unknown email', async () => {
    const { api } = newApi();
    await api.signup(req(SIGNUP), fakeRes());

    const ok = fakeRes();
    await api.login(req({ email: 'seth@example.com', password: SIGNUP.password }), ok);
    assert.equal(ok.statusCode, 200);
    assert.ok(cookieFrom(ok).startsWith(`${COOKIE}=`));

    const wrong = fakeRes();
    await api.login(req({ email: 'seth@example.com', password: 'wrong-password' }), wrong);
    const unknown = fakeRes();
    await api.login(req({ email: 'nobody@example.com', password: 'whatever123' }), unknown);
    assert.equal(wrong.statusCode, 401);
    assert.equal(unknown.statusCode, 401);
    assert.deepEqual(wrong.body, unknown.body);
    assert.equal(wrong.headers['Set-Cookie'], undefined);
  });

  test('too many failed logins get a 429 with Retry-After, and a correct login still resets nothing for others', async () => {
    const limiter = logic.createRateLimiter({ max: 2 });
    const { api } = newApi({ limiter });
    await api.signup(req(SIGNUP), fakeRes());
    const attempt = (password, ip) => { const r = fakeRes(); return api.login(req({ email: 'seth@example.com', password }, null, ip), r).then(() => r); };
    assert.equal((await attempt('bad-one-1', '9.9.9.9')).statusCode, 401);
    assert.equal((await attempt('bad-one-2', '9.9.9.9')).statusCode, 401);
    const blocked = await attempt(SIGNUP.password, '9.9.9.9'); // even the right password is refused while blocked
    assert.equal(blocked.statusCode, 429);
    assert.ok(Number(blocked.headers['Retry-After']) > 0);
    assert.equal((await attempt(SIGNUP.password, '8.8.8.8')).statusCode, 200); // a different IP is unaffected
  });

  test('logout ends the session, so the old cookie stops working', async () => {
    const { api } = newApi();
    const signedUp = fakeRes();
    await api.signup(req(SIGNUP), signedUp);
    const cookie = cookieFrom(signedUp);

    const out = fakeRes();
    await api.logout(req(undefined, cookie), out);
    assert.equal(out.statusCode, 204);
    assert.match(out.headers['Set-Cookie'], /Max-Age=0/);

    const me = fakeRes();
    await api.me(req(undefined, cookie), me);
    assert.equal(me.statusCode, 401);
  });

  test('me: no cookie, a made-up cookie and an expired session are all 401', async () => {
    let t = 1_000_000;
    const store = createMemoryAuthStore({ now: () => t });
    const api = createAuthHandlers({ store, now: () => t });
    const none = fakeRes();
    await api.me(req(), none);
    assert.equal(none.statusCode, 401);
    const fake = fakeRes();
    await api.me(req(undefined, `${COOKIE}=made-up-token`), fake);
    assert.equal(fake.statusCode, 401);

    const signedUp = fakeRes();
    await api.signup(req(SIGNUP), signedUp);
    t += logic.SESSION_MS + 1;
    const expired = fakeRes();
    await api.me(req(undefined, cookieFrom(signedUp)), expired);
    assert.equal(expired.statusCode, 401);
  });

  test('requireAuth sets req.user for a signed-in request and answers 401 otherwise', async () => {
    const { api } = newApi();
    const signedUp = fakeRes();
    await api.signup(req(SIGNUP), signedUp);

    const good = req(undefined, cookieFrom(signedUp));
    let called = false;
    await api.requireAuth(good, fakeRes(), () => { called = true; });
    assert.equal(called, true);
    assert.equal(good.user.email, 'seth@example.com');

    const denied = fakeRes();
    called = false;
    await api.requireAuth(req(), denied, () => { called = true; });
    assert.equal(called, false);
    assert.equal(denied.statusCode, 401);
  });
});
