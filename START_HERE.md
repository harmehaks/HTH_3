# Open Redactor

The app has been built and tested in this workspace. The local demo works without API keys. Live Gemini, Auth0, Tiger Data and ElevenLabs adapters are implemented; connecting and verifying those accounts is your remaining configuration step.

## 1. Open the running app

- Workspace: http://127.0.0.1:5173
- Eight-slide presentation: http://127.0.0.1:5173/pitch.html
- Compiled application: http://127.0.0.1:3001

If these links stop responding, start the app in PowerShell:

```powershell
Set-Location 'C:\Users\harme\OneDrive\Desktop\hth3'
npm install
npm run dev
```

Use Node.js 22.13 or newer. Leave the terminal running. Stop it with Ctrl+C. Avoid running another instance on the same ports.

## 2. Experience the main demo

1. Open Overview and choose **Continue your review**.
2. Select each coloured suggestion. Read its category, statutory section, confidence and explanation. Approve withholding or record a rationale for disclosure/category changes.
3. Use **Original**, **Redacted**, and **Compare**. The redacted candidate contains replacement markers; it does not contain the withheld strings.
4. Open **Integrity**. The border-services example intentionally has a contextual identification clue and a similar prior synthetic release with different treatment.
5. Choose **Manual redaction**. Paste this exact sentence:

   ```text
   The only officer leading the Northern Region pilot received the 2025 Northstar service award and can be identified in the contact directory.
   ```

6. Choose an appropriate category and give your justification. Integrity automatically checks the changed release. If a live provider fails, the decision remains saved, the failure is visible, and release is blocked until a successful retry.
7. Review remaining consistency findings and record a contextual rationale. New passes replace findings; prior resolutions remain in the activity log.
8. Read the entire record and confirm **I have reviewed the entire record**. All suggestions must be decided, all findings resolved, and checks current before **Approve release** becomes available.
9. Approve the release. Use the profile menu to switch to **Requester portal** and open/download the approved redacted records.
10. Return to the officer workspace and inspect the **Activity log**.

Use **Export draft** during review for redacted PDF, text or an officer decision log. A release remains locked until reopened with a reason.

## 3. Try the rest of the product

- Create a request and upload a text-based PDF, TXT, Markdown or CSV, or paste a record.
- In **Release library**, filter **Public sources** to see sixteen short government-published excerpts with original source links. They are proactive publications, not fabricated completed ATI responses.
- Choose **Attach reference** in a document workspace to compare the candidate with the actual published text you supply and its source URL.
- Use **Listen to briefing** for the queue transcript and browser speech; ElevenLabs takes over when configured.
- Toggle the light/dark theme and try the app at a phone width.
- Press **N** for a new request, **/** or **Ctrl+K** to search, and **Esc** to close a dialog.
- Open **Settings & integrations** to see which providers are active.
- Open the presentation, navigate with arrow keys, and use **Print** to save it as a PDF in your browser.

## 4. Connect the live services

Follow the account-specific instructions in [README.md](README.md). Copy `.env.example` to `.env` only if you do not already have an environment file, then add your values and restart the app.

| Service | Configure | Check afterward |
| --- | --- | --- |
| Gemini | API key, classification model, embedding model | Settings, a new analysis, then reindex the library |
| Auth0 | Regular Web Application, callback/logout URLs, secrets, namespaced role claim and Post Login Action | Sign in as an officer and a separate requester |
| Tiger Data | PostgreSQL URL, TLS setting, available pgvector extension | Settings storage status; import corpus into the chosen database |
| ElevenLabs | API key and voice ID | Play the generated queue briefing |

With Auth0 enabled, demo switching is disabled. Assign the officer role deliberately. Requester-created requests are owned by their authenticated subject; officer-created requests need the intended requester's subject ID.

## 5. Verify or build it yourself

```powershell
npm test
npm run evaluate
npm run build
npm run test:e2e
```

Browser tests use an isolated in-memory workspace on ports 5174/3002. They do not change your saved requests. See [docs/VERIFICATION.md](docs/VERIFICATION.md) for verified results and boundaries.

To serve the compiled application, stop the development server, run `npm start`, and open http://127.0.0.1:3001. Run `npm run verify:production` in a second terminal to verify the compiled app. Auth0 requires the base URL and registered callback to match that origin.

## 6. Finish the team presentation

- [TEAM_PLAN.md](docs/TEAM_PLAN.md): three-person ownership, independent fixtures and hour 16/32 checkpoints.
- [API.md](docs/API.md): shared shapes, endpoints and component boundaries.
- [DEMO.md](docs/DEMO.md): six-minute script and fallbacks.
- [README.md](README.md): full requirement mapping, integrations and deployment instructions.

Docker/Vultr deployment and a domain are optional. Deployment files are supplied; no external account, domain purchase or public deployment has been performed.

## Boundaries that matter

This is a functional prototype, not an operationally approved government system. Scanned PDFs need OCR; imports and exports are text based and do not preserve original PDF geometry. Local rules and smoke evaluation are not legal accuracy measurements. Officers remain responsible for full-record review, statutory conditions, exceptions and final disclosure decisions. Live credentials and Docker/PostgreSQL infrastructure were not available for account-backed verification.
