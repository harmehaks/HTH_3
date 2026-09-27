// Checks the public deployment without entering credentials or creating records.
// Secrets are neither loaded from local files nor included in this report.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = new URL(process.env.DEPLOYMENT_BASE_URL || 'https://mr-redactor.vip');
assert.equal(base.protocol, 'https:', 'Use the public HTTPS origin.');
assert.equal(base.pathname, '/', 'Use an origin without a path.');
assert(!base.username && !base.password && !base.search && !base.hash);
const report = {
  at: new Date().toISOString(),
  origin: base.origin,
  scope:
    'Public HTTPS, frontend, Auth0 handoff and anonymous access checks. No interactive login, Gemini calls or database writes.',
  checks: {},
};
const request = (path, options = {}) =>
  fetch(new URL(path, base), {
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
    ...options,
  });
try {
  let response = await request('/api/health');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  report.checks.httpsAndAPI = 'passed';
  response = await request('/api/session');
  assert.equal(response.status, 200);
  const session = await response.json();
  assert.equal(session.authEnabled, true);
  assert.equal(session.demo, false);
  assert.equal(session.user, null);
  report.checks.realAuth0Enabled = 'passed';
  assert.equal((await request('/api/requests')).status, 401);
  report.checks.anonymousRecordsDenied = 'passed';
  response = await request('/');
  assert.equal(response.status, 200);
  const html = await response.text();
  assert(html.includes('id="root"'));
  const asset = html.match(/src="(\/assets\/[^"\s]+\.js)"/)?.[1];
  assert(asset, 'Built frontend script missing.');
  response = await request(asset);
  assert.equal(response.status, 200);
  assert(/javascript/.test(response.headers.get('content-type') || ''));
  report.checks.builtFrontend = 'passed';
  for (const path of ['/login', '/signup']) {
    response = await request(path);
    assert.equal(response.status, 302);
    const target = new URL(response.headers.get('location'));
    assert.equal(target.protocol, 'https:');
    if (process.env.AUTH0_ISSUER_BASE_URL)
      assert.equal(target.origin, new URL(process.env.AUTH0_ISSUER_BASE_URL).origin);
    if (process.env.AUTH0_CLIENT_ID)
      assert.equal(target.searchParams.get('client_id'), process.env.AUTH0_CLIENT_ID);
    assert.equal(target.searchParams.get('redirect_uri'), `${base.origin}/callback`);
    assert.equal(target.searchParams.get('response_type'), 'code');
    assert.equal(target.searchParams.get('code_challenge_method'), 'S256');
    if (path === '/signup') assert.equal(target.searchParams.get('screen_hint'), 'signup');
    const cookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith('mr_redactor_auth_verification='));
    assert(cookie && /;\s*Secure(?:;|$)/i.test(cookie) && /;\s*HttpOnly(?:;|$)/i.test(cookie));
    report.checks[path.slice(1)] = 'passed';
  }
  response = await request('/logout');
  assert.equal(response.status, 302);
  const logout = new URL(response.headers.get('location'));
  assert.equal(logout.protocol, 'https:');
  assert.equal(
    logout.searchParams.get('post_logout_redirect_uri') || logout.searchParams.get('returnTo'),
    `${base.origin}/`,
  );
  report.checks.logoutRedirect = 'passed';
  response = await fetch(`http://${base.host}/api/health`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  });
  assert([301, 302, 307, 308].includes(response.status));
  assert.equal(new URL(response.headers.get('location')).origin, base.origin);
  report.checks.httpRedirectsToHTTPS = 'passed';
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  // Never print raw URLs, provider messages, cookies or request bodies.
  report.reason =
    error.code === 'ERR_ASSERTION'
      ? 'Unexpected public deployment response.'
      : 'Public deployment could not be reached or checked.';
  process.exitCode = 1;
} finally {
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/deployment-verification.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
