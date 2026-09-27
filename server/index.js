import 'dotenv/config';
import { createStore } from './store.js';
import { seed } from './seed.js';
import { createApp } from './app.js';
let store, server;
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  if (store) await store.close();
}
try {
  store = await createStore();
  const app = createApp(store);
  if (process.env.DEMO_MODE !== 'false' && !process.env.AUTH0_ISSUER_BASE_URL) await seed(store);
  const port = Number(process.env.PORT) || 3001;
  const host = process.env.HOST || '127.0.0.1';
  server = app.listen(port, host);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  console.log(`Mr. Redactor API ready at http://${host}:${port} (${store.backend})`);
} catch (error) {
  const message =
    error.code === 'EADDRINUSE'
      ? 'API port is already in use. Stop the previous project server before starting another copy.'
      : error.message;
  console.error(`Mr. Redactor could not start: ${message}`);
  await close();
  process.exitCode = 1;
}
process.on('SIGTERM', () => close().then(() => process.exit(0)));
process.on('SIGINT', () => close().then(() => process.exit(0)));
