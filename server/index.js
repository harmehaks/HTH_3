import 'dotenv/config';
import { createStore } from './store.js';
import { seed } from './seed.js';
import { createApp } from './app.js';
const store = await createStore();
if (process.env.DEMO_MODE !== 'false' && !process.env.AUTH0_ISSUER_BASE_URL) await seed(store);
const app = createApp(store);
const server = app.listen(Number(process.env.PORT) || 3001, process.env.HOST || '127.0.0.1', () =>
  console.log(
    `Mr. Redactor API ready at http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3001} (${store.backend})`,
  ),
);
process.on('SIGTERM', () => server.close(() => store.close()));
