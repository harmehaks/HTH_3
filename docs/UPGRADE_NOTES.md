# Disclosure studio update

Implemented in `E:\Redactor`. The original files were backed up in `E:\Hackthehill\redactor-originals` before applying changes. The temporary working copy is `E:\Hackthehill\redactor`; the runnable project is `E:\Redactor`.

## Fixed

- Mixed lines containing redaction markers no longer suppress visible contextual leak clues.
- Gemini findings with real visible context and a redaction marker remain valid. Fabricated or malformed findings fail the check rather than silently turning into a clean pass.
- Manual redactions can explicitly replace fully covered suggestions, including dismissed ones. Partial overlap is rejected to avoid exposing the uncovered part. Previous decisions are retained and included in the officer JSON export.
- Explicit check reruns invalidate earlier results and full-review confirmation before starting. A provider error blocks release; the UI reloads server state after failed operations.
- The release checklist and release API use the same server-side readiness calculation.
- The browser test host now runs API and Vite in one process and the suite exits normally.

## Added

- Dark ink navigation, paper document surfaces, stronger text contrast, larger review text, responsive layouts and reduced-motion support.
- Interactive Disclosure Lens illustrating why hiding a name can leave identifying context. This is explicitly synthetic, not a live model demonstration.
- Four release gates and a disclosure balance meter derived from actual record text. The meter counts JavaScript string units; it is not a confidence, accuracy, safety or legal-compliance score.
- A downloadable release receipt containing SHA-256 hashes of approved document text. It has no original text or secret values and uses existing ownership controls. It is not signed and cannot authenticate itself; it can compare text against a separately trusted receipt.
- `npm run evaluate:spans`: six synthetic engineering fixtures that report missed and extra characters. Current local rules detect 47.8% of intended sensitive characters with 100% character precision on this tiny set. This deliberately exposes weaknesses in unlabelled names, addresses and dates; it is not an independent or legal benchmark and does not measure Gemini.
- A five-minute demo script in `docs/DEMO.md`.

## Highest-value next work

1. **Verify live Gemini on unseen examples.** Record model, latency, missed sensitive spans and false positives. Test prompt injection, repeated quotes, long records and French documents. This is the highest priority before claiming AI performance.
2. **A tested contextual re-identification demonstration.** Show an actual independent inference from permitted public or synthetic clues, then its mitigation, preserving a useful public result. Distinguish a hypothesized inference from a verified reconstruction.
3. **OCR with page-linked review.** Preserve page coordinates and let the officer inspect image regions that text extraction cannot represent. Treat unreadable pages as a release blocker. This requires more engineering than a cosmetic upload feature.
4. **Bilingual workflow.** Translate review and requester controls and test French records and exported Unicode text. The current PDF path uses Helvetica and needs font/layout work for broad language coverage.
5. **Measure usability.** Time a manual review and an assisted review on the same controlled examples, including correction effort. Report sample size and misses alongside speed.

Avoid adding more integrations solely for a prize list. A reliable upload → finding → correction → release demonstration is the priority. No feature set guarantees a hackathon result.
