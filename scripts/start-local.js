// An explicit storage choice, never an automatic fallback after a database error.
// Set before dotenv loads so a saved cloud URL cannot replace the empty value.
process.env.DATABASE_URL = '';
console.log('Local SQLite storage selected. Configured Gemini remains enabled.');
await import('../server/index.js');
