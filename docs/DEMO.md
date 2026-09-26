# Demonstration and rehearsal

Open http://127.0.0.1:5173 after `npm run dev`. For the slide deck, open http://127.0.0.1:5173/pitch.html. Arrow keys, Space, and the navigation buttons move through slides; print creates a handout.

## A six-minute presentation

**0:00–0:40 — The interaction.** A citizen asks for government records. An ATIP officer prepares the response. Redactor assists the officer so that information can move through review with clearer explanations, consistent treatment, and an extra disclosure check. Do not quote backlog/compliance improvement numbers from the brief as measured results of this app.

**0:40–1:15 — The workspace.** Show the queue, target dates, pending reviews and actual stored-request statistics. Explain that all seeded requests and identities are fictional. Show the real public starter references separately in Release library.

**1:15–2:00 — A decision with a reason.** Open the border-services modernization record. Select advice/recommendations. Point out the 78% suggestion confidence and the need to assess statutory conditions. Switch Original → Redacted → Compare. Show the source section link.

**2:00–3:00 — The red-team moment.** On Integrity, show the visible sentence about the only Northern Region pilot officer and the contact directory. The hidden name alone is not enough: remaining context could identify that person. Explain that the tester saw only redacted output. In local mode this is a deterministic contextual-risk check, not a guessed identity. With Gemini, show an actual returned inference and its separate exact/partial/unverified scoring if available.

**3:00–3:45 — Institutional memory.** Show the similar recommendation in the prior synthetic request. Explain that this is a possible consistency conflict, not an automatic instruction to disclose. Then open a real source-linked proactive publication in the library. The sixteen short public excerpts are real; the easy demo contradiction is explicitly synthetic.

**3:45–4:30 — Address the finding.** Add a manual redaction for the full identifying sentence. Show the automatically refreshed integrity results and the mitigated contextual finding. The rerun button is available for another pass. Resolve remaining conflicts with an explicit contextual rationale.

**4:30–5:20 — Release and requester access.** For a predictable quick finish, create the simple contact record from README rather than approving the complex record hastily. Approve its two personal-information suggestions, confirm full review, approve release, switch to requester view and download the PDF. Show that the aggregate public outcome remains visible while the synthetic private name/email is removed.

**5:20–6:00 — Voice and accountability.** Switch back. Play the spoken briefing if supported. Show Activity log and its hash-chain status. Explain the live sponsor configurations and the prototype limits candidly.

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
