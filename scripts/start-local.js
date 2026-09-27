// An explicit storage choice, never an automatic fallback after a database error.
// Set before dotenv loads so a saved cloud URL cannot replace the empty value.
process.env.DATABASE_URL = '';
if (process.argv.includes('--demo')) {
  process.env.DEMO_MODE = 'true';
  process.env.AUTH0_ISSUER_BASE_URL = '';
  process.env.AUTH0_CLIENT_ID = '';
  process.env.AUTH0_CLIENT_SECRET = '';
  console.log(
    'Explicit local demo selected. Demo roles replace Auth0 only in this process; saved credentials are unchanged.',
  );
}
console.log('Local SQLite storage selected. Configured Gemini remains enabled.');
await import('../server/index.js');
