# Three people, parallel work

The working app is already integrated. Use these ownership boundaries to extend it without three people blocking one another.

## Freeze the contract before splitting

Spend the first 45 minutes together reviewing `docs/API.md`, the shared `src/types.ts` types, and the existing seeded workflow. Agree that one person owns a file at a time. Requests contain documents; documents contain spans and integrity results. The core engine returns suggestions, never final legal decisions.

Each person runs `npm run dev` on their own checkout. No shared API deployment is required during development. Existing demo data and local engines provide a working dependency for every track.

| Person                     | Owns                                                                                                                       | Can work independently using                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A: Core/legal lead         | `server/legal.js`, classification in `server/engine.js`, document extraction, `samples/labeled.json`, engine tests         | Synthetic fixtures, public excerpts, engine function inputs, and direct API tests                    |
| B: Integrity/data lead     | Leak tester, guess scoring, embedding/consistency functions, `server/store.js`, `server/public-corpus.js`, integrity tests | Already redacted fixture strings and recorded decision JSON; never needs original text in the tester |
| C: Product/full-stack lead | `src/`, Auth0 wiring and briefing/export routes, CSS, browser tests, presentation and deployment                           | The already working local API and static shared types; no API keys required for UI work              |

`server/engine.js` contains both A and B functions. During parallel editing, split proposed changes into new modules (`classification.js`, `leaks.js`, `consistency.js`) or reserve clear function regions and avoid reformatting the entire file until integration. App routing changes go through C; A and B expose stable functions.

## First 4 hours

**A:** establish a source-checked dataset, labels and exemption conditions; define low-confidence cases, public-information negatives, date/age exceptions and permitted disclosures. Keep legally adjudicated examples distinct from synthetic pattern fixtures.

**B:** use `renderRedacted()` output as the entire leak-tester fixture. Write cases where visible context identifies a hidden person and cases where it does not. Prepare prior-release matches with explicit sources and contextual differences.

**C:** refine dashboard/reviewer/portal flows, verify empty states and mobile use, and set up the browser test environment. Configure Auth0 only after the local role flow is understood.

## Hours 4–16

**A:** improve Gemini grounding and exact-quote matching, extraction quality and model-output validation. Preserve span offsets as JavaScript string offsets and reject overlap. Handle API failures explicitly.

**B:** improve reconstruction testing and independent scoring. Integrate the real embedding provider and pgvector. Do not compare embeddings from different models; reindex after provider changes. Check useful conflicts against source context, not just wording.

**C:** complete reviewer controls, rationale dialogs, release gating, voice controls, exported documents and requester permission views. Use local services while A/B iterate.

At hour 16, each person demonstrates a passing fixture in their owned boundary. Merge and run `npm test`, `npm run build`, and `npm run test:e2e`. Do not begin the next stage with broken API shapes.

## Hours 16–30

**A:** validate six categories with difficult negatives; review public/business contact exceptions, severability, privilege status, injury tests and Cabinet exclusion exceptions. Support side-by-side assessment with the actual published version.

**B:** tune useful similarity thresholds on a small independent evaluation set. Separate exact guesses, partial guesses, and unverified context risks. Verify that tester requests cannot contain original spans.

**C:** verify keyboard and small-screen use, live integration status, signed-in roles, PDF downloads, and presentation transitions. Run the real provider integrations once credentials are supplied.

## Hours 30–40

At hour 32, freeze features. Spend the remaining time on failures, verification, screenshots, the demonstration and documentation.

Each person has a specific final check:

- **A:** read the full demo record and compare every decision with statutory conditions. Validate the released PDF text, not just its appearance.
- **B:** show the independent tester’s exact input and the source of a consistency conflict. Verify embedding dimensions and data persistence.
- **C:** demonstrate requester isolation, a successful release, role switching/real login, voice playback, and a mobile review.

## Merge habits that prevent dependence

1. Keep the contract stable. Introduce optional fields before changing required fields.
2. Commit small, independently working changes with a fixture and a clear expected result.
3. When a provider fails, keep the error explicit. Do not fake a successful live integration.
4. Keep originals on the officer side. The requester response must remain a whitelist of approved release fields.
5. Resolve core/legal disagreements with a recorded issue and explicit owner; never turn a confidence score into an automatic release decision.
6. Re-run integrity whenever the candidate output changes. Test the same output hash that is released.
7. Protect the last eight hours for the actual demo, not more sponsor integrations.

## Sponsor mapping

| Sponsor          | Implemented path                                               | Evidence to show                                                               |
| ---------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Gemini           | Classification, explanation, independent leak pass, embeddings | Settings says Gemini; show a real analysis and the sanitized tester input      |
| Auth0            | Officer/requester login and server permissions                 | Two authenticated users; requester gets 403/404 for officer/original endpoints |
| Tiger Data       | PostgreSQL JSONB and pgvector cosine index                     | Settings storage status; persistent records and matching-source references     |
| ElevenLabs       | Spoken queue summary                                           | Briefing shows ElevenLabs and plays generated audio                            |
| Vultr            | Optional Docker deployment                                     | Only claim use after you actually host it there                                |
| GoDaddy Registry | Optional domain                                                | Only claim use after you actually register/configure the domain                |

Solana and Presage are not included because the brief provides no relevant function for them. Local fallback modes are useful for development but do not constitute use of a sponsor service.
