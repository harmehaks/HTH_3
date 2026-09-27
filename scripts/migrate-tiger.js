import 'dotenv/config';
import pg from 'pg';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { auditHash, verifyAudit } from '../server/audit.js';

class MigrationError extends Error {}

export function readRecords(source) {
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok')
      throw new MigrationError('SQLite integrity check failed.');
    const rows = db.prepare('SELECT id, kind, body FROM records ORDER BY id').all();
    for (const row of rows) {
      row.body = JSON.parse(row.body);
      if (!row.body || row.body.id !== row.id)
        throw new MigrationError('A source record has an invalid ID.');
      if (row.kind === 'corpus') {
        const { embedding, embeddingModel } = row.body;
        if (
          !Array.isArray(embedding) ||
          embedding.length !== 768 ||
          !embedding.every(Number.isFinite) ||
          typeof embeddingModel !== 'string' ||
          !embeddingModel
        )
          throw new MigrationError(
            'A reference has invalid embeddings. Reindex the local library first.',
          );
      }
    }
    if (!rows.length) throw new MigrationError('Source database is empty.');
    if (!verifyAudit(rows.filter((r) => r.kind === 'audit').map((r) => r.body)))
      throw new MigrationError('The source audit chain did not verify.');
    return rows;
  } finally {
    db.close();
  }
}

export function fingerprint(rows) {
  return auditHash([...rows].sort((a, b) => a.id.localeCompare(b.id)));
}

export function assertCompatible(source, destination) {
  const expected = new Map(source.map((row) => [row.id, row]));
  for (const row of destination) {
    const original = expected.get(row.id);
    if (!original || auditHash(original) !== auditHash(row))
      throw new MigrationError(
        'Tiger contains different records. No overwrite or automatic merge is allowed.',
      );
  }
}

export function backupSQLite(source, destination) {
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    db.prepare('VACUUM INTO ?').run(destination);
  } finally {
    db.close();
  }
}

export async function inspectDestination(client, source) {
  const tables = (
    await client.query(
      "SELECT to_regclass('public.records') AS records, to_regclass('public.corpus_vectors') AS vectors",
    )
  ).rows[0];
  const existing = tables.records
    ? (await client.query('SELECT id, kind, body FROM public.records ORDER BY id')).rows
    : [];
  assertCompatible(source, existing);
  if (tables.vectors) {
    const ids = new Set(source.filter((r) => r.kind === 'corpus').map((r) => r.id));
    const vectors = (await client.query('SELECT id FROM public.corpus_vectors')).rows;
    if (vectors.some((row) => !ids.has(row.id)))
      throw new MigrationError(
        'Tiger contains unrelated vectors. No overwrite or automatic merge is allowed.',
      );
  }
  return existing.length;
}

