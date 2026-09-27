# Mr. Redactor bundle review

Historical review of the supplied bundle before integration. The six listed issues have since been addressed in the merged code; see [integration notes](../docs/REBRAND_INTEGRATION.md) for the fixes and current verification limits.

Reviewed on 2026-09-26. Recommendation: keep the visual direction, but fix the functional and compatibility issues before integrating it.

## Bundle and review scope

- File: `mr-redactor-rebrand (1).bundle`.
- SHA-256: `62eb9fb7165afbbc0881383ccfd29e1c4f8ca21d74ac2d9ea2243264ce474885`.
- Bundle branch: `feature/mr-redactor-rebrand`.
- Rebrand commit: `f36ae6940b92b49358b2f98e2488d840d6ae0b72`.
- Base: `ed132e3`, older than the current disclosure branch at `2e5ae56`.
- Git bundle verification passed. The rebrand commit changes 31 files, with 2,173 insertions and 661 deletions.
- Reviewed and executed in `data/rebrand-review-f36ae69`, a separate checkout. The main application's branch, source, environment, database and existing local edits were preserved. No merge or push was performed.
- Dependencies were installed with lifecycle scripts disabled. The isolated probes used an in-memory database and fictional demo records. No real Gemini, Tiger Data, Auth0 or ElevenLabs credentials were supplied to the bundle.

## Findings, ranked

### 1. High: authenticated Auth0 users remain on the landing screen

Sources: `src/App.tsx:71`, `src/App.tsx:188`, `src/App.tsx:195`; `src/Login.tsx:63`, `src/Login.tsx:73` in the review checkout.

The app requires both a server-authenticated user and the browser's `mr-redactor-entered` flag to open the workspace. The flag is set by the demo sign-in callback. Auth0 sign-in redirects to `/login` before that callback executes, so a successful provider return still leaves the flag unset. A fresh tab with an already authenticated session has the same problem.

Reproduced against the compiled UI by supplying an authenticated officer session through a mocked `/api/session` response and simulating the redirect back from `/login`. The user remained on the landing screen, the dashboard count was zero and the entry flag remained null. This is a frontend contract reproduction, not a live Auth0 provider test.

Fix: make an authenticated Auth0 session sufficient to enter the workspace; scope the presentation flag to local demo mode. Add a browser test that starts with an authenticated provider session and empty session storage, including a successful redirect return.

### 2. High: the ElevenLabs briefing is no longer reachable from the interface

Sources: `src/App.tsx:44`, `src/Dashboard.tsx:21`, `src/Dialogs.tsx:517`.

The rebrand explicitly removes the dashboard briefing strip, `onBriefing` handler, `BriefingDialog` import and modal rendering. The dialog implementation and backend briefing endpoints remain, and the integration settings still advertise spoken briefings. The compiled dashboard has zero `Listen to briefing` buttons.

Fix: restore the briefing entry point and modal with the new styling, preserving the newer priority-request transcript behavior. Keep the existing backend and reconnect the UI. Restore a browser assertion that opens and reads the briefing.

### 3. High for existing SQLite installations: the database filename changes without migration

Source: `server/store.js:8`.

The default changes from `data/redactor.sqlite` to `data/mr-redactor.sqlite`. Without an explicit `DATA_PATH`, existing SQLite installations start with a new database and can appear to have lost their requests. The old database is not deleted, but no migration or path fallback is provided.

An installation using `DATABASE_URL` for Tiger Data bypasses this default, so the hosted database currently configured for the main app is not affected by this filename change.

Fix: retain the existing database filename, or introduce an explicit migration with a backup and verification. A brand name does not require a storage filename change.

### 4. High for existing clients and verification scripts: the API header changes

Sources: `src/api.ts:7`, `server/app.js:117`; current main checkout `scripts/verify-live-workflow.js:121`.

The server now requires `X-Mr-Redactor-Client` and rejects the existing `X-Redactor-Client` header. The new frontend was updated, but the current live workflow verifier still sends the original header. Reproduced on the same role endpoint: original header returned HTTP 403; new header returned HTTP 200.

Fix: preserve the existing protocol header, or accept both during a deliberate compatibility transition and update every caller. The bundle's direct audio request in `BriefingDialog` already uses the new header; ensure that request and the current live verifier agree with the final server header after integration.

