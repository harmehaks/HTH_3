import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { updateEnvironment } from '../scripts/configure-auth0.js';

test('local Auth0 setup preserves other service credentials and removes conflicting duplicate Auth0 settings', () => {
  const text =
    '# Keep other services\r\nGEMINI_API_KEY=synthetic-gemini\r\nDATABASE_URL="postgres://synthetic:synthetic@db.test/workspace"\r\nELEVENLABS_API_KEY=synthetic-voice\r\nSESSION_SECRET=synthetic-existing-session-secret-long-enough\r\nAUTH0_CLIENT_ID=old\r\nexport AUTH0_CLIENT_ID=conflicting\r\nAUTH0_CLIENT_SECRET=old-placeholder\r\n';
  const result = updateEnvironment(text, {
    AUTH0_CLIENT_ID: 'synthetic-new-client',
    AUTH0_CLIENT_SECRET: 'synthetic-new-secret',
    AUTH0_BASE_URL: 'http://localhost:3000',
  });
  const before = dotenv.parse(text),
    after = dotenv.parse(result);
  for (const name of ['GEMINI_API_KEY', 'DATABASE_URL', 'ELEVENLABS_API_KEY', 'SESSION_SECRET'])
    assert.equal(after[name], before[name]);
  assert.equal(after.AUTH0_CLIENT_ID, 'synthetic-new-client');
  assert.equal(after.AUTH0_CLIENT_SECRET, 'synthetic-new-secret');
  assert.equal(after.AUTH0_BASE_URL, 'http://localhost:3000');
  assert.equal(result.split('\n').filter((line) => line.startsWith('AUTH0_CLIENT_ID=')).length, 1);
  assert.ok(result.startsWith('# Keep other services\n'));
});
