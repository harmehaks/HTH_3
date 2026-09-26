import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Uses fresh containers, a private network, and RAM-backed PostgreSQL storage.
// No .env, host ports, user database, or existing containers are used.
const root = fileURLToPath(new URL('../', import.meta.url));
const suffix = randomUUID().slice(0, 8);
const network = `redactor-verify-${suffix}`;
const database = `${network}-db`,
  app = `${network}-app`;
const image = 'redactor:ati-evidence-verify';
const containers = [];
let networkCreated = false;
const report = {
  at: new Date().toISOString(),
  status: 'running',
  scope:
    'Local Linux containers with PostgreSQL 17 and pgvector. Not hosted Tiger Data, Vultr, or live AI verification.',
};
function docker(args, options = {}) {
  const result = spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      result.error?.message ||
        (result.stderr || result.stdout || `Docker exit ${result.status}`).trim(),
    );
  return result.stdout?.trim() || '';
}
async function healthy(name) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const state = JSON.parse(docker(['inspect', '--format', '{{json .State}}', name]));
    if (state.Health?.Status === 'healthy') return;
    if (!state.Running || state.Health?.Status === 'unhealthy')
      throw new Error(`Container ${name} is not healthy.`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Health check timed out for ${name}.`);
}
try {
  docker(['version', '--format', '{{.Server.Version}}']);
  if (!process.argv.includes('--skip-build')) {
    console.log('Building the production image…');
    docker(['build', '--tag', image, '.'], { stdio: 'inherit', timeout: 600000 });
  }
  report.imageId = docker(['image', 'inspect', '--format', '{{.Id}}', image]);
  docker(['network', 'create', network]);
  networkCreated = true;
  console.log('Starting an isolated PostgreSQL/pgvector database…');
  containers.push(
    docker([
      'run',
      '-d',
      '--rm',
      '--name',
      database,
      '--network',
      network,
      '--tmpfs',
      '/var/lib/postgresql/data',
      '-e',
      'POSTGRES_USER=redactor',
      '-e',
      'POSTGRES_PASSWORD=isolated_test_only',
      '-e',
      'POSTGRES_DB=redactor',
      '--health-cmd',
      'pg_isready -U redactor -d redactor',
      '--health-interval',
      '2s',
      '--health-timeout',
      '3s',
      '--health-retries',
      '15',
      'pgvector/pgvector:pg17',
    ]),
  );
  await healthy(database);
  console.log('Starting the app as the image’s non-root user…');
  containers.push(
    docker([
      'run',
      '-d',
      '--rm',
      '--name',
      app,
      '--network',
      network,
      '-e',
      `DATABASE_URL=postgresql://redactor:isolated_test_only@${database}:5432/redactor`,
      '-e',
      'DATABASE_SSL=false',
      '-e',
      'DEMO_MODE=true',
      '--health-interval',
      '2s',
      '--health-start-period',
      '5s',
      image,
    ]),
  );
  await healthy(app);
  const probe = `
    import assert from 'node:assert/strict';
    import pg from 'pg';
    import { createStore } from './server/store.js';
    assert.notEqual(process.getuid(), 0);
    const get = async (path) => {
      const response = await fetch('http://127.0.0.1:3001' + path);
      assert.equal(response.status, 200, path);
      return response;
    };
    await get('/api/health');
    const html = await (await get('/')).text();
    assert.ok(html.includes('<div id="root">'));
    const corpus = await (await get('/api/corpus')).json();
    assert.equal(corpus.filter(c => c.sourceType === 'ati_release').length, 8);
    const comparison = await (await get('/api/requests/DEMO-ATI-00675')).json();
    assert.equal(comparison.documents[0].reference.requestRef, 'A-2026-00675');
    assert.ok(comparison.documents[0].integrity.conflicts.some(f => f.requestRef === 'A-2026-00675' && !f.synthetic));
    const requests = await (await get('/api/requests')).json();
    const released = requests.find(r => r.status === 'released');
    const pdf = Buffer.from(await (await get('/api/requests/' + released.id + '/export/pdf')).arrayBuffer());
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
    let store = await createStore();
    await store.put('verification', {id:'container-persistence', nested:{value:'persisted'}});
    const vector = Array(768).fill(0); vector[0] = 1;
    await store.vector('container-vector', vector, 'verification-only-v1');
    const nearest = await store.similar(vector, 'verification-only-v1');
    assert.equal(nearest[0].id, 'container-vector');
    assert.ok(nearest[0].similarity > 0.99999);
    assert.deepEqual(await store.similar(vector, 'absent-model'), []);
    await store.close();
    store = await createStore();
    assert.equal((await store.get('container-persistence')).nested.value, 'persisted');
    await store.close();
    const client = new pg.Client({connectionString:process.env.DATABASE_URL, ssl:false});
    await client.connect();
    const ext = (await client.query("SELECT extversion FROM pg_extension WHERE extname='vector'")).rows[0];
    assert.ok(ext);
    const body = (await client.query("SELECT data_type FROM information_schema.columns WHERE table_name='records' AND column_name='body'")).rows[0];
    assert.equal(body.data_type, 'jsonb');
    const indexes = (await client.query("SELECT indexdef FROM pg_indexes WHERE indexname='corpus_vectors_cosine'")).rows;
    assert.match(indexes[0].indexdef, /USING hnsw/);
    await client.end();
    console.log(JSON.stringify({uid:process.getuid(), health:true, builtUI:true, atiReferences:8, publishedComparison:true, pdfExport:true, jsonbPersistence:true, pgvectorVersion:ext.extversion, cosineSearch:true, embeddingModelIsolation:true, hnswIndex:true}));
  `;
  report.checks = JSON.parse(docker(['exec', app, 'node', '--input-type=module', '-e', probe]));
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = error.message;
  process.exitCode = 1;
} finally {
  const cleanupErrors = [];
  for (const id of containers.reverse()) {
    try {
      docker(['rm', '--force', id]);
    } catch (error) {
      cleanupErrors.push(error.message);
    }
  }
  if (networkCreated) {
    try {
      docker(['network', 'rm', network]);
    } catch (error) {
      cleanupErrors.push(error.message);
    }
  }
  report.cleanup = cleanupErrors.length
    ? { errors: cleanupErrors }
    : 'Temporary containers and network removed';
  if (cleanupErrors.length) process.exitCode = 1;
  const directory = new URL('../artifacts/', import.meta.url);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    new URL('container-verification.json', directory),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
}
