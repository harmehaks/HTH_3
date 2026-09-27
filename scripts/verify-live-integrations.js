import 'dotenv/config';
import assert from 'node:assert/strict';
import { lookup } from 'node:dns/promises';
import { connect } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { classify, leakTester, embed, renderRedacted } from '../server/engine.js';

const selection = process.argv
  .find((arg) => arg.startsWith('--service='))
  ?.slice('--service='.length);
const setup = process.argv.includes('--setup');
const serviceNames = {
  gemini: 'Gemini',
  tiger: 'Tiger Data',
  auth0: 'Auth0',
  elevenlabs: 'ElevenLabs',
};
if (selection && !serviceNames[selection])
  throw new Error('Choose --service=gemini, tiger, auth0 or elevenlabs.');
const reportPath = selection
  ? `artifacts/live-${selection}-verification.json`
  : 'artifacts/live-integrations-verification.json';
const report = {
  at: new Date().toISOString(),
  scope: `Live calls with synthetic data. PostgreSQL probe uses a temporary table and rollback.${setup ? ' Setup may persistently enable the required vector extension, as application startup does.' : ''} Auth0 discovery does not prove interactive login.`,
  services: {},
};
const present = (key) => Boolean(process.env[key]?.trim());
function failure(error) {
  const status =
    error.providerStatus || Number(error.message?.match(/\((\d{3})\)/)?.[1]) || undefined;
  const code = error.cause?.code || error.code;
  return {
    status: 'failed',
    ...(status ? { httpStatus: status } : {}),
    ...(typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) ? { code } : {}),
    reason:
      status === 429
        ? 'Provider quota or rate limit exhausted.'
        : [400, 401, 403].includes(status)
          ? 'Provider rejected the configured credential or request.'
          : status === 404
            ? 'Configured model or endpoint was not found.'
            : error.name === 'AssertionError'
              ? 'Live response did not satisfy the expected check.'
              : 'Connection or live response validation failed; no fallback was used.',
  };
}
function save() {
  mkdirSync('artifacts', { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
}
async function checked(service, operation) {
  if (selection && serviceNames[selection] !== service) return;
  console.log(`Checking live ${service}...`);
  try {
    report.services[service] = await operation();
  } catch (error) {
    report.services[service] = failure(error);
  }
  save();
  console.log(`${service}: ${JSON.stringify(report.services[service])}`);
}
async function tcpReachable(host, port) {
  await new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    socket.setTimeout(8000);
    socket.once('connect', () => {
      socket.destroy();
      resolve();
    });
    socket.once('timeout', () => {
      socket.destroy();
      reject(Object.assign(new Error('TCP timeout'), { code: 'ETIMEDOUT' }));
    });
    socket.once('error', (error) => {
      socket.destroy();
      reject(error);
    });
  });
}

await checked('Gemini', async () => {
  if (!present('GEMINI_API_KEY')) return { status: 'blocked', missing: ['GEMINI_API_KEY'] };
  const result = {
    status: 'running',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    checks: {},
  };
  const text =
    'SYNTHETIC PRIVATE PERSONNEL RECORD\nEmployee name: Avery Testperson\nPrivate personal email: avery.testperson@example.invalid\nPublic aggregate: training participation increased by 18%.';
  let classification;
  try {
    classification = await classify(text);
    assert.equal(classification.engine, 'Gemini');
    const candidate = renderRedacted(text, classification.spans);
    assert(!candidate.includes('avery.testperson@example.invalid'));
    assert(candidate.includes('18%'));
    result.checks.classification = {
      status: 'passed',
      suggestions: classification.spans.length,
      privateEmailRemoved: true,
      publicAggregatePreserved: true,
    };
  } catch (error) {
    result.checks.classification = failure(error);
  }
  if (classification && result.checks.classification.status === 'passed') {
    try {
      const findings = await leakTester(renderRedacted(text, classification.spans));
      assert(Array.isArray(findings));
      result.checks.independentLeakTester = {
        status: 'passed',
        findings: findings.length,
        input: 'Redacted synthetic candidate only',
      };
    } catch (error) {
      result.checks.independentLeakTester = failure(error);
    }
  } else
    result.checks.independentLeakTester = {
      status: 'blocked',
      reason: 'Live classification did not pass.',
    };
  try {
    const embedding = await embed(
      'Synthetic public program training participation improved by eighteen percent.',
    );
    assert.equal(embedding.values.length, 768);
    assert(Math.abs(Math.hypot(...embedding.values) - 1) < 0.00001);
    result.checks.embeddings = {
      status: 'passed',
      dimensions: 768,
      model: embedding.model,
      normalized: true,
    };
  } catch (error) {
    result.checks.embeddings = failure(error);
  }
  result.status = Object.values(result.checks).every((check) => check.status === 'passed')
    ? 'passed'
    : 'failed';
  return result;
});

