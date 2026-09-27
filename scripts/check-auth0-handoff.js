// Read-only checks of the running app's Auth0 handoff. No .env is loaded.
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { browserOptions } from './browser-options.js';

const base = 'http://localhost:3000';
const tenant = 'dev-i7p4kdozefycl6u7.ca.auth0.com';
const report = {
  at: new Date().toISOString(),
  base,
  checks: {},
  scope: 'Live public handoff only. No user login, token exchange or saved-secret validation.',
};
let browser;
try {
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  const session = await (await fetch(`${base}/api/session`)).json();
  assert.equal(session.authEnabled, true);
  assert.equal(session.demo, false);
  assert.equal(session.user, null);
  report.checks.anonymousSession = 'passed';
  for (const path of ['/login', '/signup']) {
    const response = await fetch(base + path, { redirect: 'manual' });
    assert.equal(response.status, 302);
    const url = new URL(response.headers.get('location'));
    assert.equal(url.hostname, tenant);
    assert.equal(url.searchParams.get('client_id'), 'EdEu2b1ioiUTJrEvBVTDxuB1XSuOLzOX');
    assert.equal(url.searchParams.get('redirect_uri'), `${base}/callback`);
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    if (path === '/signup') assert.equal(url.searchParams.get('screen_hint'), 'signup');
    report.checks[path.slice(1)] = 'passed';
  }
  assert.equal((await fetch(`${base}/callback?code=invalid&state=invalid`)).status, 400);
  report.checks.invalidCallbackRejected = 'passed';
  const logout = await fetch(`${base}/logout`, { redirect: 'manual' });
  assert.equal(logout.status, 302);
  const logoutURL = new URL(logout.headers.get('location'));
  assert.equal(logoutURL.hostname, tenant);
  assert.equal(
    logoutURL.searchParams.get('post_logout_redirect_uri') ||
      logoutURL.searchParams.get('returnTo'),
    `${base}/`,
  );
  report.checks.logoutReturnURL = 'passed';
  browser = await chromium.launch(browserOptions());
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  assert.equal(await page.getByRole('link', { name: 'Create an account' }).count(), 1);
  await page.getByRole('textbox', { name: 'Email address' }).fill('synthetic.test@example.test');
  await page.getByRole('button', { name: 'Continue securely' }).click();
  await page.waitForURL((url) => url.hostname === tenant, { timeout: 20000 });
  await page.waitForLoadState('domcontentloaded');
  const hostedForm = page.locator('input[type="password"]');
  await hostedForm.waitFor({ state: 'visible', timeout: 20000 });
  assert.deepEqual(errors, []);
  report.checks.browserHandoff = 'passed';
  report.checks.hostedLoginForm = 'passed';
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.reason = error.code || error.name;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/auth0-handoff-verification.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
