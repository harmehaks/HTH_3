import { configureLocalAuth0 } from './auth0-local-config.js';
configureLocalAuth0();
console.log(
  'Auth0 selected for http://localhost:3000. Use the Express application client secret in .env.',
);
await import('./start-local.js');
