# Mr. Redactor

The Mr. Redactor dossier redesign is integrated with the current disclosure studio. See [integration notes](docs/REBRAND_INTEGRATION.md) for compatibility fixes and verification.

Evidence update: [real ATI sources, comparison demo, evaluation limits and sponsor claims](docs/EVIDENCE.md). Eight distinct completed ATI requests now have official PDF sources and page-level provenance. `npm run evaluate` reports public-release and synthetic results separately; `npm run evaluate:gemini` requires a configured live key.

Disclosure studio update: see [upgrade notes](docs/UPGRADE_NOTES.md) for the release checklist, overlap replacement, disclosure balance, receipt export, regression results and prioritized next steps. Run `npm run evaluate:spans` for the additional synthetic span benchmark.

A complete working prototype for AI-assisted Access to Information review. Mr. Redactor combines an officer dashboard, a document review workspace, an independent contextual leak tester, cross-request consistency checks, a requester portal, and spoken briefings.

The application runs locally without accounts or API keys. Optional live integrations are implemented for **Gemini, Auth0, Tiger Data/PostgreSQL with pgvector, and ElevenLabs**. Live integrations require your credentials and must be verified against your own accounts. This prototype is not a government submission portal or an approved system for operational government records.

Start with [START_HERE.md](START_HERE.md) for the guided walkthrough and remaining account setup. Tested results are in [docs/VERIFICATION.md](docs/VERIFICATION.md).

## 1. Run it now

Requires **Node.js 22.13 or newer** and npm. This workspace was tested with Node 22.20.

From PowerShell:

```powershell
# Open a terminal in this repository directory.
npm install
npm run dev
```

On macOS/Linux, open a terminal in the repository directory and run `npm ci`, then `npm run dev`. To create an environment file: `cp .env.example .env`.

For browser checks on any platform, run `npx playwright install chromium` once, then `npm run test:e2e`. Optional overrides: `PLAYWRIGHT_CHANNEL` or `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

Open **http://127.0.0.1:5173**. The API runs at http://127.0.0.1:3001.

If your saved Tiger Data URL cannot connect, use `npm run dev:local` for the existing SQLite workspace while retaining configured Auth0 and Gemini. If Auth0 setup is incomplete, use `npm run dev:demo` for explicit demo roles and local SQLite, with configured Gemini retained. These commands do not edit `.env`. The frontend uses port 5173 strictly; stop an earlier dev process with Ctrl+C before starting another copy.

Choose **Sign in**, then **Enter as officer** for the local demo, or choose **Requester** to view the requester portal. Demo email/password fields do not authenticate anyone. With Auth0 configured, sign-in uses the provider, and an authenticated session opens the workspace directly. **Overview → Listen to briefing** opens the transcript and audio controls.

Existing installations retain `data/redactor.sqlite`, the `X-Redactor-Client` API header and `https://redactor.app/roles` Auth0 claim. The server also accepts the bundle's `X-Mr-Redactor-Client` header. The new display name does not require changing your Auth0 Action or moving your database.

No `.env` file is required for the local demo. It starts with nine synthetic access requests, one re-review exercise with a pre-attached real ATI reference, sixteen synthetic release excerpts, sixteen proactive-publication excerpts, and eight excerpts from distinct completed ATI responses. Requests and decisions persist in `data/redactor.sqlite`. Fonts and illustrations are served locally; the UI does not require a third-party font service.

If a server is already running in this workspace, open the URL directly. Press **Ctrl+C** in its terminal to stop it. Do not run a second copy on the same ports.

## 2. What is implemented

