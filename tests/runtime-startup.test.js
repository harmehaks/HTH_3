import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { createStore } from '../server/store.js';

test(
  'a stalled PostgreSQL connection fails promptly without exposing credentials or selecting SQLite',
  { timeout: 3000 },
  async () => {
    const sockets = new Set();
    const endpoint = createServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    }).listen(0, '127.0.0.1');
    await once(endpoint, 'listening');
    const previousSSL = process.env.DATABASE_SSL;
    process.env.DATABASE_SSL = 'false';
    const started = Date.now();
    try {
      await assert.rejects(
        createStore({
          url: `postgresql://fictional:private-test-marker@127.0.0.1:${endpoint.address().port}/test`,
          connectionTimeoutMillis: 100,
        }),
        (error) => {
          assert.match(error.message, /Tiger Data startup failed/);
          assert.match(error.message, /npm run dev:local/);
          assert(!error.message.includes('private-test-marker'));
          return true;
        },
      );
      assert(Date.now() - started < 2000);
    } finally {
      if (previousSSL === undefined) delete process.env.DATABASE_SSL;
      else process.env.DATABASE_SSL = previousSSL;
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => endpoint.close(resolve));
    }
  },
);
