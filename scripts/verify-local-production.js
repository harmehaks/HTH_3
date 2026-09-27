// Serve the compiled app on a free port with fictional records and no external services.
import { once } from 'node:events';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { seed } from '../server/seed.js';

for (const name of [
  'DATABASE_URL',
  'GEMINI_API_KEY',
  'ELEVENLABS_API_KEY',
  'AUTH0_ISSUER_BASE_URL',
  'AUTH0_CLIENT_ID',
  'AUTH0_CLIENT_SECRET',
])
  process.env[name] = '';
process.env.DEMO_MODE = 'true';
const store = await createStore({ url: '', path: ':memory:' });
let server;
try {
  await seed(store);
  server = createApp(store, { demo: true }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  process.env.PRODUCTION_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  await import('./verify-production.js');
} finally {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  await store.close();
}
