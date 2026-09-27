import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createStore } from '../server/store.js';

test('the rebrand opens existing records from the original default SQLite filename', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'mr-redactor-compat-'));
  const storeModule = pathToFileURL(resolve('server/store.js')).href;
  let store;
  try {
    store = await createStore({ url: '', path: join(directory, 'data/redactor.sqlite') });
    await store.put('request', {
      id: 'existing-officer-record',
      title: 'Existing workspace record',
    });
    await store.close();
    store = null;
    const child = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      import assert from 'node:assert/strict';
      import { createStore } from ${JSON.stringify(storeModule)};
      const store = await createStore({ url: '' });
      try {
        assert.equal((await store.get('existing-officer-record')).title, 'Existing workspace record');
      } finally { await store.close(); }
    `,
      ],
      {
        cwd: directory,
        env: { ...process.env, DATABASE_URL: '', DATA_PATH: '' },
        encoding: 'utf8',
        timeout: 10000,
      },
    );
    assert.equal(child.status, 0, child.stderr);
    assert.equal(existsSync(join(directory, 'data/mr-redactor.sqlite')), false);
  } finally {
    if (store) await store.close();
    // Only the temporary directory created by this test is eligible for removal.
    assert.equal(dirname(resolve(directory)).toLowerCase(), resolve(tmpdir()).toLowerCase());
    assert(basename(directory).startsWith('mr-redactor-compat-'));
    rmSync(directory, { recursive: true, force: true });
  }
});
