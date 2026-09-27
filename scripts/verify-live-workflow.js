import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { chromium, expect } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { embed, renderRedacted } from '../server/engine.js';
import { browserOptions } from './browser-options.js';

const reportPath = 'artifacts/live-workflow-verification.json';
const report = {
  at: new Date().toISOString(),
  status: 'running',
  checks: {},
  scope:
    'Compiled UI and actual API using live Gemini and Tiger Data in a separate disposable database schema. Only synthetic records. Officer/requester roles use demo sessions; Auth0 login and ElevenLabs synthesis are not covered.',
};
const schema = `redactor_verify_${randomUUID().replaceAll('-', '')}`;
assert(/^redactor_verify_[a-f0-9]{32}$/.test(schema));
const databaseURL = process.env.DATABASE_URL;
const secrets = [
  'DATABASE_URL',
  'GEMINI_API_KEY',
  'SESSION_SECRET',
  'AUTH0_CLIENT_SECRET',
  'ELEVENLABS_API_KEY',
]
  .map((key) => process.env[key])
  .filter(Boolean);
let admin,
  schemaCreated = false,
  store,
  server,
  browser;
let stage = 'configuration';
function save() {
  mkdirSync('artifacts', { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
}
function passed(name, details = true) {
  report.checks[name] = details;
  save();
  console.log(`Passed: ${name}`);
}
async function start() {
  server = createApp(store, { demo: true }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
async function stop() {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
  if (store) {
    await store.close();
    store = null;
  }
}
try {
  const missing = ['DATABASE_URL', 'GEMINI_API_KEY'].filter((key) => !process.env[key]?.trim());
  assert.equal(missing.length, 0, `Missing live workflow configuration: ${missing.join(', ')}`);
  // Role simulation is confined to this verifier, never saved to .env.
  Object.assign(process.env, {
    DEMO_MODE: 'true',
    AUTH0_ISSUER_BASE_URL: '',
    AUTH0_CLIENT_ID: '',
    AUTH0_CLIENT_SECRET: '',
  });
  stage = 'isolated cloud schema setup';
  admin = new pg.Client({
    connectionString: databaseURL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
  });
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  schemaCreated = true;
  const scoped = new URL(databaseURL);
  scoped.searchParams.set(
    'options',
    `${scoped.searchParams.get('options') || ''} -c search_path=${schema},public`.trim(),
  );
  const scopedURL = scoped.toString();
  store = await createStore({ url: scopedURL });
  const tables = await admin.query(
    'SELECT table_name FROM information_schema.tables WHERE table_schema=$1',
    [schema],
  );
  assert.deepEqual(tables.rows.map((row) => row.table_name).sort(), ['corpus_vectors', 'records']);
  assert.deepEqual(await store.all('request'), []);
  const index = await admin.query(
    'SELECT indexdef FROM pg_indexes WHERE schemaname=$1 AND indexname=$2',
    [schema, 'corpus_vectors_cosine'],
  );
  assert.match(index.rows[0].indexdef, /USING hnsw/);
  passed('isolatedTigerSchemaAndHnswIndex');
  let origin = await start();
  browser = await chromium.launch(browserOptions());
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  page.setDefaultTimeout(20000);
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  async function json(path, { method = 'GET', body, expected = 200 } = {}) {
    const response = await page.request.fetch(origin + '/api' + path, {
      method,
      data: body,
      headers: { 'X-Redactor-Client': 'workspace' },
      timeout: 120000,
    });
    assert.equal(
      response.status(),
      expected,
      `API check ${method} ${path}: unexpected HTTP status`,
    );
    return response.json();
  }
  stage = 'compiled browser and live settings';
  await page.goto(origin);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Enter as officer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A clearer path to disclosure.' })).toBeVisible();
  const settings = await json('/settings');
  assert.equal(settings.classification, 'Gemini');
  assert.match(settings.storage, /Tiger Data/);
  passed('liveSettings', {
    model: settings.model,
    classification: settings.classification,
    storage: settings.storage,
    auth: settings.auth,
  });
  stage = 'create and analyze synthetic record through UI';
  const title = 'Synthetic live cloud release verification';
  await page.getByRole('button', { name: 'New request' }).first().click();
  await page.getByRole('textbox', { name: 'Request title' }).fill(title);
  await page
    .getByRole('textbox', { name: 'Records requested' })
    .fill('Synthetic aggregate results and private personnel contact details for verification.');
  const creation = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/requests',
  );
  await page.getByRole('button', { name: 'Create request', exact: true }).click();
  const creationResponse = await creation;
  assert.equal(creationResponse.status(), 201);
  let request = await creationResponse.json();
  const id = request.id;
  await json(`/requests/${id}/release`, { method: 'POST', body: {}, expected: 409 });
  await page.getByRole('button', { name: 'Paste document text', exact: true }).click();
  const text =
    'SYNTHETIC PRIVATE PERSONNEL RECORD\n\nPublic aggregate: training participation increased by 18%.\nEmployee name: Avery Testperson\nPrivate personal email: avery.testperson@example.invalid';
  await page.getByRole('textbox', { name: 'Document text' }).fill(text);
  const analysis = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === `/api/requests/${id}/documents`,
    { timeout: 180000 },
  );
  await page.getByRole('button', { name: 'Analyze document', exact: true }).click();
  const analyzed = await analysis;
  assert.equal(analyzed.status(), 201, 'Live document analysis must succeed');
  request = await analyzed.json();
  let doc = request.documents[0];
  assert.equal(doc.engine, 'Gemini');
  assert.equal(doc.integrity.tester, 'Gemini independent pass');
  const candidate = renderRedacted(doc.text, doc.spans);
  for (const value of ['Avery Testperson', 'avery.testperson@example.invalid'])
    assert(!candidate.includes(value), 'Private synthetic identifiers must be removed');
  assert(candidate.includes('18%'), 'Public aggregate must remain');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  passed('browserCreateAndLiveGeminiAnalysis', {
    suggestions: doc.spans.length,
    tester: doc.integrity.tester,
    syntheticPrivateValuesRemoved: true,
    publicAggregatePreserved: true,
  });
  await json(`/requests/${id}/release`, { method: 'POST', body: {}, expected: 409 });

  stage = 'live vector consistency';
  const quote = doc.text.slice(doc.spans[0].start, doc.spans[0].end);
  const embedding = await embed(quote);
  const corpusId = randomUUID();
  await store.put('corpus', {
    id: corpusId,
    text: quote,
    requestRef: 'SYNTH-LIVE-0001',
    treatment: 'released',
    category: doc.spans[0].category,
    synthetic: true,
    sourceUrl: 'https://example.invalid/synthetic-reference',
    embeddingModel: embedding.model,
    embedding: embedding.values,
  });
  await store.vector(corpusId, embedding.values, embedding.model);
  const matches = await store.similar(embedding.values, embedding.model);
  assert.equal(matches[0].id, corpusId);
  assert(Number(matches[0].similarity) > 0.99999);
  assert.deepEqual(await store.similar(embedding.values, 'verification-absent-model'), []);
  request = await json(`/requests/${id}/integrity`, { method: 'POST', body: {} });
  doc = request.documents[0];
  assert(doc.integrity.conflicts.some((finding) => finding.requestRef === 'SYNTH-LIVE-0001'));
  await page.reload();
  await page.getByRole('button', { name: 'Redaction workspace', exact: true }).click();
  passed('liveGeminiEmbeddingAndTigerConsistency', {
    dimensions: embedding.values.length,
    model: embedding.model,
    modelIsolation: true,
    syntheticReferenceConflict: true,
  });

  stage = 'officer browser review and release';
  // Select each suggestion explicitly: the UI may auto-advance after approval.
  for (let i = 0; i < doc.spans.length; i++) {
    await page.locator('.suggestion-list button').nth(i).click();
    const approval = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        new URL(response.url()).pathname.endsWith(`/spans/${doc.spans[i].id}`),
    );
    await page.getByRole('button', { name: 'Approve withholding', exact: true }).click();
    assert.equal((await approval).status(), 200);
  }
  await page
    .locator('.review-tabs')
    .getByRole('button', { name: /Integrity/ })
    .click();
  const findings = [...doc.integrity.leaks, ...doc.integrity.conflicts];
  for (let i = 0; i < findings.length; i++) {
    await page.getByRole('button', { name: 'Review finding', exact: true }).first().click();
    await page
      .getByRole('textbox', { name: 'Officer rationale' })
      .fill(
        'Synthetic test only: all private fixture identifiers were removed. The comparison reference is deliberately synthetic and does not justify disclosing personnel information. Remaining aggregate figures identify no real individual.',
      );
    const resolution = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        new URL(response.url()).pathname.includes('/findings/'),
    );
    await page.getByRole('button', { name: 'Resolve finding', exact: true }).click();
    assert.equal((await resolution).status(), 200);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await json(`/requests/${id}/release`, { method: 'POST', body: {}, expected: 409 });
  await page.getByRole('checkbox', { name: 'I have reviewed the entire record' }).check();
  await expect(page.getByRole('button', { name: 'Approve release', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Approve release', exact: true }).click();
  await page.getByRole('button', { name: 'Approve & release', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download release', exact: true })).toBeVisible();
  request = await json(`/requests/${id}`);
  assert.equal(request.status, 'released');
  const releasedText = request.release.documents[0].text;
  for (const value of ['Avery Testperson', 'avery.testperson@example.invalid'])
    assert(!releasedText.includes(value));
  const audit = await json('/audit');
  assert(audit.valid && audit.events.some((event) => event.action === 'Release approved'));
  passed('browserReviewReleaseGatesAndAudit', {
    resolvedFindings: findings.length,
    auditEvents: audit.events.length,
  });

  stage = 'requester permissions and exported release';
  await page.getByRole('button', { name: 'Open profile menu' }).click();
  await page.getByRole('button', { name: 'Requester portal', exact: false }).click();
  await page
    .locator('.portal-request')
    .filter({ hasText: title })
    .getByRole('button', { name: 'View release' })
    .click();
  await expect(page.locator('.released-records')).toContainText('18%');
  await expect(page.locator('.released-records')).not.toContainText('Avery Testperson');
  const sanitized = await json(`/requests/${id}`);
  assert(!('spans' in sanitized.documents[0]) && !('integrity' in sanitized.documents[0]));
  await json('/audit', { expected: 403 });
  const receipt = await json(`/requests/${id}/export/receipt`);
  assert.equal(
    receipt.documents[0].sha256,
    createHash('sha256').update(releasedText).digest('hex'),
  );
  const pdfResponse = await page.request.get(`${origin}/api/requests/${id}/export/pdf`);
  assert.equal(pdfResponse.status(), 200);
  const pdf = await getDocument({
    data: new Uint8Array(await pdfResponse.body()),
    isEvalSupported: false,
    standardFontDataUrl: resolve('node_modules/pdfjs-dist/standard_fonts') + '/',
  }).promise;
  let pdfText = '';
  try {
    for (let i = 1; i <= pdf.numPages; i++)
      pdfText += (await (await pdf.getPage(i)).getTextContent()).items
        .map((item) => item.str || '')
        .join(' ');
  } finally {
    await pdf.loadingTask.destroy();
  }
  assert(pdfText.includes('18%'));
  for (const value of ['Avery Testperson', 'avery.testperson@example.invalid'])
    assert(!pdfText.includes(value));
  await page.screenshot({ path: 'artifacts/live-requester-release.png', fullPage: true });
  passed('requesterPermissionsPdfAndReceipt', {
    privateValuesAbsentFromPdf: true,
    receiptHashVerified: true,
  });

  stage = 'application restart and persisted release';
  await stop();
  store = await createStore({ url: scopedURL });
  assert.equal((await store.get(id)).status, 'released');
  assert.equal((await store.get(corpusId)).embeddingModel, embedding.model);
  assert.equal((await store.similar(embedding.values, embedding.model))[0].id, corpusId);
  origin = await start();
  await page.context().clearCookies();
  assert.equal((await json(`/requests/${id}`)).release.documents[0].text, releasedText);
  assert((await json('/audit')).valid);
  passed('cloudPersistenceAcrossAppRestart');
  stage = 'compiled production browser verification';
  process.env.PRODUCTION_BASE_URL = origin;
  await import('./verify-production.js');
  assert.deepEqual(browserErrors, []);
  passed('compiledProductionAndNoBrowserErrors');
  report.status = 'passed';
} catch (error) {
  let message = error.message || 'Live workflow failed';
  for (const secret of secrets) message = message.replaceAll(secret, '[redacted]');
  report.status = 'failed';
  report.error = { stage, code: error.code || error.cause?.code || error.name, message };
  console.error(`Live workflow failed at ${stage}: ${message}`);
  process.exitCode = 1;
} finally {
  const cleanupErrors = [];
  try {
    if (browser) await browser.close();
    await stop();
  } catch {
    cleanupErrors.push('Could not close test browser or server.');
  }
  if (schemaCreated && admin) {
    try {
      // Only the fresh schema created by this run is eligible for cleanup.
      assert(/^redactor_verify_[a-f0-9]{32}$/.test(schema));
      await admin.query(`DROP TABLE IF EXISTS "${schema}".corpus_vectors, "${schema}".records`);
      await admin.query(`DROP SCHEMA "${schema}"`);
    } catch {
      cleanupErrors.push('Could not remove the disposable verification schema.');
    }
  }
  try {
    if (admin) await admin.end();
  } catch {
    cleanupErrors.push('Could not close database connection.');
  }
  report.cleanup = cleanupErrors.length
    ? { errors: cleanupErrors }
    : 'Test browser/server stopped and disposable schema removed; existing application data untouched.';
  if (cleanupErrors.length) {
    report.status = 'failed';
    process.exitCode = 1;
  }
  save();
  console.log(`Live workflow: ${report.status}. Report: ${reportPath}`);
}