| Brief requirement           | Implementation                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Document ingestion          | Text-based PDF, TXT, Markdown, CSV, or pasted text; 15 MB, 100 pages, and 120,000 characters per document                                   |
| Six legal categories        | Personal information, advice/recommendations, international affairs, law enforcement, solicitor-client privilege, Cabinet confidences       |
| AI classification           | Gemini structured output with exact-quote matching, confidence validation, category validation and overlap rejection                        |
| Offline first pass          | Clearly labelled local pattern rules; never presented as live AI                                                                            |
| Legal grounding             | Section-specific explanations and links to the Justice Laws website; Cabinet confidences labelled as an exclusion                           |
| Human review                | Every suggestion requires approval or disclosure; disclosure and category changes require a rationale                                       |
| Low confidence              | Suggestions below 85% receive an extra warning; all confidence levels still require review                                                  |
| Independent leak testing    | Separate analysis pass takes only the candidate redacted text, without original spans or hidden values                                      |
| Reconstruction scoring      | Exact/partial/unverified/untested guesses scored outside the tester against withheld values                                                 |
| Mosaic effect               | Contextual identification findings with visible clues, severity, officer rationale and fresh checks after changes                           |
| Consistency                 | 768-dimensional similarity search; pgvector with PostgreSQL, normalized word vectors locally, Gemini embeddings when configured             |
| Prior release references    | Specific source/reference IDs, excerpts, similarity values, treatment, and contextual officer assessment                                    |
| Real public starter corpus  | Eight distinct completed ATI releases with page provenance, plus sixteen separately labelled proactive publications                         |
| Original/release comparison | Original vs candidate; candidate vs an officer-attached actual published release with its source URL                                        |
| Officer dashboard           | Stored-request counts, pending suggestions, release totals, overdue targets, throughput, risk and open findings                             |
| Requester portal            | Create a request, follow progress, and download only the requester’s own approved redacted records                                          |
| Authentication              | Auth0 OIDC and namespaced roles; demo role switching unavailable with Auth0 enabled                                                         |
| Voice                       | ElevenLabs on demand; browser speech and a readable transcript without credentials                                                          |
| Export                      | Fresh redacted PDF, text, officer decision JSON, and activity JSON; original PDF bytes are never included in exports                        |
| Release controls            | Automatic checks after candidate edits; block on pending decisions, open findings, stale/failed checks, absent attestation, or no documents |
| Audit                       | Sequenced SHA-256 hash-linked activity with canonical JSON hashing and verification                                                         |
| Presentation                | Responsive layouts, dark theme, local fonts, custom illustrations, keyboard shortcuts, focus-managed dialogs                                |
| Team/demo delivery          | Three-person ownership plan, API contract, demo script, presentation deck and deployment files                                              |

## 3. Try the full workflow

1. On Overview, select **Continue your review** to open the border-services demo.
2. Click a coloured suggestion. Read its section, explanation, confidence, and statutory conditions.
3. **Approve withholding**, or select **Disclose / change** and record your reasoning.
4. Try **Original**, **Redacted**, and **Compare**. The redacted view replaces hidden text instead of merely covering it.
5. On the **Integrity** tab, examine the identifying context and the similar prior release.
6. To mitigate the contextual leak, add a manual redaction for the full sentence beginning “The only officer leading the Northern Region pilot…”. Choose a category and record a justification. This automatically replaces old checks with a fresh pass.
7. **Run integrity checks**. Resolve any remaining findings with an explicit rationale. Contextual differences can justify different treatment; a similarity match is not a legal ruling.
8. Confirm **I have reviewed the entire record** only after reviewing unmarked content and statutory conditions.
9. **Approve release**, then confirm **Approve & release**.
10. Open the profile menu and choose **Requester portal**. Open the approved release and download the redacted PDF/text.
11. Switch back to the officer workspace. Activity log records the review, testing, attestation, and approval.

For a simpler release demonstration, create a new request and paste:

```text
PILOT RESULTS

The pilot reduced processing time by 18%.
Employee name: Private Person
Personal contact: private.person@example.net
```

Approve both suggested personal-information spans, attest review, and release. The aggregate result remains accessible; the synthetic private identity and email do not appear in the requester’s text or PDF.

**Shortcuts:** `N` creates a request, `/` or `Ctrl+K` focuses search, and `Esc` closes a dialog. Search filters the current library/activity/integrity page or searches requests from Overview and the document workspace.

## 4. Connect Gemini

Live verification completed with Gemini 3.1 Flash Lite; see [results and limits](docs/EVIDENCE.md). If a configured cloud database is unavailable, use `npm run start:local` to retain live Gemini with local SQLite. Normal `npm start` uses the configured database URL.

