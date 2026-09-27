# Auth0 setup for Mr. Redactor

The project is React/Vite with an Express API. The official `express-openid-connect` 2.x package is already included. No Next.js migration is needed.

## 1. Check the Express application

In the Auth0 dashboard, select the application with client ID `EdEu2b1ioiUTJrEvBVTDxuB1XSuOLzOX` on tenant `dev-i7p4kdozefycl6u7.ca.auth0.com`.

| Setting                       | Value                            |
| ----------------------------- | -------------------------------- |
| Application type              | Regular Web Application          |
| Token endpoint authentication | Post (`client_secret_post`)      |
| Allowed callback URLs         | `http://localhost:3000/callback` |
| Allowed logout URLs           | `http://localhost:3000/`         |

The attachment says these dashboard settings are already saved. Open the app using **localhost**, matching these URLs.

## 2. Enter secrets locally

Open the existing `.env` in your editor. Do not paste secrets into chat, put them in any `VITE_` variable, or commit the file. Preserve the existing Gemini, ElevenLabs and database settings.

```dotenv
DEMO_MODE=false
AUTH0_ISSUER_BASE_URL=https://dev-i7p4kdozefycl6u7.ca.auth0.com
AUTH0_CLIENT_ID=EdEu2b1ioiUTJrEvBVTDxuB1XSuOLzOX
AUTH0_CLIENT_SECRET=the-secret-from-this-Express-application
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ROLES_CLAIM=https://redactor.app/roles
SESSION_SECRET=your-own-random-value-at-least-32-characters
```

The secret must belong to this new Express client ID, rather than the earlier Next.js client. Replace the example secret descriptions above with your actual values locally. Leave an existing strong `SESSION_SECRET` unchanged. If you need a new session secret, run this in your own terminal and copy the result into `.env`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Changing `SESSION_SECRET` invalidates existing signed session cookies. This project maps the quickstart's `ISSUER_BASE_URL`, `CLIENT_ID`, `CLIENT_SECRET`, `SECRET` and `BASE_URL` to `AUTH0_ISSUER_BASE_URL`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `SESSION_SECRET` and `AUTH0_BASE_URL` respectively. Use the project names shown here.

## 3. Give an officer access

In Auth0, create the role **officer** and assign it to your officer test user. Create a Post Login Action using this code, deploy it, and add it to the Login flow:

```js
exports.onExecutePostLogin = async (event, api) => {
  api.idToken.setCustomClaim('https://redactor.app/roles', event.authorization?.roles || []);
};
```

Sign in again after changing roles. Users without the officer role receive requester access. The interface cannot grant itself officer access.

## 4. Start the app

Stop the previous development command with Ctrl+C. From the project directory:

```powershell
npm install
npm run dev:auth0
```

Open **http://localhost:3000**. Vite serves the interface on port 3000 and proxies `/api`, `/login`, `/signup`, `/callback` and `/logout` to Express on port 3001. Both ports are fixed; a busy port produces an error instead of silently changing the callback origin.

This command explicitly uses the existing SQLite database at `data/redactor.sqlite`, preserves its records, and leaves saved Tiger Data settings untouched. It enables real Auth0 rather than demo roles and retains configured Gemini/ElevenLabs settings. It sets public localhost configuration only in the launched process. For a different public origin, use the ordinary project launch commands with your corresponding environment and Auth0 settings.

The SDK performs the authorization code flow and PKCE, validates the callback state, nonce and signed identity token, and uses the configured Post client authentication. Server sessions use the selected database; the browser stores only a signed, HttpOnly ID. Logout removes the stored session. Session limits are eight hours of inactivity and 24 hours overall. Keep database files/backups private; stored sessions contain identity tokens. Expired session records are removed when accessed.

For a clean authenticated workspace you may set `DATA_PATH=data/authenticated.sqlite` explicitly. This opts into a separate database; it does not migrate or remove existing records. Existing synthetic demo requests retain their demo owners and will not automatically belong to a real Auth0 requester.

## 5. Test manually

