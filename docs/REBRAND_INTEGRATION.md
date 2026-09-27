# Mr. Redactor integration

The `feature/mr-redactor-rebrand` bundle at `f36ae69` is integrated into `feat/redactor-disclosure-studio`, preserving the newer disclosure features and existing local verification work. The dossier theme, sign-in screen, icon, typography, presentation branding, PDF branding and officer removal controls are included.

## Fixed issues

| Issue | Result |
| --- | --- |
| Auth0 return stays on landing | The entry flag is required only for the local demo. An authenticated provider session opens the workspace directly, including after reload. |
| Briefing controls removed | Overview again offers **Listen to briefing**, with the priority-request transcript, audio controls and text fallback. |
| SQLite filename changed | The default remains `data/redactor.sqlite`; existing records open without moving or recreating the database. Explicit `DATA_PATH` and `DATABASE_URL` remain supported. |
| Existing client header rejected | Frontend and live verifier use `X-Redactor-Client`; the server also accepts `X-Mr-Redactor-Client`. Missing headers and untrusted origins remain rejected. |
| Auth0 role claim mismatch | Server, environment template, integration settings and README use `https://redactor.app/roles`. An explicit existing `AUTH0_ROLES_CLAIM` is still respected. |
| Hidden sign-in controls take focus | The closed panel is inert. Opening it focuses email, Tab stays inside, Escape closes it, and focus returns to Sign in. |

Auth0 base URLs with a trailing slash now compare their parsed origin for API requests, preserving origin restrictions. Demo sign-in hides provider buttons that cannot work without Auth0. Existing theme preferences remain supported. The workspace navigation link is retained.

Newer functionality remains: the sourced ATI comparison, eight completed ATI references, evidence-validation fixes, independent evaluation, Disclosure Lens, release readiness, overlap replacement, receipts, contextual integrity findings and prioritized briefing request IDs. The studio stylesheet was adapted to the dossier palette instead of overwriting the new global theme.

## Verification on 26 September 2026

- **35/35 backend tests passed**, including both request headers, origin restrictions with trailing-slash configuration, existing SQLite record preservation, and deletion rationale/permission gates.
- **11/11 browser tests passed**, including demo entry/exit, requester isolation, simulated Auth0 session/redirect return, closed-panel focus, modal focus containment, narrow-screen sign-in, ATI provenance, disclosure examples, review/release, comparison and briefing transcript.
- **Production build passed**. Compiled dashboard, local fonts/CSP, presentation navigation and API 404 handling passed on a temporary local server with an in-memory database. No browser errors were reported.
- **Live Gemini passed** for classification, independent leak testing and normalized 768-dimensional embeddings using fictional records.
- **Tiger Data could not be verified on the current network**: DNS passed, TCP timed out before authentication/TLS. The disposable-cloud workflow attempt also timed out during connection setup, before any test schema was created. This is recorded as a failure, not a cloud workflow pass.
- **Live Auth0 and ElevenLabs were not tested** because credentials are absent. Auth0 frontend behavior used simulated session/redirect responses; the ElevenLabs request contract is covered by backend mocks. Neither establishes real provider login or synthesis.

Reports: [production](../artifacts/production-verification.json), [Gemini](../artifacts/live-gemini-verification.json), [Tiger Data](../artifacts/live-tiger-verification.json), [cloud workflow attempt](../artifacts/live-workflow-verification.json). The [earlier successful cloud workflow](../artifacts/pre-rebrand-live-workflow-verification.json) preceded this rebrand. It is not evidence of a merged cloud workflow pass today.

Screenshots: [desktop](../artifacts/dashboard-desktop.png), [mobile](../artifacts/dashboard-mobile.png), [dark theme](../artifacts/dashboard-dark.png), [mobile sign-in](../artifacts/sign-in-mobile.png).

## Run and test

From a terminal in the repository:

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Choose **Sign in → Enter as officer** for the demo. Use the profile menu for requester access. Existing `.env` credentials are preserved, and `npm run dev` uses your configured database.

If Tiger Data is unreachable, stop the existing dev process with Ctrl+C and explicitly use local storage:

```powershell
npm run build
npm run start:local
```

Open `http://127.0.0.1:3001`. This selects existing local SQLite without changing `.env`; configured Gemini remains enabled. There is no automatic fallback from a failing cloud database.

Repeat checks with:

```powershell
npm test
npm run test:e2e
npm run build
npm run verify:production:local
npm run verify:live -- --service=gemini
npm run verify:live -- --service=tiger
npm run verify:live-workflow
```

The production-local check uses a free port, in-memory fictional records and no external credentials. The cloud workflow requires a reachable configured Tiger database plus Gemini and confines fictional test records to a disposable schema. Interactive Auth0 login needs its tenant/application/action configured and real officer/requester accounts. ElevenLabs synthesis needs its API key.

## Preserved workspace

The real `.env` and existing databases were not changed. Pre-integration edits, synthetic Air Canada samples, reports and live helpers were restored. The backup stash **Local verification work preserved before Mr Redactor integration** remains available. The bundle review checkout remains under ignored `data/`. No deployment or GitHub push was performed.