Create your own API key, then create a local environment file:

```powershell
Copy-Item -LiteralPath .env.example -Destination .env
```

Set:

```dotenv
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
```

Restart the app. Settings shows **Gemini** instead of local pattern rules. Upload a new document to obtain new live suggestions. In Release library, use **Reindex library** to move existing excerpts to the current embedding provider. Embeddings from different models are not compared.

Classification uses structured JSON and matches returned exact quotes to the source text. A quote that cannot be matched causes an error; invented spans are not saved. The leak tester is a separate Gemini call with only the proposed release. API keys never enter client-side code.

The configured document and reference text is sent to Google. Select an appropriate deployment and data-processing arrangement before using real sensitive records. API failures remain visible; the app does not silently call a failed live result “local AI”.

Official references: [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output), [Embeddings](https://ai.google.dev/gemini-api/docs/embeddings).

## 5. Connect Auth0

1. Create an Auth0 **Regular Web Application**.
2. The supplied Express application is registered for **http://localhost:3000**. Set Allowed Callback URLs to `http://localhost:3000/callback`, Allowed Logout URLs to `http://localhost:3000/`, and Token Endpoint Authentication Method to **Post** (`client_secret_post`).
3. Set these values in `.env`. Use the client secret belonging to this Express application, rather than the earlier Next.js application:

```dotenv
DEMO_MODE=false
SESSION_SECRET=your-own-long-random-session-secret
AUTH0_ISSUER_BASE_URL=https://dev-i7p4kdozefycl6u7.ca.auth0.com
AUTH0_CLIENT_ID=EdEu2b1ioiUTJrEvBVTDxuB1XSuOLzOX
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ROLES_CLAIM=https://redactor.app/roles
```

Generate a secret with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

4. Create a role named **officer** and assign it only to intended ATIP users. Other authenticated users receive requester access.
5. Create and deploy a **Post Login Action**, then add it to your Login flow:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  api.idToken.setCustomClaim('https://redactor.app/roles', event.authorization?.roles || []);
};
```

6. Stop the previous development process with Ctrl+C, then run **`npm run dev:auth0`** and open **http://localhost:3000**. This command uses the configured public Auth0 settings and existing local SQLite storage in this process, without editing `.env` or connecting to the configured Tiger Data service. Gemini settings are retained. Choose **Sign in → Continue securely**, or **Create an account** to sign up. Passwords are entered only on Auth0's page. The profile menu provides sign-out. Demo role switching is disabled.
7. For officer-created requests, supply the intended requester’s Auth0 subject ID (`auth0|…`). Requests created by a requester automatically belong to that authenticated subject.

To avoid retaining synthetic demo records in an authenticated workspace, use a separate data file:

```dotenv
DATA_PATH=data/authenticated.sqlite
```

For public hosting, use your HTTPS URL in Auth0 and `AUTH0_BASE_URL`. This is one shared officer workspace, not a multi-department tenant isolation system.

The official `express-openid-connect` 2.x SDK handles login, callback validation and logout. Sessions are persisted on the server in the selected database; the browser receives a signed, HttpOnly session ID. A session expires after eight hours of inactivity or 24 hours total, and logout deletes its database record. Expired records are deleted when accessed. Keep this database private because session records contain identity tokens. The demo uses separate `express-session` middleware.

Run `npm run verify:auth0` to check the configured tenant's discovery and signing keys. This check cannot prove the client secret or interactive login. See [the full setup and manual login checks](docs/AUTH0_SETUP.md).

For a different development or deployment origin, configure the matching callback/logout URLs, update `AUTH0_BASE_URL`, and use the ordinary `dev`/`dev:local` or `start` command. `dev:auth0` deliberately selects the supplied localhost:3000 application settings.

Official reference: [Auth0 Express SDK](https://github.com/auth0/express-openid-connect).

## 6. Connect Tiger Data / PostgreSQL

Create a database with the `vector` extension available and set:

```dotenv
DATABASE_URL=postgresql://user:password@host:5432/database
DATABASE_SSL=true
```

The app creates `records` (JSONB requests, corpus and audit) and `corpus_vectors` (`vector(768)` plus an HNSW cosine index). PostgreSQL connections require valid TLS certificates when SSL is enabled. Set `DATABASE_SSL=false` only for a trusted local database.

Restart and check Settings. Switching database providers starts in the selected database; SQLite records are **not automatically migrated**. To copy an existing workspace safely, use `npm run migrate:tiger -- --check` followed by `npm run migrate:tiger -- --apply`; see [the migration guide](docs/TIGER_MIGRATION.md). In an authenticated empty workspace, use Release library → **Load public starter set**, or import your own released excerpts.

The prototype stores complete request records as JSON, including review time stamps and risk measurements. It does not create a TimescaleDB hypertable or claim a dedicated time-series schema. PostgreSQL provides persistent storage and genuine pgvector queries.

## 7. Connect ElevenLabs

```dotenv
ELEVENLABS_API_KEY=your-key
ELEVENLABS_VOICE_ID=your-voice-id
```

Restart. Overview → **Listen to briefing** uses ElevenLabs audio. Without credentials it uses browser speech when supported and always displays the briefing text. Queue counts, the two highest-priority request IDs and an unresolved reference ID are sent to the voice service, not original records or withheld spans.

Official reference: [Create speech endpoint](https://elevenlabs.io/docs/api-reference/text-to-speech/convert).

## 8. Add real release data and a comparison

The public starter set includes eight distinct completed ATI requests from Library and Archives Canada with official PDF links, page numbers and source hashes in `samples/ati-releases.json`. Sixteen proactive publications and sixteen synthetic excerpts remain separately labelled. See [EVIDENCE.md](docs/EVIDENCE.md).

To add completed ATI records:

1. Find a record on [Open Government’s completed ATI request search](https://search.open.canada.ca/ati/), obtain its publicly released response, and check its treatment.
2. In Release library, choose **Add public reference**.
3. Enter the real request ID, title, public source URL, exact released excerpt, and recorded treatment.
4. The app embeds the supplied excerpt; it does not automatically fetch or validate the URL’s contents.
5. Import an unreleased source record for officer review only if you are authorized to process it.
6. In its document workspace choose **Attach reference**, paste the actual published version, and provide its source URL.
7. **View comparison** presents the candidate release beside the published version. This is text comparison; it does not align original PDF page geometry.

## 9. Validate the app

```powershell
npm test
npm run evaluate
npm run build
npm run test:e2e
```

The API tests run with isolated in-memory stores. The browser suite starts a separate seeded in-memory workspace on ports **5174/3002** and never modifies the persistent demo. On Windows it can use an installed Edge browser. If no browser is installed, run:

```powershell
npx playwright install chromium
```

Optionally set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a Chromium-compatible browser executable.

Tests cover classification validation, output sanitization, independent-tester input, reconstruction scoring, similarity conflicts, ownership/role restrictions, PDF content extraction, release blockers, stale checks, rationale requirements, manual redactions, file uploads, origin checks, hash-chain verification, navigation, mobile layout, themes, and requester release viewing.

`npm run evaluate` produces `artifacts/evidence-evaluation-local.json`: additional withholding on eight real ATI excerpts, separately from sensitive-character coverage on six synthetic fixtures. `npm run evaluate:gemini` exercises actual classification, leak testing and embeddings, or reports missing credentials as blocked. Original category fixtures are retained under `npm run evaluate:smoke`. None is an independent legal accuracy benchmark.

Browser screenshots are written to `artifacts/` for the desktop dashboard, mobile dashboard, dark theme, review workspace, and requester release.

## 10. Build and host

For a production build served by Express:

```powershell
npm run build
npm start
```

Open **http://127.0.0.1:3001**. If Auth0 is enabled, update its callback/logout URLs and `AUTH0_BASE_URL` to that origin or to your deployed HTTPS origin.

With that server running, use `npm run verify:production` in a second terminal to check the compiled dashboard, local font loading under security headers, presentation navigation, and API error handling. The report and screenshots are saved in `artifacts/`.

Container deployment files are supplied. Docker is not required for the local app. For a local PostgreSQL demonstration:

Run `npm run verify:container` with Docker running to build the production image and verify it against an isolated PostgreSQL/pgvector instance. It checks persistence, similarity search, the ATI demo, PDF export and non-root execution, then removes its temporary containers and network. The report is `artifacts/container-verification.json`; this is local verification, not evidence of a hosted deployment.

```powershell
Copy-Item -LiteralPath .env.example -Destination .env
docker compose up --build
```

The Compose file uses local development database credentials and binds the application to localhost. Do not use those credentials for an internet-facing deployment. The Docker image runs as the unprivileged Node user and includes a health check.

For Vultr or another host, deploy the image, connect your managed PostgreSQL/Tiger Data URL, supply environment secrets, put a TLS reverse proxy in front, and configure Auth0 for the final origin. `HOST=0.0.0.0` enables container networking. No host, service account, domain registration, purchase or public deployment has been performed by this project.

For **mr-redactor.vip**, use [the deployment guide](docs/DEPLOYMENT.md), `.env.production.example`, and the standalone `compose.production.yaml`. This stack uses hosted Tiger Data, requires Auth0 and Gemini credentials, disables demo access, and places Caddy HTTPS in front of the app. Its commands include public deployment checks and live provider checks. The domain is registered, but a server still needs to be created and configured.

## 11. Limits to understand

- The implemented taxonomy covers the six categories in the brief, not every exemption/exclusion in the Act.
- Local rules are deliberately limited and cannot identify arbitrary semantic sensitivity. Gemini suggestions can also be wrong or incomplete.
- Source PDFs are converted to text. Scans, images, diagrams, layout-dependent meaning, attachments, metadata, and handwriting require separate review/OCR. Exports are freshly generated text-based PDFs, not preserved-layout PDF redaction.
- Confidence is a suggestion confidence, not a calibrated probability or legal ruling. Risk scores are heuristic indicators, not validated breach probabilities.
- The release gate confirms recorded review actions; it cannot prove that an officer’s assessment was correct.
- The audit chain detects internal modifications to stored events; deletion of the whole chain or its tail requires external checkpoints to detect. No external notarization is provided.
- The prototype is intended for a single server instance. Locks and the audit writer are in-process; multi-instance transactions, tenant isolation, retention policies, managed key encryption, formal accessibility auditing and operational government approval require further engineering.
- Auth0, Gemini, ElevenLabs, Tiger Data, Docker hosting and external deployment need your accounts. Credential-backed live calls cannot be verified without those credentials. Mocked/provider-contract tests and local tests are supplied.

## 12. Project map and handoff

```text
src/                       React UI, dialogs, dashboard, reviewer and portal
server/app.js              API, access controls, release workflow and exports
server/engine.js            Classification, leak test, scoring and consistency
server/legal.js             Six categories and statutory links
server/store.js              SQLite / PostgreSQL and vector search
server/public-corpus.js      Eight ATI releases plus sixteen proactive-publication excerpts
server/audit.js              Canonical hashing and activity verification
server/seed.js               Synthetic requests and references
samples/labeled.json         Synthetic category smoke fixtures
tests/                      API/engine tests and isolated browser tests
scripts/                    Evaluation and isolated test server
docs/TEAM_PLAN.md            Three-person parallel ownership and checkpoints
docs/API.md                  Shared request/response contract
docs/DEMO.md                 Rehearsal and fallback walkthrough
public/pitch.html            Self-contained eight-slide presentation
Dockerfile, compose.yaml     Deployment scaffolding
```

The legal citations were checked against the [Access to Information Act](https://laws-lois.justice.gc.ca/eng/acts/A-1/) and the [Treasury Board Access to Information Manual](https://www.canada.ca/en/treasury-board-secretariat/services/access-information-privacy/access-information/access-information-manual.html). Section 69 is an exclusion, and the review UI explicitly asks officers to consider exceptions and conditions rather than mechanically apply a category.
