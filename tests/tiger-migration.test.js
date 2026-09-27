import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import pg from 'pg';
import { auditHash } from '../server/audit.js';
import {
  readRecords,
  backupSQLite,
  fingerprint,
  assertCompatible,
  migrateRecords,
} from '../scripts/migrate-tiger.js';

function fixture() {
  const event = { id: 'audit-fixture', sequence: 1, previousHash: 'genesis', action: 'fixture' };
  return [
    {
      id: 'request-fixture',
      kind: 'request',
      body: { id: 'request-fixture', title: 'Synthetic migration test', documents: [] },
    },
    {
      id: 'corpus-fixture',
      kind: 'corpus',
      body: {
        id: 'corpus-fixture',
        text: 'Public fixture',
        embedding: [0.123456789, ...Array(767).fill(0)],
        embeddingModel: 'migration-test',
      },
    },
    { id: event.id, kind: 'audit', body: { ...event, hash: auditHash(event) } },
  ];
}

test('migration snapshots include SQLite WAL records and preserve the source and audit chain', () => {
  const directory = mkdtempSync(join(tmpdir(), 'redactor-migrate-test-'));
  const source = join(directory, 'source.sqlite');
  const backup = join(directory, 'backup.sqlite');
  const db = new DatabaseSync(source);
  try {
    db.exec(
      'PRAGMA journal_mode=WAL; CREATE TABLE records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,body TEXT NOT NULL)',
    );
    for (const row of fixture())
      db.prepare('INSERT INTO records VALUES(?,?,?)').run(
        row.id,
        row.kind,
        JSON.stringify(row.body),
      );
    const before = readRecords(source);
    backupSQLite(source, backup);
    assert.equal(fingerprint(readRecords(backup)), fingerprint(before));
    assert.equal(fingerprint(readRecords(source)), fingerprint(before));
    // A malformed vector or broken audit chain must fail before any destination writes.
    const invalid = fixture()[1];
    invalid.body.embedding = [1];
    db.prepare('UPDATE records SET body=? WHERE id=?').run(
      JSON.stringify(invalid.body),
      invalid.id,
    );
    assert.throws(() => readRecords(source), /invalid embeddings/);
    db.prepare('UPDATE records SET body=? WHERE id=?').run(
      JSON.stringify(fixture()[1].body),
      invalid.id,
    );
    const audit = fixture()[2];
    audit.body.action = 'changed';
    db.prepare('UPDATE records SET body=? WHERE id=?').run(JSON.stringify(audit.body), audit.id);
    assert.throws(() => readRecords(source), /audit chain/);
  } finally {
    db.close();
    assert.equal(dirname(resolve(directory)).toLowerCase(), resolve(tmpdir()).toLowerCase());
    assert(basename(directory).startsWith('redactor-migrate-test-'));
    rmSync(directory, { recursive: true, force: true });
  }
});

test('migration rejects destination conflicts and extra records but accepts reordered JSON', () => {
  const rows = fixture();
  assert.doesNotThrow(() => assertCompatible(rows, []));
  const reordered = rows.map(({ id, kind, body }) => ({
    body: Object.fromEntries(Object.entries(body).reverse()),
    kind,
    id,
  }));
  assert.doesNotThrow(() => assertCompatible(rows, reordered));
  assert.equal(fingerprint(rows), fingerprint(reordered.reverse()));
  const changed = structuredClone(rows);
  changed[0].body.title = 'Different remote work';
  assert.throws(() => assertCompatible(rows, changed), /different records/);
  assert.throws(
    () => assertCompatible(rows, [{ id: 'unrelated', kind: 'request', body: {} }]),
    /different records/,
  );
});

test(
  'real PostgreSQL migration round-trips vectors, reruns safely, refuses conflicts and rolls back failures',
  { skip: !process.env.MIGRATION_TEST_DATABASE_URL, timeout: 30000 },
  async () => {
    const url = new URL(process.env.MIGRATION_TEST_DATABASE_URL);
    assert.equal(
      url.hostname,
      '127.0.0.1',
      'Integration tests require an isolated localhost database',
    );
    assert.equal(url.pathname, '/redactor_migration_test');
    const client = new pg.Client({
      connectionString: url.toString(),
      ssl: false,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    try {
      assert.equal(
        (await client.query("SELECT to_regclass('public.records') AS name")).rows[0].name,
        null,
      );
      const rows = fixture();
      const result = await migrateRecords(client, rows);
      assert.equal(result.records, 3);
      assert.equal(result.vectors, 1);
      assert.equal(result.auditVerified, true);
      assert.equal(result.fingerprint, fingerprint(rows));
      assert.deepEqual(await migrateRecords(client, rows), result);
      await client.query(
        "UPDATE records SET body=jsonb_set(body,'{title}','\"Remote decision\"') WHERE id='request-fixture'",
      );
      await assert.rejects(migrateRecords(client, rows), /different records/);
      assert.equal(
        (
          await client.query(
            "SELECT body->>'title' AS title FROM records WHERE id='request-fixture'",
          )
        ).rows[0].title,
        'Remote decision',
      );
      await client.query('TRUNCATE records, corpus_vectors');
      await assert.rejects(
        migrateRecords(client, rows, {
          beforeCommit: async () => {
            throw new Error('source changed');
          },
        }),
        /source changed/,
      );
      assert.equal(
        (await client.query('SELECT count(*)::int AS count FROM records')).rows[0].count,
        0,
      );
      assert.equal(
        (await client.query('SELECT count(*)::int AS count FROM corpus_vectors')).rows[0].count,
        0,
      );
    } finally {
      await client.end();
    }
  },
);
