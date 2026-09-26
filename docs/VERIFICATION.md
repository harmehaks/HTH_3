# Verified delivery

Verified locally on Windows with Node.js 22.20 and Microsoft Edge on 26 September 2026.

| Check | Result | Scope |
| --- | --- | --- |
| `npm test` | 24 passed | Engine validation, sanitized tester input, reconstruction scoring, releases, requester isolation, stale checks, provider-failure recovery, manual redaction, PDF/text upload and export, audit chain, public references, ElevenLabs contract |
| `npm run test:e2e` | 6 passed | Desktop/mobile layout, navigation, search, themes, reviewer controls, requester access, release/download, automatic integrity refresh, published comparison, reference library, briefing and presentation |
| `npm run build` | Passed | TypeScript and compiled Vite application |
| `npm run verify:production` | Passed | Express-served build, strict font CSP, dashboard, presentation navigation, unknown API 404 and no browser errors |
| `npm run evaluate` | 32/32 category smoke fixtures | 16 synthetic fixtures and 16 public proactive-publication excerpts; not a legal accuracy benchmark |
| `npm audit --omit=dev` | 0 known vulnerabilities | Installed production dependency tree at verification time |

The browser and API test workspaces are isolated from the persistent local demo. Provider errors do not silently switch a configured live provider to a local result. Candidate edits are retained when automatic checks fail, and release remains blocked until a successful pass. A tampered or stale output hash is rejected by the release endpoint.

Screenshots and machine-readable reports are in `artifacts/`, including `production-dashboard.png`, `production-presentation.png`, `dashboard-mobile.png`, `dashboard-dark.png`, `review-desktop.png`, `requester-release.png`, `pitch-cover.png`, `production-verification.json` and `evaluation.json`.

## Account-backed verification still needed

Gemini and ElevenLabs contracts are exercised with mocked HTTP responses; Auth0 role and owner restrictions are exercised through the local session mode. Real Gemini outputs, Auth0 tenant login, ElevenLabs voice playback, Tiger Data/pgvector connections, Docker builds and external hosting require your configured accounts or infrastructure and have not been verified live here.

The real public starter data consists of source-linked proactive publications. Synthetic cases are explicitly labelled. The fixture results do not establish span-level recall, legal correctness, mosaic detection accuracy or operational readiness. See the README for record handling and deployment limits.
