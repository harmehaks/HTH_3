# Evidence and remaining gaps

Current rebrand results and live-service limits are in [REBRAND_INTEGRATION.md](REBRAND_INTEGRATION.md). Local backend/browser and compiled-production checks passed, as did live Gemini. Hosted Tiger Data was unreachable over TCP on this network during the merged-code run. Earlier live cloud passes described below precede the rebrand and are preserved separately.

The starter library contains eight **distinct completed ATI requests**, with one short visible excerpt per request, from government-hosted Library and Archives Canada release packages. These are historical records released through ATI, not eight contemporary operational case files. The sixteen Global Affairs proactive publications remain a separate source type.

`samples/ati-releases.json` records real request IDs, official package pages, direct PDF URLs, one-based PDF page numbers, archival references, package dispositions, excerpt treatment, verification date and downloaded PDF SHA-256. Excerpts were checked against rendered scans; whitespace was normalized and OCR errors corrected against the visible page. `released` applies only to the visible excerpt, even when a package is partially withheld. Historical classification stamps do not establish current withholding treatment.

| ATI request  | Excerpt                             | PDF page | Package disposition |
| ------------ | ----------------------------------- | -------- | ------------------- |
| A-2026-02577 | Oceanography workshop support       | 4        | All disclosed       |
| A-2026-01279 | Travel expense instructions         | 4        | All disclosed       |
| A-2026-01235 | Regional reporting instructions     | 4        | All disclosed       |
| A-2026-01058 | Administrative position change      | 4        | Disclosed in part   |
| A-2026-00937 | UNAMA mission description           | 3        | Disclosed in part   |
| A-2026-00827 | Records management action form      | 5        | All disclosed       |
| A-2026-00699 | GATT trade rules briefing           | 3        | All disclosed       |
| A-2026-00675 | Fisheries assistance recommendation | 3        | All disclosed       |

