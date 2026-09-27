import { configureLocalAuth0 } from './auth0-local-config.js';
configureLocalAuth0();
process.argv.push('--service=auth0');
await import('./verify-live-integrations.js');
