import { spawn } from 'node:child_process';
const env = {
  ...process.env,
  DEMO_MODE: 'true',
  DATA_PATH: ':memory:',
  PORT: '3002',
  GEMINI_API_KEY: '',
  DATABASE_URL: '',
  AUTH0_ISSUER_BASE_URL: '',
  AUTH0_CLIENT_ID: '',
  AUTH0_CLIENT_SECRET: '',
  AUTH0_BASE_URL: 'http://127.0.0.1:5174',
  VITE_API_TARGET: 'http://127.0.0.1:3002',
};
const backend = spawn(process.execPath, ['server/index.js'], { env, stdio: 'inherit' });
const frontend = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort'],
  { env, stdio: 'inherit' },
);
function close() {
  backend.kill();
  frontend.kill();
}
process.on('SIGTERM', close);
process.on('SIGINT', close);
process.on('exit', close);
