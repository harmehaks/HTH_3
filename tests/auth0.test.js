import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { createStore } from '../server/store.js';
import { createApp } from '../server/app.js';
import { createAuthSessionStore } from '../server/auth-session-store.js';

// A synthetic OIDC provider exercises the installed official SDK, including
// discovery, PKCE, token signature/nonce validation and session persistence.
// No account credentials or saved .env values are loaded by this test.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig', alg: 'RS256' };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
function token(claims) {
  const body = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode(claims)}`;
  return `${body}.${sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url')}`;
}

async function fixture(t, { denyExchange = false } = {}) {
  const names = [
    'AUTH0_ISSUER_BASE_URL',
    'AUTH0_CLIENT_ID',
    'AUTH0_CLIENT_SECRET',
    'AUTH0_BASE_URL',
    'SESSION_SECRET',
    'AUTH0_ROLES_CLAIM',
  ];
  const before = Object.fromEntries(names.map((key) => [key, process.env[key]]));
  const codes = new Map();
  let issuer,
    base,
    exchanges = 0;
  const provider = express();
  provider.use(express.urlencoded({ extended: false }));
  provider.get('/.well-known/openid-configuration', (req, res) =>
    res.json({
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      jwks_uri: `${issuer}/jwks`,
      end_session_endpoint: `${issuer}/logout`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['client_secret_post'],
      code_challenge_methods_supported: ['S256'],
    }),
  );
  provider.get('/jwks', (req, res) => res.json({ keys: [jwk] }));
  provider.post('/token', (req, res) => {
    exchanges++;
    assert.equal(req.body.client_id, 'synthetic-client');
    assert.equal(req.body.client_secret, 'synthetic-client-secret');
    assert.equal(req.headers.authorization, undefined);
    assert.equal(req.body.redirect_uri, `${base}/callback`);
    if (denyExchange)
      return res
        .status(401)
        .json({
          error: 'access_denied',
          error_description: 'Unauthorized synthetic-private-marker',
        });
    const code = codes.get(req.body.code);
    assert.ok(code);
    assert.equal(
      createHash('sha256').update(req.body.code_verifier).digest('base64url'),
      code.challenge,
    );
    const now = Math.floor(Date.now() / 1000);
    res.json({
      token_type: 'Bearer',
      access_token: 'synthetic-access-token',
      expires_in: 3600,
      id_token: token({
        iss: issuer,
        aud: 'synthetic-client',
        sub: 'auth0|test-user',
        name: 'Synthetic User',
        iat: now,
        exp: now + 3600,
        nonce: code.nonce,
        'https://redactor.app/roles': code.roles,
      }),
    });
  });
  const providerServer = provider.listen(0, '127.0.0.1');
  await once(providerServer, 'listening');
  issuer = `http://127.0.0.1:${providerServer.address().port}`;
  const store = await createStore({ url: '', path: ':memory:' });
  Object.assign(process.env, {
    AUTH0_ISSUER_BASE_URL: issuer,
    AUTH0_CLIENT_ID: 'synthetic-client',
    AUTH0_CLIENT_SECRET: 'synthetic-client-secret',
    AUTH0_BASE_URL: 'http://127.0.0.1',
    SESSION_SECRET: 'synthetic-cookie-secret-at-least-32-characters',
    AUTH0_ROLES_CLAIM: 'https://redactor.app/roles',
  });
  // Select an ephemeral port before constructing the SDK's callback URL.
  const host = express();
  const server = host.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  process.env.AUTH0_BASE_URL = base;
  host.use(createApp(store, { demo: false, test: true }));
  t.after(async () => {
    for (const s of [server, providerServer]) {
      s.closeAllConnections();
      await new Promise((resolve) => s.close(resolve));
    }
    await store.close();
    for (const key of names) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  });
  const cookies = new Map();
  async function request(path, options = {}) {
    const response = await fetch(base + path, {
      redirect: 'manual',
      ...options,
      headers: { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...options.headers },
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [name, ...value] = cookie.split(';')[0].split('=');
      if (value.join('=')) cookies.set(name, value.join('='));
      else cookies.delete(name);
    }
    return response;
  }
  async function login(roles = ['officer'], nonceOverride, options = {}) {
    const response = await request(
      '/login?login_hint=synthetic%40example.test&connection=google-oauth2',
    );
    assert.equal(response.status, 302);
    const url = new URL(response.headers.get('location'));
    assert.equal(url.searchParams.get('redirect_uri'), `${base}/callback`);
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('login_hint'), 'synthetic@example.test');
    assert.equal(url.searchParams.get('connection'), 'google-oauth2');
    codes.set('synthetic-code', {
      nonce: nonceOverride || url.searchParams.get('nonce'),
      roles,
      challenge: url.searchParams.get('code_challenge'),
    });
    return request(
      `/callback?code=synthetic-code&state=${encodeURIComponent(url.searchParams.get('state'))}`,
      options,
    );
  }
  return { request, login, store, cookies, base, exchanges: () => exchanges };
}

