# Runtime startup repair

The reported frontend connection errors came from an unreachable Tiger Data endpoint: API startup failed, so Vite could not proxy `/api/session` to port 3001. A stale earlier dev process occupied port 5173, causing another copy to move to 5174. The stale project process was stopped.

A further configuration issue was found after selecting SQLite: Auth0 client ID and secret were present, but `AUTH0_ISSUER_BASE_URL` was missing. Those credentials were preserved; they have not been replaced or printed.

The runtime repair was verified at **http://127.0.0.1:5173**, with the API on port 3001, existing SQLite records, configured Gemini and explicitly selected demo roles. GET navigation, sign-in and the briefing passed browser checks with zero console/page errors. No stored documents were edited during this running-app check. The subsequent Auth0 setup now runs at **http://localhost:3000**; see [Auth0 setup](AUTH0_SETUP.md).

## Commands

- `npm run dev`: configured database and Auth0.
- `npm run dev:local`: existing local SQLite, configured Gemini and Auth0. Requires complete Auth0 settings if any are present.
- `npm run dev:demo`: existing local SQLite, configured Gemini and explicit demo roles. Saved Tiger/Auth0 values remain in `.env` unchanged.
- `npm run dev:auth0`: existing local SQLite and real Auth0 using the supplied Express application registered for localhost:3000. Secrets stay in `.env`.
- `npm run start:demo`: the same explicit demo settings for the compiled app on port 3001, after `npm run build`.

Stop an existing dev process with Ctrl+C before starting another copy. Vite now refuses an occupied 5173 instead of silently changing the app URL. This behavior was verified while the repaired app remained running.

## Changes and limits

Database connections now have a ten-second deadline; initialization errors close the failed pool and give a recovery command without exposing credentials. Background pool connection errors are handled. Server startup and occupied API-port errors have readable messages, and shutdown closes the listener and store. An unreadable proxy error now produces a clear backend-unavailable message in the UI.

There is no automatic database or authentication fallback. Local/demo commands select their modes explicitly and do not edit `.env`. All **36 backend tests and 12 browser tests passed**, including a stalled PostgreSQL connection and retry after the API returns. The production build and isolated compiled-production checks passed. The running app's API health and proxied session returned HTTP 200.

Tiger Data could not be reached during the runtime repair; DNS resolved, but TCP timed out before authentication/TLS. The tenant and Express client ID have since been supplied. The Auth0 setup passed live discovery, signing-key and browser-handoff checks; complete interactive login to verify the matching client secret and account roles. Do not put a client secret in browser configuration.

Running-app evidence: [runtime-verification.json](../artifacts/runtime-verification.json).