1. Open a private browser window at `http://localhost:3000`. Confirm that the landing page shows Sign in.
2. Open Sign in. Choose Create an account to reach Auth0 signup, or Continue securely to reach Auth0 login. The local password field is disabled; enter credentials only on the tenant's Auth0 page. Social buttons require the corresponding Auth0 connection to be enabled for this application.
3. Complete login as the officer user. Confirm that the officer dashboard opens immediately. Refresh; confirm the workspace remains signed in.
4. Open the profile menu and sign out. Confirm that the landing page returns. Refresh and confirm that officer APIs cannot be accessed while signed out.
5. Log in as a second user without the officer role. Confirm that the requester portal appears and officer review/audit actions are unavailable. Create a request to verify ownership for this real user.
6. Repeat login and logout once more. This checks that the callback URL, token endpoint client credentials, roles Action and session persistence all work together.

Automated checks:

```powershell
npm test
npm run test:e2e
npm run build
npm run verify:auth0
npm run verify:auth0:handoff
```

The SDK integration tests use a synthetic OIDC provider to exercise real code exchange, PKCE, signed-token validation, roles, server sessions, invalid callbacks and logout. Browser tests check the existing demo and authenticated-session UI. `verify:auth0` calls the live tenant's public discovery and signing-key endpoints; it does not authenticate a real user or validate the saved client secret. It deliberately reports `partial` and exits with code 1 until interactive verification is available. With `dev:auth0` running, `verify:auth0:handoff` checks the redirects and opens the real Auth0 login form without entering credentials. Complete the manual steps above to verify live login.

Recorded verification for this setup: **42 backend tests passed, 12 browser tests passed, production build passed, live discovery and signing keys passed, and live browser handoff to the Auth0 login form passed**. The callback error recovery page was also checked at mobile width. Live login remains unresolved: the reported Auth0 `feacft` event and a deliberate invalid-code probe both returned `access_denied`; confirm the matching client secret and authentication method before relying on live login. Evidence: [live discovery](../artifacts/live-auth0-verification.json), [live handoff](../artifacts/auth0-handoff-verification.json), [client diagnostic](../artifacts/auth0-client-diagnostic.json).

## Troubleshooting

If `/callback` reports `access_denied (Unauthorized)` after submitting credentials, first verify the client secret belongs to the Express application `EdEu2b1ioiUTJrEvBVTDxuB1XSuOLzOX`. This launch command intentionally uses that ID, even if `.env` still contains an earlier app's ID. The earlier Next.js app's secret will not match it. Stop the running command and restart `npm run dev:auth0` after editing secrets; refreshing the page does not reload server environment variables. Begin a new login instead of refreshing the previous callback.

In Auth0 **Monitoring → Logs**, inspect the newest failure. A successful login followed by **Failed Exchange: Authorization Code for Token** (`feacft`) points to the code-exchange stage; the description is needed to confirm the cause. Confirm Post authentication and that the Authorization Code grant is enabled. A Login Action denial needs investigation in the Action's logs rather than changing the user's role or password. Browser callback errors now provide a recovery page and preserve the denied authentication state.

Official diagnostic reference: [Auth0's failed code-exchange guidance](https://support.auth0.com/center/s/article/troubleshooting-auth0-log-type-feacft-after-the-success-login-log).

| Error or behavior                         | Fix                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Callback URL mismatch                     | Open localhost:3000 and register exactly `http://localhost:3000/callback` for the Express client above.                  |
| Invalid client / unauthorized client      | Copy the matching Express application's client secret into `.env`; select Post authentication in Auth0. Restart.         |
| Missing/short SESSION_SECRET              | Provide your own random value of at least 32 characters and restart.                                                     |
| Requester portal for the intended officer | Assign officer, deploy the Action, add it to Login flow, and sign out/in again.                                          |
| Social connection unavailable             | Enable that connection for this application or use standard Universal Login.                                             |
| Port 3000 or 3001 occupied                | Stop the older project process before relaunching.                                                                       |
| Tiger Data timeout                        | Use `dev:auth0` for explicit local storage, or repair cloud connectivity before using the ordinary cloud-backed command. |

Official references: [Auth0 Express SDK](https://github.com/auth0/express-openid-connect), [SDK configuration](https://auth0.github.io/express-openid-connect/interfaces/ConfigParams.html), [server-side session store](https://auth0.github.io/express-openid-connect/interfaces/SessionStore.html).
