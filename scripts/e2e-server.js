// Single test host: no orphaned API/Vite child processes.
import { createServer } from 'vite';
import { createStore } from '../server/store.js';
import { createApp } from '../server/app.js';
import { seed } from '../server/seed.js';
Object.assign(process.env, {
  DEMO_MODE: 'true',
  DATA_PATH: ':memory:',
  GEMINI_API_KEY: '',
  DATABASE_URL: '',
  AUTH0_ISSUER_BASE_URL: '',
  AUTH0_CLIENT_ID: '',
  AUTH0_CLIENT_SECRET: '',
  AUTH0_BASE_URL: 'http://127.0.0.1:5174',
  VITE_API_TARGET: 'http://127.0.0.1:3002',
});
const store = await createStore({ path: ':memory:', url: '' });
await seed(store);
const api = createApp(store).listen(3002, '127.0.0.1');
const frontend = await createServer({
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
});
await frontend.listen();
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await frontend.close();
  api.closeAllConnections();
  await new Promise((resolve) => api.close(resolve));
  await store.close();
}
process.on('SIGTERM', () => close().then(() => process.exit(0)));
process.on('SIGINT', () => close().then(() => process.exit(0)));
