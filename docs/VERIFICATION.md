# Verified delivery

Updated review verified on Windows with Node.js 26.1.0 and Microsoft Edge on 26 September 2026. Earlier production/audit results below are explicitly marked historical.

| Check                       | Result                                      | Scope                                                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                  | 31 passed                                   | Engine validation, sanitized tester input, reconstruction scoring, releases, requester isolation, stale checks, provider-failure recovery, manual redaction, PDF/text upload and export, audit chain, public references, ElevenLabs contract |
| `npm run test:e2e`          | 8 passed                                    | Desktop/mobile layout, navigation, search, themes, reviewer controls, requester access, release/download, automatic integrity refresh, published comparison, reference library, briefing and presentation                                    |
| `npm run build`             | Passed                                      | TypeScript and compiled Vite application                                                                                                                                                                                                     |
| `npm run verify:production` | Passed                                      | Rebuilt Express-served dashboard, local fonts, CSP, presentation navigation, API 404 and no browser errors                                                                                                                                   |
| `npm run evaluate:smoke`    | 32/32 category smoke fixtures               | 16 synthetic fixtures and 16 public proactive-publication excerpts; not a legal accuracy benchmark                                                                                                                                           |
| `npm audit --omit=dev`      | Earlier baseline; not rerun for this update | Installed production dependency tree at verification time                                                                                                                                                                                    |

The browser and API test workspaces are isolated from the persistent local demo. Provider errors do not silently switch a configured live provider to a local result. Candidate edits are retained when automatic checks fail, and release remains blocked until a successful pass. A tampered or stale output hash is rejected by the release endpoint.

Screenshots and machine-readable reports are in `artifacts/`, including `production-dashboard.png`, `production-presentation.png`, `dashboard-mobile.png`, `dashboard-dark.png`, `review-desktop.png`, `requester-release.png`, `pitch-cover.png`, `production-verification.json` and `evaluation.json`.

## Account-backed verification still needed

Gemini 3.1 Flash Lite has now passed live classification, independent leak testing and embedding checks on public/synthetic fixtures. ElevenLabs contracts remain mocked; Auth0 checks use local sessions. Hosted Tiger Cloud connectivity is blocked by TCP timeouts. Local Docker/PostgreSQL/pgvector checks passed.

## Container and PostgreSQL verification

The production Docker image built successfully on 26 September 2026. `npm run verify:container -- --skip-build` then passed against fresh Linux containers running PostgreSQL 17 and pgvector 0.8.6. Checks cover non-root UID 1000, health, the compiled UI, eight ATI references, the pre-attached published comparison and its actual database-backed consistency conflict, PDF export, JSONB persistence across database connections, cosine similarity, embedding-model isolation, and the HNSW index.

The report is `artifacts/container-verification.json` and includes the tested image ID. The verifier removed its temporary containers and private network; PostgreSQL data was RAM-backed. No host ports, existing database, `.env` credentials or user containers were used. This does not verify hosted Tiger Data or Vultr. Run `npm run verify:container` to repeat the build and checks from the repository directory with Docker running.

The public starter library contains eight distinct completed ATI releases with government PDF sources and page provenance, plus sixteen proactive publications. See EVIDENCE.md. Synthetic cases are explicitly labelled. The fixture results do not establish span-level recall, legal correctness, mosaic detection accuracy or operational readiness. See the README for record handling and deployment limits.

## Disclosure studio regression coverage

New checks cover mixed-marker contextual clues, rejecting fabricated Gemini evidence, explicit overlap replacement and preserved history, receipt hashes and ownership, failed explicit integrity reruns, interactive Disclosure Lens and server readiness. The eight browser checks finish with a clean exit.

`npm run evaluate:spans` reports 47.8% sensitive-character recall and 100% character precision on six deliberately limited synthetic examples. These figures expose local-pattern limitations; they do not measure real-world accuracy or Gemini. See `UPGRADE_NOTES.md`.

## ATI evidence update

Verified 31 API/engine tests, eight browser tests, and the production build. The new seeded published comparison and eight ATI library records work without pasting a reference. Its screenshot is artifacts/ati-comparison.png.

The default evaluation now measures eight real released excerpts separately: one receives additional redaction suggestions (15.7% of total excerpt characters flagged). Six synthetic fixtures separately show 47.8% sensitive-character recall. No real sensitive-span recall is measurable from already-redacted source PDFs. Original smoke fixtures remain 32/32 under npm run evaluate:smoke, without accuracy ratios.

The earlier missing-key behavior was verified. After credentials were supplied, Gemini 3.1 Flash Lite completed all 14 cases and the live pipeline. Gemini 2.5 Flash reached its daily quota; 2.5 Flash Lite returned 404. Separate reports preserve these results. See EVIDENCE.md. Vultr deployment and GoDaddy registration remain unverified.

Latest regression suite: 31 tests passed, including sanitized daily-quota diagnostics. The app is running with Gemini 3.1 Flash Lite and explicit local SQLite storage; 40 reference vectors use Gemini embeddings. Hosted Tiger Cloud is not claimed as connected.