### 5. Medium: the Auth0 role claim namespace and setup instructions disagree

Sources: `server/app.js:86`, `.env.example:19`, `README.md:120` in the review checkout.

The server default and environment template use `https://mrredactor.app/roles`, while the README's Auth0 Action uses `https://redactor.app/roles`. Following those instructions with the new template can assign an officer the requester role because the claim is read under a different namespace.

The main app's explicit existing `AUTH0_ROLES_CLAIM` can preserve compatibility. This is a new/default setup problem, not evidence of a live provider failure in the current environment.

Fix: keep the existing claim namespace, or update the provider Action, app configuration and documentation together.

### 6. Medium: the closed sign-in panel traps keyboard navigation in hidden controls

Sources: `src/Login.tsx:159`, `src/styles.css:5832`.

The closed panel is moved offscreen and marked `aria-hidden`, but its buttons and inputs remain in the tab order. Reproduced from a fresh landing page: after two Tab presses, focus was on `Close sign-in panel` inside a panel with `aria-hidden="true"`.

Fix: unmount the closed panel or make it inert. When open, give it dialog semantics, contain focus, and restore focus to the Sign in button when closed.

## Compatibility with the current disclosure branch

The bundle is based on an older version. Switching the entire app to the bundle would omit newer disclosure features and fixes. A proper three-way integration can preserve additions from the current branch; the older base does not itself mean the friend intentionally deleted those additions.

A non-applying `git merge-tree` check against current committed HEAD predicts ten conflicting paths: two test files, seven screenshots and one evaluation JSON file. This check does not include the main checkout's uncommitted live-verification helpers or environment edits. Those require separate preservation and compatibility checks.

Keep the current evidence-validation and leak-detection fixes, ATI references, published comparison, independent evaluation, Disclosure Lens, release-readiness UI, live verification scripts and portable runtime changes while integrating the design. Refresh screenshots and evaluation artifacts after the final integrated code is tested. Do not resolve test conflicts by replacing the newer tests wholesale.

The rebrand also adds request/document deletion behavior. Its tests require officer access and a rationale and prevent deleting released records. Treat this as a separate functional change during integration review rather than incidental branding.

## Validation results

| Check | Result |
| --- | --- |
| Git bundle validity | Passed |
| TypeScript and production build | Passed |
| Backend tests | 25/25 passed |
| Bundled browser tests | 7/7 passed |
| Demo officer sign-in | Passed |
| Fresh authenticated-provider session | Failed: stays on landing |
| Existing API client header | Failed: HTTP 403 |
| Briefing dashboard entry point | Missing |
| Closed sign-in panel keyboard focus | Failed: hidden control receives focus |
| Mobile dashboard after layout settles | Passed: 390px viewport, 390px document |
| Reduced-motion landing after initial delay | Visible |
| Additional probe page errors | None |
| Live external providers | Not tested in this isolated review |

The bundled browser tests set the entry flag before nearly every scenario. The sign-in test exercises the demo path, so passing those tests does not establish that Auth0 sign-in works. The removed briefing assertions also explain why the missing voice UI does not fail the bundled suite.

Probe details: [review-probe.json](../data/rebrand-review-f36ae69/artifacts/review-probe.json). Reproduction script: [review-probe.js](../data/rebrand-review-f36ae69/scripts/review-probe.js).

## Design assessment and previews

The dossier theme is coherent: cream paper surfaces, dark ink panels, burgundy accents, monospaced labels, a new redaction-themed icon, Parliament Hill artwork and a dedicated sign-in page. Navigation and the review/release workflow remain usable in the bundled demo tests. The mobile dashboard fits the viewport once layout settles. The keyboard issue and provider login need attention before this can be called a polished sign-in experience.

- [Sign-in preview](../data/rebrand-review-f36ae69/artifacts/review-login-desktop-animated.png)
- [Desktop dashboard](../data/rebrand-review-f36ae69/artifacts/review-dashboard-desktop.png)
- [Mobile dashboard](../data/rebrand-review-f36ae69/artifacts/review-dashboard-mobile.png)

Suggested integration order: preserve current work; integrate on a separate branch; resolve test conflicts while retaining current coverage; fix provider entry, briefing access, storage/protocol compatibility and focus handling; run the current backend, browser, production and live workflow verification against the combined app. Keep provider claims and existing data identifiers stable unless an explicit migration is included.
