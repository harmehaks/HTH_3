# Shared API contract

All routes start with `/api`. JSON errors use `{ "error": "Readable message" }` and an appropriate HTTP status. Mutation requests send `X-Redactor-Client: workspace`. Browser requests use same-origin session cookies. An officer role is checked on the server; hiding a UI button is not authorization.

## Shapes

```typescript
type Decision = 'pending' | 'approved' | 'dismissed';
type Span = {
  id: string;
  start: number; // inclusive JavaScript UTF-16 string offset
  end: number; // exclusive
  category: 'personal' | 'advice' | 'international' | 'enforcement' | 'privilege' | 'cabinet';
  confidence: number; // [0, 1], suggestion confidence only
  justification: string;
  decision: Decision;
  reviewNote: string;
  source: string;
};
type Integrity = {
  leaks: Finding[];
  conflicts: Finding[];
  risk: number; // heuristic [0, 100]
  tester: string;
  checkedAt: string;
  outputHash: string; // SHA-256 of the candidate redacted text
};
```

Full frontend types are in `src/types.ts`. Spans must be non-overlapping, in bounds, and have valid categories/confidence. Pending and approved spans are hidden in the candidate release; dismissed spans are disclosed. Approval does not change candidate text. Disclosure/category/manual changes automatically replace integrity with a fresh pass. If the provider fails, the edit remains saved, `integrity` stays null, and an officer-only `integrityError` explains the failure. Release remains blocked. Explicit reruns clear this error on success.

## Routes

| Method and route                                           | Access                               | Request / result                                                                        |
| ---------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| `GET /health`                                              | Public                               | `{ok:true}`                                                                             |
| `GET /session`                                             | Public                               | User or null, demo flag, Auth0 availability                                             |
| `POST /session/role`                                       | Local demo only                      | `{role:"officer"                                                                        | "requester"}` |
| `GET /categories`                                          | Signed in/demo                       | Six statutory category definitions                                                      |
| `GET /requests`                                            | Signed in/demo                       | Summaries; requesters see only their own                                                |
| `POST /requests`                                           | Signed in/demo                       | `{title,department,description,requesterId?}`; requester subject assigned server-side   |
| `GET /requests/:id`                                        | Owner or officer                     | Full original/review data for officer; safe summary and approved release only for owner |
| `POST /requests/:id/documents`                             | Officer                              | Multipart `file`, or `{text,name}`; analyzes and tests before saving                    |
| `PATCH /requests/:id/documents/:docId/spans/:spanId`       | Officer                              | `{decision,category?,note?}`; rationale required for disclosure/category change         |
| `POST /requests/:id/documents/:docId/spans`                | Officer                              | `{start,end,category,note}`; manual approved redaction                                  |
| `POST /requests/:id/integrity`                             | Officer                              | New leak and consistency pass for all candidate documents                               |
| `PATCH /requests/:id/documents/:docId/findings/:findingId` | Officer                              | `{note}`; documents mitigation/context/residual-risk assessment                         |
| `PATCH /requests/:id/documents/:docId/attestation`         | Officer                              | `{attested:true}`; full-record review confirmation                                      |
| `PUT /requests/:id/documents/:docId/reference`             | Officer                              | `{text,sourceUrl}`; attached published record for comparison                            |
| `POST /requests/:id/release`                               | Officer                              | Blocks unless all review/freshness requirements pass                                    |
| `POST /requests/:id/reopen`                                | Officer                              | `{note}`; withdraws portal release and resets attestations                              |
| `GET /requests/:id/export/pdf`                             | Officer or owner of approved release | Fresh redacted PDF; drafts labelled clearly                                             |
| `GET /requests/:id/export/txt`                             | Officer or owner of approved release | Redacted text                                                                           |
| `GET /requests/:id/export/json`                            | Officer                              | Decision log and candidate text; no original document field                             |
| `GET /corpus`                                              | Officer                              | Source-linked excerpts; embedding arrays omitted                                        |
| `POST /corpus`                                             | Officer                              | `{text,title,requestRef,sourceUrl,treatment,category?}`                                 |
| `POST /corpus/starter`                                     | Officer                              | Imports missing official public starter excerpts                                        |
| `POST /corpus/reindex`                                     | Officer                              | Re-embeds using current provider/model                                                  |
| `GET /audit`                                               | Officer                              | `{events,valid}` with newest events first                                               |
| `GET /settings`                                            | Officer                              | Provider names/configured flags, never secret values                                    |
| `GET /briefing`                                            | Officer                              | Queue transcript and voice provider                                                     |
| `POST /briefing/audio`                                     | Officer                              | ElevenLabs MP3, or explicit not-configured error                                        |

## Independent component interfaces

**Classification:** `classify(originalText)` → `{spans,engine,warnings}`. Spans are suggestions with pending decisions. The UI does not need to know the model SDK.

**Redacted renderer:** `renderRedacted(originalText,spans)` → a new string where withheld text is replaced with fixed section-labelled markers. Do not use original quote values or their character lengths as marker text.

**Leak tester:** `leakTester(redactedText)` → findings. Its signature deliberately accepts no original text, spans, or hidden values.

**Scorer:** `scoreGuesses(findings,originalText,spans)` → findings plus reconstruction result. It runs outside the tester.

**Consistency:** `consistencyCheck(originalText,spans,corpus,store)` → source-linked possible conflicts. Matching text is not automatic legal precedent.

**Integrity:** `integrity(originalText,spans,corpus,store)` → combined checks plus the exact candidate output hash. Release recomputes that hash and rejects a stale result.

The requester serializer is independent from the officer serializer. Never spread a full officer record into a requester response and attempt to remove a few fields afterwards.