test('a denied SDK code exchange shows recovery guidance without leaking provider payloads or granting access', async (t) => {
  const f = await fixture(t, { denyExchange: true });
  const callback = await f.login(['officer'], undefined, { headers: { Accept: 'text/html' } });
  assert.equal(callback.status, 400);
  assert.match(callback.headers.get('content-type'), /text\/html/);
  assert.equal(callback.headers.get('cache-control'), 'no-store');
  const html = await callback.text();
  assert.match(html, /exchanging the login code/);
  assert.match(html, /synthetic-client/);
  assert.match(html, /AUTH0_CLIENT_SECRET/);
  assert.ok(!html.includes('synthetic-client-secret'));
  assert.ok(!html.includes('synthetic-private-marker'));
  assert.ok(!html.includes('synthetic-code'));
  assert.equal((await f.store.all('auth-session')).length, 0);
  assert.equal((await (await f.request('/api/session')).json()).user, null);
});

test('official SDK completes code login, persists server sessions, enforces roles and revokes logout', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/requests')).status, 401);
  assert.deepEqual(await (await f.request('/api/session')).json(), {
    user: null,
    demo: false,
    authEnabled: true,
  });
  const callback = await f.login();
  assert.equal(callback.status, 302, await callback.text());
  assert.equal(new URL(callback.headers.get('location'), f.base).pathname, '/');
  const session = await (await f.request('/api/session')).json();
  assert.equal(session.user.role, 'officer');
  assert.equal(session.user.id, 'auth0|test-user');
  assert.equal((await f.request('/api/audit')).status, 200);
  assert.equal((await f.store.all('auth-session')).length, 1);
  const stored = (await f.store.all('auth-session'))[0];
  assert.ok(stored.payload.data.id_token);
  assert.ok(f.cookies.get('appSession'));
  assert.ok(!f.cookies.get('appSession').includes(stored.payload.data.id_token));
  assert.match(callback.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(callback.headers.get('set-cookie'), /SameSite=Lax/i);
  assert.ok(!JSON.stringify(session).includes('synthetic-access-token'));
  assert.equal(
    (
      await f.request('/api/session/role', {
        method: 'POST',
        headers: { 'X-Redactor-Client': 'workspace', 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'requester' }),
      })
    ).status,
    403,
  );
  const cookie = f.cookies.get('appSession');
  f.cookies.set('appSession', cookie + 'tampered');
  assert.equal((await (await f.request('/api/session')).json()).user, null);
  f.cookies.set('appSession', cookie);
  const logout = await f.request('/logout');
  assert.equal(logout.status, 302);
  const logoutURL = new URL(logout.headers.get('location'));
  assert.equal(
    logoutURL.searchParams.get('post_logout_redirect_uri') ||
      logoutURL.searchParams.get('returnTo'),
    `${f.base}/`,
  );
  assert.equal((await f.store.all('auth-session')).length, 0);
  assert.equal((await (await f.request('/api/session')).json()).user, null);
});

test('signup uses Universal Login and accounts without officer role cannot access officer routes', async (t) => {
  const f = await fixture(t);
  const signup = await f.request('/signup');
  assert.equal(signup.status, 302);
  assert.equal(new URL(signup.headers.get('location')).searchParams.get('screen_hint'), 'signup');
  assert.equal((await f.login([])).status, 302);
  assert.equal((await (await f.request('/api/session')).json()).user.role, 'requester');
  assert.equal((await f.request('/api/audit')).status, 403);
});

test('SDK rejects invalid callback state and nonce without creating a session', async (t) => {
  const f = await fixture(t);
  const invalidState = await f.request('/callback?code=synthetic-code&state=invalid');
  assert.equal(invalidState.status, 400);
  assert.equal(f.exchanges(), 0);
  const invalidNonce = await f.login(['officer'], 'incorrect-nonce');
  assert.equal(invalidNonce.status, 400);
  assert.equal((await f.store.all('auth-session')).length, 0);
});

test('server-side session adapter expires records and propagates database failures', async () => {
  const db = await createStore({ url: '', path: ':memory:' });
  const adapter = createAuthSessionStore(db);
  const call = (method, ...args) =>
    new Promise((resolve, reject) =>
      adapter[method](...args, (error, result) => (error ? reject(error) : resolve(result))),
    );
  try {
    const payload = { cookie: { expires: Date.now() + 60000 }, data: { id_token: 'synthetic' } };
    await call('set', 'active', payload);
    assert.deepEqual(await call('get', 'active'), payload);
    await call('set', 'expired', { ...payload, cookie: { expires: Date.now() - 1 } });
    assert.equal(await call('get', 'expired'), null);
    assert.equal(await db.get('auth-session:expired'), null);
    await call('destroy', 'active');
    assert.equal(await call('get', 'active'), null);
  } finally {
    await db.close();
  }
  await assert.rejects(call('get', 'active'));
});

test('Auth0 always requires a private session secret even when demo mode was left enabled', async () => {
  const keys = [
    'AUTH0_ISSUER_BASE_URL',
    'AUTH0_CLIENT_ID',
    'AUTH0_CLIENT_SECRET',
    'SESSION_SECRET',
  ];
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    Object.assign(process.env, {
      AUTH0_ISSUER_BASE_URL: 'https://issuer.example.test',
      AUTH0_CLIENT_ID: 'synthetic-client',
      AUTH0_CLIENT_SECRET: 'synthetic-secret',
      SESSION_SECRET: '',
    });
    assert.throws(() => createApp({}, { demo: true }), /SESSION_SECRET/);
  } finally {
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  }
});