Sources: [official completed ATI database](https://telechargerdemandesaicompletees-downloadcompletedatirequests.bac-lac.gc.ca/eng), [instructions](https://www.canada.ca/en/library-archives/services/public/access-information-privacy/how-use-completed-database.html). The main Open Government portal primarily lists summaries; a summary is not a release. No informal ATI requests were submitted. Third-party archive links returning 404 were excluded.

## Ready-to-use comparison

Requests → **Published ATI comparison — fisheries assistance** (`DEMO-ATI-00675`) → **View comparison**. Reference A-2026-00675, PDF page 3, is already attached. Input is the same already-published excerpt. Local rules suggest withholding its recommendation, and consistency checking finds the actual release. Disclose the suggestion with a rationale, then inspect the refreshed checks. This demonstrates unnecessary-redaction review, not reconstruction of an unreleased original or full-document accuracy. Existing demo databases receive this example without overwriting decisions.

## Evaluation

- `npm run evaluate`: eight real released excerpts scored for additional suggested redaction; six synthetic cases separately scored for sensitive-character coverage. Output: `artifacts/evidence-evaluation-local.json`. A completed evaluation may reveal weaknesses; it does not certify accuracy.
- `npm run evaluate:gemini`: same cases through actual Gemini classification, plus live classification → redacted candidate → independent leak tester → embedding checks. Reads `.env`. Missing key exits 2 with a **blocked** artifact; API/schema failures exit 1; no fallback. Only public/synthetic fixtures are sent to Google; API charges may apply. Review per-case output before presenting results.
- `npm run evaluate:smoke`: original 32 category fixtures retained as regression checks, without precision/recall accuracy claims.
- `npm run evaluate:spans`: six synthetic fixtures alone.

Real excerpts overlap the reference library and are short, hand-selected English negatives, not an independent representative dataset. Classification does not retrieve the library. Released PDFs cannot reveal withheld characters: real sensitive-span recall is null. Independent officer annotation, broader institutions/languages, full documents and hidden-span ground truth remain necessary. Never pool synthetic and public results into one headline score.

## Integration claims

| Integration | Implemented evidence                                                                            | Remaining verification                                                              |
| ----------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Tiger Data  | Hosted synthetic request workflow, pgvector/HNSW, release, PDF and server/store restart persistence passed | Live Auth0/voice and production deployment remain unverified                          |
| Gemini      | Live Gemini 3.1 Flash Lite classification, leak testing and 768-dimensional embeddings verified | Small evaluation only; outputs still require officer review and available API quota |
| ElevenLabs  | Transcript names two priority requests and an unresolved reference ID; only metadata is spoken  | Live synthesis requires credentials; browser speech is a separate fallback          |
| Vultr       | Dockerfile and Compose assets                                                                   | No hosted deployment verified                                                       |
| GoDaddy     | No domain integration completed                                                                 | No registered domain or DNS verification                                            |

Container files alone are not deployment evidence. Run the live evaluation after setting a key locally; never paste secrets into chat.

The production image and local PostgreSQL 17/pgvector 0.8.6 path have now passed `npm run verify:container -- --skip-build` following a successful Docker build. The check exercises real JSONB persistence, cosine search, model isolation, HNSW indexing, the seeded ATI comparison, non-root execution, health, the UI and PDF export. See `artifacts/container-verification.json`. A subsequent hosted synthetic workflow also passed; Vultr and domain verification remain outstanding.

## Portable verification

From the repository directory: `npm ci`, `npx playwright install chromium`, `npm test`, `npm run build`, `npm run test:e2e`. On Linux CI, use `npx playwright install --with-deps chromium` where system-package installation is permitted. Playwright uses installed Chromium, or installed Edge on Windows. Optional overrides: `PLAYWRIGHT_CHANNEL` or `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. This update was tested on Windows; macOS/Linux execution is not claimed.

## Live account verification — 26 September 2026

Gemini 3.1 Flash Lite completed all eight public-release cases and six synthetic cases with no API/schema errors. The public set had one excerpt with extra suggestions (15.7% of excerpt characters). The separate synthetic set showed 76.5% sensitive-character recall and 74.6% precision. These small-case results are not legal accuracy or safety scores. The live pipeline withheld the fixture email, found one contextual leak, and returned 768-dimensional Gemini embeddings. See artifacts/evidence-evaluation-gemini.json.

Gemini 2.5 Flash exhausted its per-model daily free quota; its partial results are preserved in artifacts/evidence-evaluation-gemini-2.5-flash.json. The listed 2.5 Flash Lite endpoint returned 404; that failed run is also preserved. The evaluator now paces requests, retries a temporary 429 once, and stops on daily-quota exhaustion or a rejected model/configuration. The verified model is configured locally, and all 40 reference excerpts were reindexed with gemini-embedding-001.

The earlier running app used explicit SQLite storage with live Gemini. `npm run start:local` explicitly selects SQLite; `npm start` uses the saved cloud URL in the ignored `.env`. The earlier TCP timeouts subsequently cleared. Live Tiger verification enabled the required vector extension and passed authentication, TLS, JSONB round-trip and cosine similarity against pgvector 0.8.6. Synthetic test records used a temporary table with rollback; no persistent application records were changed. See `artifacts/live-tiger-verification.json`. Repeat the connection checks with `npm run verify:live -- --service=tiger`; add `--setup` only when enabling the required extension is intended.

Model documentation: [Gemini 3.1 Flash Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite). Quota information: [Google rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

The later `npm run verify:live-workflow` run passed a full synthetic browser workflow against live Gemini and hosted Tiger Data, including an intentional synthetic consistency conflict, release gates, audit verification, requester PDF/receipt checks and persistence across a server/store restart. Its disposable cloud schema was removed successfully. The test uses demo officer/requester sessions, not live Auth0, and does not synthesize ElevenLabs audio. See `artifacts/live-workflow-verification.json`. Existing user records and the local `.env` are not changed by this verifier.
