import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import pg from 'pg';
import { dirname, resolve } from 'node:path';

export async function createStore({
  url = process.env.DATABASE_URL,
  path = process.env.DATA_PATH || 'data/mr-redactor.sqlite',
} = {}) {
  let sqlite, pool;
  if (url) {
    pool = new pg.Pool({
      connectionString: url,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: true },
    });
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    await pool.query(
      'CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, body JSONB NOT NULL)',
    );
    await pool.query(
      'CREATE TABLE IF NOT EXISTS corpus_vectors (id TEXT PRIMARY KEY, embedding vector(768), model TEXT NOT NULL)',
    );
    await pool.query(
      'CREATE INDEX IF NOT EXISTS corpus_vectors_cosine ON corpus_vectors USING hnsw (embedding vector_cosine_ops)',
    );
  } else {
    if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
    sqlite = new DatabaseSync(path);
    sqlite.exec(
      'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, body TEXT NOT NULL)',
    );
  }
  return {
    backend: pool ? 'Tiger Data / PostgreSQL + pgvector' : 'SQLite',
    async all(kind) {
      const rows = pool
        ? (await pool.query('SELECT body FROM records WHERE kind=$1', [kind])).rows
        : sqlite.prepare('SELECT body FROM records WHERE kind=?').all(kind);
      const items = rows.map((r) => (typeof r.body === 'string' ? JSON.parse(r.body) : r.body));
      return kind === 'audit' ? items.sort((a, b) => a.sequence - b.sequence) : items;
    },
    async get(id) {
      const row = pool
        ? (await pool.query('SELECT body FROM records WHERE id=$1', [id])).rows[0]
        : sqlite.prepare('SELECT body FROM records WHERE id=?').get(id);
      return row ? (typeof row.body === 'string' ? JSON.parse(row.body) : row.body) : null;
    },
    async put(kind, item) {
      if (pool)
        await pool.query(
          'INSERT INTO records(id,kind,body) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET body=EXCLUDED.body',
          [item.id, kind, JSON.stringify(item)],
        );
      else
        sqlite
          .prepare(
            'INSERT INTO records(id,kind,body) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
          )
          .run(item.id, kind, JSON.stringify(item));
      return item;
    },
    async delete(id) {
      if (pool) await pool.query('DELETE FROM records WHERE id=$1', [id]);
      else sqlite.prepare('DELETE FROM records WHERE id=?').run(id);
    },
    async vector(id, embedding, model) {
      if (pool)
        await pool.query(
          'INSERT INTO corpus_vectors(id,embedding,model) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET embedding=EXCLUDED.embedding, model=EXCLUDED.model',
          [id, JSON.stringify(embedding), model],
        );
    },
    async similar(embedding, model) {
      if (!pool) return null;
      return (
        await pool.query(
          'SELECT id, 1-(embedding <=> $1::vector) AS similarity FROM corpus_vectors WHERE model=$2 ORDER BY embedding <=> $1::vector LIMIT 5',
          [JSON.stringify(embedding), model],
        )
      ).rows;
    },
    async close() {
      if (pool) await pool.end();
      else sqlite.close();
    },
  };
}