await checked('Tiger Data', async () => {
  if (!present('DATABASE_URL')) return { status: 'blocked', missing: ['DATABASE_URL'] };
  const endpoint = new URL(process.env.DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(endpoint.protocol));
  const result = { status: 'running', checks: {} };
  try {
    await lookup(endpoint.hostname);
    result.checks.dns = 'passed';
  } catch (error) {
    return { ...result, ...failure(error), stage: 'DNS' };
  }
  try {
    await tcpReachable(endpoint.hostname, Number(endpoint.port) || 5432);
    result.checks.tcp = 'passed';
  } catch (error) {
    return {
      ...result,
      ...failure(error),
      stage: 'TCP',
      reason:
        'Database TCP endpoint could not be reached; authentication and TLS were not reached.',
    };
  }
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
    statement_timeout: 10000,
  });
  let transaction = false,
    stage = 'PostgreSQL authentication';
  try {
    await client.connect();
    result.checks.authentication = 'passed';
    result.checks.tls = client.connection.stream.encrypted ? 'enabled' : 'disabled';
    stage = 'pgvector extension';
    let extension = await client.query(
      "SELECT extversion FROM pg_extension WHERE extname='vector'",
    );
    if (!extension.rowCount && !setup)
      return {
        ...result,
        status: 'blocked',
        stage,
        code: 'MISSING_PGVECTOR',
        reason: 'Connection succeeded, but pgvector is not enabled in this database.',
        action:
          'Run npm run verify:live -- --service=tiger --setup to enable the extension required by application startup.',
      };
    if (!extension.rowCount) {
      const available = await client.query(
        "SELECT name FROM pg_available_extensions WHERE name='vector'",
      );
      if (!available.rowCount)
        return {
          ...result,
          status: 'blocked',
          stage,
          code: 'PGVECTOR_UNAVAILABLE',
          reason:
            'This server does not offer the vector extension; enable availability through Tiger Data before retrying.',
        };
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      extension = await client.query("SELECT extversion FROM pg_extension WHERE extname='vector'");
      result.checks.extensionSetup = 'enabled vector extension';
    }
    assert.equal(extension.rowCount, 1);
    result.checks.pgvector = extension.rows[0].extversion;
    stage = 'JSONB and vector round trip';
    await client.query('BEGIN');
    transaction = true;
    await client.query(
      'CREATE TEMP TABLE redactor_live_probe (body JSONB, embedding vector(768)) ON COMMIT DROP',
    );
    const vector = JSON.stringify([1, ...Array(767).fill(0)]);
    await client.query(
      'INSERT INTO redactor_live_probe(body,embedding) VALUES($1::jsonb,$2::vector)',
      [JSON.stringify({ synthetic: true, probe: 'redactor-live-connection' }), vector],
    );
    const query = await client.query(
      'SELECT body, 1-(embedding <=> $1::vector) AS similarity FROM redactor_live_probe',
      [vector],
    );
    assert.equal(query.rows[0].body.probe, 'redactor-live-connection');
    assert(Math.abs(Number(query.rows[0].similarity) - 1) < 0.00001);
    result.checks.jsonbRoundTrip = 'passed';
    result.checks.cosineSimilarity = 'passed';
    await client.query('ROLLBACK');
    transaction = false;
    result.checks.cleanup = 'rollback; no persistent application records changed';
    result.status = 'passed';
    return result;
  } catch (error) {
    return {
      ...result,
      ...failure(error),
      stage,
      ...(error.code === '42501'
        ? {
            reason:
              'The database role lacks permission for this check; use a role authorized to enable vector and create temporary tables.',
          }
        : {}),
    };
  } finally {
    if (transaction) await client.query('ROLLBACK').catch(() => {});
    await client.end().catch(() => {});
  }
});

await checked('Auth0', async () => {
  const missing = ['AUTH0_ISSUER_BASE_URL', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET'].filter(
    (key) => !present(key),
  );
  if (missing.length) return { status: 'blocked', missing };
  const issuer = process.env.AUTH0_ISSUER_BASE_URL.replace(/\/$/, '');
  assert.equal(new URL(issuer).protocol, 'https:');
  const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw Object.assign(new Error('Auth0 discovery rejected'), { providerStatus: response.status });
  const discovery = await response.json();
  assert.equal(discovery.issuer.replace(/\/$/, ''), issuer);
  assert(discovery.authorization_endpoint && discovery.token_endpoint && discovery.jwks_uri);
  const keys = await fetch(discovery.jwks_uri, { signal: AbortSignal.timeout(15000) });
  assert(keys.ok && (await keys.json()).keys?.length);
  return {
    status: 'partial',
    discovery: 'passed',
    signingKeys: 'passed',
    interactiveLogin: 'not tested',
    reason:
      'An officer and requester must complete interactive login to verify client credentials, callback, token validation and roles.',
  };
});

await checked('ElevenLabs', async () => {
  if (!present('ELEVENLABS_API_KEY')) return { status: 'blocked', missing: ['ELEVENLABS_API_KEY'] };
  const voice = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json', 'xi-api-key': process.env.ELEVENLABS_API_KEY },
      body: JSON.stringify({
        text: 'Redactor live connection test. This is a synthetic workspace briefing.',
        model_id: 'eleven_multilingual_v2',
      }),
    },
  );
  if (!response.ok)
    throw Object.assign(new Error('Voice generation rejected'), {
      providerStatus: response.status,
    });
  const audio = Buffer.from(await response.arrayBuffer());
  assert(response.headers.get('content-type')?.includes('audio/'));
  assert(audio.length > 1000);
  mkdirSync('data/live-verification', { recursive: true });
  writeFileSync('data/live-verification/elevenlabs-test.mp3', audio);
  return {
    status: 'passed',
    synthesis: 'passed',
    audioBytes: audio.length,
    sample: 'data/live-verification/elevenlabs-test.mp3',
  };
});

report.status = Object.values(report.services).every((service) => service.status === 'passed')
  ? 'passed'
  : 'incomplete';
save();
console.log(`Report: ${reportPath}`);
process.exitCode = report.status === 'passed' ? 0 : 2;