export async function migrateRecords(client, rows, { beforeCommit = async () => {} } = {}) {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    await client.query(
      'CREATE TABLE IF NOT EXISTS public.records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, body JSONB NOT NULL)',
    );
    await client.query(
      'CREATE TABLE IF NOT EXISTS public.corpus_vectors (id TEXT PRIMARY KEY, embedding vector(768), model TEXT NOT NULL)',
    );
    // Keep other writers out during conflict checking, copying and verification.
    await client.query(
      'LOCK TABLE public.records, public.corpus_vectors IN SHARE ROW EXCLUSIVE MODE',
    );
    await inspectDestination(client, rows);
    for (const row of rows) {
      await client.query(
        'INSERT INTO public.records(id,kind,body) VALUES($1,$2,$3::jsonb) ON CONFLICT(id) DO NOTHING',
        [row.id, row.kind, JSON.stringify(row.body)],
      );
      if (row.kind === 'corpus') {
        await client.query(
          'INSERT INTO public.corpus_vectors(id,embedding,model) VALUES($1,$2::vector,$3) ON CONFLICT(id) DO UPDATE SET embedding=EXCLUDED.embedding, model=EXCLUDED.model',
          [row.id, JSON.stringify(row.body.embedding), row.body.embeddingModel],
        );
      }
    }
    await client.query(
      'CREATE INDEX IF NOT EXISTS corpus_vectors_cosine ON public.corpus_vectors USING hnsw (embedding vector_cosine_ops)',
    );
    const copied = (await client.query('SELECT id, kind, body FROM public.records ORDER BY id'))
      .rows;
    if (fingerprint(copied) !== fingerprint(rows))
      throw new MigrationError('Record verification failed; the transaction will be rolled back.');
    const expectedVectors = new Map(
      rows.filter((r) => r.kind === 'corpus').map((r) => [r.id, r.body]),
    );
    const vectors = (
      await client.query(
        'SELECT id, embedding::text AS embedding, model FROM public.corpus_vectors',
      )
    ).rows;
    if (vectors.length !== expectedVectors.size)
      throw new MigrationError('Vector count verification failed.');
    for (const vector of vectors) {
      const original = expectedVectors.get(vector.id);
      const values = JSON.parse(vector.embedding);
      // pgvector stores float32 values; compare to their float32 representation.
      if (
        !original ||
        vector.model !== original.embeddingModel ||
        values.length !== 768 ||
        values.some((value, index) => Math.fround(value) !== Math.fround(original.embedding[index]))
      )
        throw new MigrationError('Vector content verification failed.');
    }
    if (!verifyAudit(copied.filter((r) => r.kind === 'audit').map((r) => r.body)))
      throw new MigrationError('Destination audit verification failed.');
    await beforeCommit();
    await client.query('COMMIT');
    return {
      records: copied.length,
      vectors: vectors.length,
      fingerprint: fingerprint(copied),
      auditVerified: true,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

export async function main(args = process.argv.slice(2)) {
  if (
    args.some((arg) => arg !== '--check' && arg !== '--apply') ||
    (args.includes('--check') && args.includes('--apply'))
  )
    throw new MigrationError('Use --check (default) or --apply. Stop app servers before --apply.');
  const apply = args.includes('--apply');
  const directory = resolve('data/migrations');
  mkdirSync(directory, { recursive: true });
  const report = {
    at: new Date().toISOString(),
    mode: apply ? 'apply' : 'check',
    status: 'running',
  };
  const reportPath = join(directory, 'tiger-migration-latest.json');
  let client;
  try {
    const source = resolve(process.env.DATA_PATH || 'data/redactor.sqlite');
    const rows = readRecords(source);
    report.source = {
      records: rows.length,
      counts: Object.fromEntries(
        [...new Set(rows.map((r) => r.kind))].map((kind) => [
          kind,
          rows.filter((r) => r.kind === kind).length,
        ]),
      ),
      fingerprint: fingerprint(rows),
    };
    const rawUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
    if (!rawUrl) throw new MigrationError('Set MIGRATION_DATABASE_URL or DATABASE_URL locally.');
    const url = new URL(rawUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol))
      throw new MigrationError('A PostgreSQL URL is required.');
    // Never weaken TLS when using a cloud destination.
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const ssl =
      local && process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: true };
    url.searchParams.set('sslmode', ssl ? 'verify-full' : 'disable');
    report.destination = {
      host: url.hostname,
      port: url.port || '5432',
      database: url.pathname.slice(1),
    };
    client = new pg.Client({
      connectionString: url.toString(),
      ssl,
      connectionTimeoutMillis: 12000,
      query_timeout: 30000,
    });
    report.stage = 'connection';
    await client.connect();
    report.stage = 'destination preflight';
    report.existingRecords = await inspectDestination(client, rows);
    const extension = (
      await client.query("SELECT name FROM pg_available_extensions WHERE name='vector'")
    ).rows;
    if (!extension.length) throw new MigrationError('The destination does not offer pgvector.');
    if (!apply) {
      report.status = 'ready';
      return report;
    }
    report.stage = 'backup';
    const backup = join(directory, `before-tiger-${Date.now()}-${randomUUID().slice(0, 8)}.sqlite`);
    backupSQLite(source, backup);
    if (fingerprint(readRecords(backup)) !== fingerprint(rows))
      throw new MigrationError('SQLite changed while backing up. Stop app servers and retry.');
    report.backup = backup;
    report.stage = 'transaction';
    report.verification = await migrateRecords(client, rows, {
      beforeCommit: async () => {
        if (fingerprint(readRecords(source)) !== fingerprint(rows))
          throw new MigrationError('SQLite changed during migration. Stop app servers and retry.');
      },
    });
    report.status = 'migrated';
    report.nextStep =
      'Use the verified destination as DATABASE_URL and start with npm start or npm run dev. Local/demo/auth0-local launchers select SQLite explicitly.';
    return report;
  } catch (error) {
    report.status = 'blocked';
    report.code = error.code || 'MIGRATION_FAILED';
    report.reason =
      error instanceof MigrationError
        ? error.message
        : report.stage === 'connection'
          ? 'Could not connect to Tiger. Check service state, network access, credentials and TLS.'
          : 'Migration could not complete. No automatic overwrite or database switch was performed. Inspect the reported stage and error code.';
    process.exitCode = 1;
    return report;
  } finally {
    if (client) await client.end().catch(() => {});
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(() => {
    console.error('Migration arguments or local report path are invalid.');
    process.exitCode = 1;
  });
