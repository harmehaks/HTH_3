# Move the existing workspace to Tiger Data

The app currently uses SQLite when launched with a local/demo command. Setting a PostgreSQL URL alone does not copy those records. The migration command preserves requests, references, decisions, audit entries, other record kinds, and existing 768-dimensional corpus embeddings without calling Gemini.

1. Stop all Redactor servers that write to the source SQLite database or destination PostgreSQL database.
2. Save the intended full connection URL, including the password, as `MIGRATION_DATABASE_URL` in your local ignored `.env`. Keep credentials out of shell history and Git. `DATABASE_URL` is used if the migration-specific variable is absent.
3. Run `npm run migrate:tiger -- --check`. This checks SQLite integrity, vectors and the audit chain, then connects to the destination and checks for conflicts and pgvector availability. It does not create remote tables or write remote records.
4. Run `npm run migrate:tiger -- --apply`. A consistent SQLite backup is written under ignored `data/migrations/`. Remote table creation, record copying, vector indexing and verification run in one transaction. Existing different records or unrelated vectors abort the migration; they are never overwritten or automatically merged. Rerunning against identical migrated data is supported.
5. After the report says `migrated`, set `DATABASE_URL` to that verified URL and use `npm start` or `npm run dev`. The local/demo/Auth0-local commands explicitly select SQLite. Preserve your Auth0 settings when choosing the launch command.
6. Check the app's storage setting, request count, published comparison, release history and vector search. Keep the SQLite backup until the new workspace is verified.

Reports go to `data/migrations/tiger-migration-latest.json`; no record bodies or connection passwords are included. JSONB content is compared by canonical SHA-256 fingerprints, audit hashes are preserved, and vector values are verified at pgvector's float32 precision. Concurrent source changes detected before commit cause rollback, but stop all writers to avoid any cutover race. No automatic app switch is performed.

Cloud connections require certificate-verified TLS and have a 12-second connection deadline. A connection timeout does not establish whether the password is correct. Check the service state, endpoint details, IP allow list and outbound network access before retrying.

Tests: `node --test tests/tiger-migration.test.js` covers SQLite snapshots, audit/vector validation and conflict detection. Setting `MIGRATION_TEST_DATABASE_URL` enables the real PostgreSQL test; it accepts only an isolated `127.0.0.1` database named `redactor_migration_test`, which must be empty. Never point that test at application data.

## Verified migration: 27 September 2026 UTC

After the network change, the supplied transaction endpoint connected successfully. All 52 existing records (10 requests, 40 references, 2 audit entries) and 40 existing embeddings were migrated. A separate post-commit connection confirmed identical canonical record hashes, the audit chain, certificate-verified TLS and vector search. The original SQLite file and verified backups remain in ignored `data/`.

The local `DATABASE_URL` now selects the migrated Tiger destination. Run `npm start` and open http://127.0.0.1:3001, or use `npm run dev` for development. Commands containing `local`, `demo`, or the existing `dev:auth0` launcher explicitly use SQLite. The migration did not configure or change Auth0 credentials. The running dashboard, published comparison and PDF export passed checks with no browser errors. See [migration verification](../artifacts/tiger-migration-verification.json).
