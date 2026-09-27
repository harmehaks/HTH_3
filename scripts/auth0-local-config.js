// Public settings supplied by the user's configured Express application.
// Secrets remain in environment variables and are never printed here.
export function configureLocalAuth0() {
  Object.assign(process.env, {
    AUTH0_ISSUER_BASE_URL: 'https://dev-i7p4kdozefycl6u7.ca.auth0.com',
    AUTH0_CLIENT_ID: 'EdEu2b1ioiUTJrEvBVTDxuB1XSuOLzOX',
    AUTH0_BASE_URL: 'http://localhost:3000',
    DEMO_MODE: 'false',
    PORT: '3001',
    HOST: '127.0.0.1',
  });
}
