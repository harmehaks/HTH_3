# Demonstration and rehearsal

**New evidence beat:** Open Requests → **Published ATI comparison — fisheries assistance** → **View comparison**. Show the actual A-2026-00675 source, PDF page 3, alongside the local rule's extra withholding suggestion. This is a re-review of already published text, not an unreleased original. The reference is pre-attached. Disclose the suggestion with a rationale and show the refreshed integrity result. See [EVIDENCE.md](EVIDENCE.md) for the eight real ATI sources and exact claim boundaries.

Use `npm run evaluate` for real-public and synthetic results reported separately. The original regex fixtures are now `npm run evaluate:smoke`; do not present those as accuracy. Run `npm run evaluate:gemini` before claiming live Gemini. Missing credentials are a blocked result, not a fallback success.

Open http://127.0.0.1:5173 after `npm run dev`. For the slide deck, open http://127.0.0.1:5173/pitch.html. Arrow keys, Space, and the navigation buttons move through slides; print creates a handout.

## A five-minute presentation

**0:00?0:30 ? The problem.** A hidden name can still leave a visible identity. Show the interactive Disclosure Lens on the dashboard. Label it a synthetic illustration, not a live AI result.

**0:30?1:10 ? A real review workflow.** Open the border-services record. Show a suggestion, its source and an officer decision. Explain that local mode uses pattern rules; only claim Gemini when a fresh live upload has been verified.

**1:10?2:20 ? The central demonstration.** Open Integrity. Show the identifying context left after the name was removed. Explain the independent tester only receives the candidate release. Add a manual redaction for the full identifying sentence. Show the fresh check. If a selection includes other suggestions, explicitly replace them; previous decisions remain in stored history.

**2:20?3:00 ? Preserve useful information.** Show the disclosure balance and four server-checked release gates. The percentage measures source characters retained, never legal correctness or safety. Show a previous-release conflict and its reference if time permits.

**3:00?4:15 ? Complete the citizen's journey.** Rehearse with a short synthetic contact record from README. Approve suggestions, confirm review and release. Show the receipt, then switch to the requester and download the redacted text/PDF. Keep the public outcome visible.

**4:15?4:45 ? Evidence and limits.** Report passing regression tests and the actual span benchmark, including missed cases. Explain that OCR, preserved PDF layout and account-backed integrations need further work or verification. Do not claim measured time savings without a timed comparison.

**4:45?5:00 ? Close.** ?Help officers release useful information while catching what ordinary redaction can leave exposed.? Keep the next three minutes available for questions about architecture, limits and technical decisions.

## Before the demonstration

1. Run `npm test`, `npm run evaluate`, `npm run build`, and `npm run test:e2e`.
2. Verify your chosen Gemini model/key/quota with a fresh upload. Confirm the current corpus embedding model; reindex if necessary.
3. If using Auth0, rehearse with an officer and requester account and correctly assign the requester subject ID. Demo role switching is unavailable in real Auth0 mode.
4. If using Tiger Data, confirm the selected database has data and `vector` enabled. Switching providers does not move your SQLite data automatically.
5. If using ElevenLabs, verify playback before presenting. Browser speech availability varies; the transcript remains readable.
6. Open every source link you intend to discuss. Use an actual released version for the published comparison, not a invented source URL.
7. Keep the fallback local mode and screenshots ready. The browser suite’s in-memory seed remains repeatable without deleting your persistent records.

## Backups when a provider fails

- **Gemini failure:** display the API error; use the labelled local pattern demo with a synthetic record. Do not claim a local result came from Gemini.
- **Auth0 failure:** use a separate local demo instance with no Auth0 settings. Do not represent demo cookies as government-grade authentication.
- **Tiger Data failure:** demonstrate the existing SQLite workspace and explain the implemented PostgreSQL adapter. Do not claim an unconnected database was used.
- **Voice failure:** read the available briefing transcript.
- **Network failure:** local fonts, illustrations, rules, data and exports keep working. Statutory/source links require a connection.

## Pitch claim boundaries

You can say: “We built an integrated review prototype with contextual leak testing, source-linked consistency checks and human release controls.”

Do not claim validated legal accuracy, quantified time savings, prevention of every leak, actual government deployment, approved sensitive-data processing, sixteen completed ATI response documents, or use of sponsor services that have not been connected.
