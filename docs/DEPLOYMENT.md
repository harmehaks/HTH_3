# Deploy Mr. Redactor to mr-redactor.vip

Use a Vultr Ubuntu server to run the React build and Express API together, Caddy for HTTPS, your existing hosted Tiger Data database for records/vectors/sessions, Auth0 for login, and Gemini for classification, independent checks and embeddings. Porkbun manages DNS; it does not run this application.

The supplied production stack requires all three integrations and disables demo roles. It does not replace your saved local `.env`. No server has been created and no live deployment is claimed. The earlier real Auth0 login still fails with `AUTH0_CLIENT_REJECTED`; the production callback settings below are necessary, and a successful real login is required before calling authentication verified.

## 1. Create a Vultr server

In Vultr, deploy a Cloud Compute server with Ubuntu 24.04 LTS, a public IPv4 address, and an SSH key added during creation. A 2-vCPU/4-GB instance is a practical starting size for building this app; you can resize after measuring use. Pick a region near your Tiger database. Save its public IPv4 address as `SERVER_IP` in these instructions; replace that text whenever it appears.

Configure the Vultr firewall attached to this server:

| Protocol/port | Source                    | Purpose                                  |
| ------------- | ------------------------- | ---------------------------------------- |
| TCP 22        | Your current public IP/32 | SSH administration                       |
| TCP 80        | Public internet           | HTTP redirect and certificate validation |
| TCP 443       | Public internet           | HTTPS                                    |
| UDP 443       | Public internet, optional | HTTP/3                                   |

The application port 3001 is not published to the host. Database connections are outbound to Tiger's actual port; do not open a public database port on your app server. If you use a separate host firewall, allow SSH before enabling it and allow HTTP/HTTPS there too.

From Windows PowerShell, connect using the user shown on the Vultr instance's Overview page (normally `root` for this Ubuntu image):

```powershell
ssh root@SERVER_IP
```

All following shell blocks run **inside that Linux SSH session**, except where explicitly marked otherwise. See [Vultr SSH instructions](https://docs.vultr.com/products/compute/instances/cloud-compute/connection/openssh).

## 2. Install Docker and clone main

Install Docker Engine, the Buildx plugin and the Compose plugin using [Docker's official Ubuntu apt repository instructions](https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository). Follow the repository setup and package installation steps on that page. This is a one-time server setup; Node does not need to be installed on the host.

Then run:

```bash
sudo apt-get update
sudo apt-get install -y git openssl nano
sudo docker version
sudo docker compose version
sudo git clone --branch main --single-branch https://github.com/harmehaks/HTH_3.git /opt/mr-redactor
cd /opt/mr-redactor
```

If GitHub requires authentication, use an authorized SSH deploy key or authenticate Git on the server. Do not put a GitHub token in the clone URL.

## 3. Point Porkbun DNS at the server

In Porkbun, open **mr-redactor.vip → DNS records**. Add these records:

| Type | Host        | Answer                            |
| ---- | ----------- | --------------------------------- |
| A    | Leave blank | Your server's public IPv4 address |
| A    | `www`       | The same public IPv4 address      |

Replace any parking or other A/AAAA/CNAME records for these exact website names that would send requests elsewhere. Keep unrelated email/DNS records. Use an AAAA record only if this server also has working, correctly configured public IPv6. Keep the Porkbun nameservers shown in your account; no nameserver change or URL forwarding is needed for this setup.

From Windows PowerShell, check:

```powershell
Resolve-DnsName mr-redactor.vip -Type A
Resolve-DnsName www.mr-redactor.vip -Type A
```

Both should return your Vultr IPv4 address before HTTPS setup can complete. DNS caches can take time to refresh. [Porkbun's A-record instructions](https://kb.porkbun.com/article/54-pointing-your-domain-to-hosting-with-a-records).

## 4. Configure Auth0 for the public domain

Open **Redactor_OG** on tenant `dev-i7p4kdozefycl6u7.ca.auth0.com`, with client ID `EdEu2b1ioiUTJrEvBVTDxuB1XSuOLzOX`. Confirm Regular Web Application, **Credentials → Client Secret (Post)**, and **Settings → Advanced Settings → Grant Types → Authorization Code** enabled.

Save these application settings:

| Setting               | Production value                   |
| --------------------- | ---------------------------------- |
| Application Login URI | `https://mr-redactor.vip/login`    |
| Allowed Callback URLs | `https://mr-redactor.vip/callback` |
| Allowed Logout URLs   | `https://mr-redactor.vip/`         |
| Allowed Web Origins   | `https://mr-redactor.vip`          |

Append the production callback/logout URLs to existing localhost entries if you still need local testing. Do not register `/api/auth/callback`: this project uses the Express SDK's `/callback`. The `www` site redirects to the root domain, so the root domain is the login origin.

Copy **this application's Client Secret** into the server environment file in step 6. If you instead create a separate production Auth0 Regular Web Application, use its matching ID/secret in the file and configure the same production URLs; the ordinary Docker launch uses those values without the localhost launcher's overrides.

Create/assign the Auth0 role `officer` to your officer account. Deploy a Post Login Action that adds the roles to the identity token, and attach it to the Login flow:

```js
exports.onExecutePostLogin = async (event, api) => {
  api.idToken.setCustomClaim('https://redactor.app/roles', event.authorization?.roles || []);
};
```

Keep `AUTH0_ROLES_CLAIM=https://redactor.app/roles` in the app. This namespace is a claim identifier; the application's public domain can be different. Users without the officer role receive requester access. Sign out/in after changing roles. Enable any social connections you intend to offer for this application.

References: [Regular Web Application flow](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow/add-login-auth-code-flow), [credential settings](https://auth0.com/docs/get-started/applications/credentials), [project Auth0 guide](AUTH0_SETUP.md).

## 5. Prepare Tiger Data and Gemini

In Tiger, use the existing database you want this site to show. From its **Connect** dialog, copy the full connection URL for the intended direct or transaction-pool endpoint. Preserve the exact hostname, its endpoint-specific port, username and database name. Add the password privately; URL-encode reserved characters in it. A typical shape is:

```text
postgresql://USERNAME:URL_ENCODED_PASSWORD@TIGER_HOST:TIGER_PORT/tsdb
```

In **Operations → Security → IP Allow List**, add the Vultr server's public IPv4 address with `/32` to any allow list restricting this service. Keep other addresses needed for existing clients. Ensure the service is running and supports the `vector` extension. Startup creates that extension and the app's record/vector tables if absent; the selected database role needs the relevant permissions.

Keep `DATABASE_SSL=true`. Remove `sslmode`, `sslcert`, `sslkey`, and `sslrootcert` query parameters from this app's connection URL: node-postgres otherwise overrides the app's explicit TLS configuration. [node-postgres TLS documentation](https://node-postgres.com/features/ssl). Use your provider's valid TLS certificate rather than disabling verification.

Reusing your already migrated Tiger database preserves its records. Choosing a different database does not automatically copy SQLite records. If migration is needed, follow [the migration guide](TIGER_MIGRATION.md) before switching databases.

In Google AI Studio, use a Gemini key authorized for your project and its Generative Language API. Put it only in `GEMINI_API_KEY` on the server. This code calls Gemini from Express, so the key does not go in a `VITE_` setting. Keep the tested settings `GEMINI_MODEL=gemini-3.1-flash-lite` and `GEMINI_EMBEDDING_MODEL=gemini-embedding-001`, then validate actual availability with the live check below. If your key has an IP restriction, it must allow the Vultr server's outbound public IP. Enable billing/appropriate quotas in that project as needed for your traffic. References: [Gemini key setup](https://ai.google.dev/gemini-api/docs/api-key), [model](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

## 6. Save production secrets on the server

Inside the Linux SSH session:

```bash
cd /opt/mr-redactor
sudo cp .env.production.example .env.production
sudo chmod 600 .env.production
openssl rand -hex 32
sudo nano .env.production
```

Copy the generated random value into `SESSION_SECRET` locally. Fill all of these required values:

| Variable                | Value                                                               |
| ----------------------- | ------------------------------------------------------------------- |
| `DATABASE_URL`          | Complete Tiger URL from step 5                                      |
| `GEMINI_API_KEY`        | Gemini API key                                                      |
| `AUTH0_ISSUER_BASE_URL` | `https://dev-i7p4kdozefycl6u7.ca.auth0.com`                         |
| `AUTH0_CLIENT_ID`       | `EdEu2b1ioiUTJrEvBVTDxuB1XSuOLzOX`, or your new production app's ID |
| `AUTH0_CLIENT_SECRET`   | Matching Auth0 application secret                                   |
| `SESSION_SECRET`        | Random value from the command above                                 |

The template already sets `AUTH0_BASE_URL=https://mr-redactor.vip`, `DEMO_MODE=false`, the model names and TLS. Wrap secret values in single quotes when editing, especially values containing `$` or `#`, to prevent Compose environment interpolation. Do not paste secrets into chat or put them in shell commands. In nano: Ctrl+O, Enter, then Ctrl+X.

ElevenLabs is optional for your requested three integrations. To keep its voice briefing too, fill `ELEVENLABS_API_KEY` and the intended `ELEVENLABS_VOICE_ID`; otherwise browser speech remains available.

Do not run `npm run setup:auth0` on this server: that local wizard writes localhost settings. The secret file is ignored by Git and excluded from the Docker build context. Do not publish `docker compose config` output; use `config --quiet` as below.

## 7. Build and start HTTPS

Use this **standalone production file** for every command; the ordinary `compose.yaml` deliberately uses a local demonstration database.

```bash
cd /opt/mr-redactor
sudo docker compose --env-file .env.production -f compose.production.yaml config --quiet
sudo docker compose --env-file .env.production -f compose.production.yaml up -d --build --wait
sudo docker compose --env-file .env.production -f compose.production.yaml ps
```

The app should be healthy and Caddy running. Build/start may take several minutes. Caddy obtains and renews HTTPS certificates when the domain points to this server and ports 80/443 are reachable. You do not need to buy a separate Porkbun SSL certificate. Certificates persist in a Docker volume; `www.mr-redactor.vip` redirects to `mr-redactor.vip`. [Caddy HTTPS guidance](https://caddyserver.com/docs/quick-starts/reverse-proxy).

If it fails, inspect:

```bash
sudo docker compose --env-file .env.production -f compose.production.yaml logs --tail=80 redactor caddy
```

Never start the localhost Vite development server for public hosting. This container serves the built frontend and API on one HTTPS origin.

## 8. Verify all integrations

First, public routing and configuration:

```bash
curl --fail https://mr-redactor.vip/api/health
sudo docker compose --env-file .env.production -f compose.production.yaml exec -T redactor npm run verify:deployment
```

Health should return `{"ok":true}`. The verifier checks valid public HTTPS, built JavaScript, demo disabled, Auth0 login/signup callback/PKCE and secure transaction cookies, logout return URL, HTTP-to-HTTPS redirection, and denied anonymous access to records. It does not enter an account password or authenticate a user.

Next, actual calls from the server with synthetic data:

```bash
sudo docker compose --env-file .env.production -f compose.production.yaml exec -T redactor npm run verify:live -- --service=tiger
sudo docker compose --env-file .env.production -f compose.production.yaml exec -T redactor npm run verify:live -- --service=gemini
sudo docker compose --env-file .env.production -f compose.production.yaml exec -T redactor npm run verify:live -- --service=auth0
```

Tiger must report `passed` for DNS, TCP, authentication, TLS, pgvector and the JSONB/vector round trip. Its test rolls back a temporary table. Gemini must report `passed` for classification, the independent leak tester and 768-dimensional embeddings. These Gemini calls use quota and can incur normal API charges. Auth0 intentionally reports `partial` (exit code 2) after checking discovery/signing keys because real account login is still required; this alone does not prove that the client secret works. Reports persist in the app's `artifacts` volume.

If using ElevenLabs, run the equivalent command with `--service=elevenlabs` to exercise synthetic voice synthesis.

Finally, manually verify:

1. Open `https://mr-redactor.vip` in a private browser window and sign in using your Auth0 officer account. The officer dashboard should appear.
2. In Settings, check **Auth0**, **Tiger Data / PostgreSQL + pgvector**, **Gemini**, and **Gemini embeddings**. These labels indicate configuration; the live checks above establish actual provider calls.
3. Submit the fictional Air Canada sample, classify it, review/resolve findings and run Integrity checks. Confirm Gemini produced suggestions and the candidate removes the selected private text.
4. Restart only the app with `sudo docker compose --env-file .env.production -f compose.production.yaml restart redactor`, refresh, and confirm the request remains. This checks persistence in Tiger.
5. Sign out. Sign in as a separate account without the officer role and confirm it receives the requester portal and cannot access the officer workspace. Test its own request and a released PDF download.
6. Confirm logout returns to the public landing page. Open `https://www.mr-redactor.vip` and confirm it redirects to the root domain.

Real Auth0 must successfully exchange a login code and create the correct session. If it still shows `AUTH0_CLIENT_REJECTED`, publishing to HTTPS has not fixed that existing provider failure. Inspect the real tenant/application credentials and Auth0 logs; do not enable demo mode to count the login as passing.

## 9. Updates and recovery

To deploy a later main commit:

```bash
cd /opt/mr-redactor
sudo git pull --ff-only origin main
sudo docker compose --env-file .env.production -f compose.production.yaml up -d --build --wait
sudo docker compose --env-file .env.production -f compose.production.yaml exec -T redactor npm run verify:deployment
```

After editing environment variables, run `up -d --force-recreate --wait`; `restart` alone keeps the old container environment. Keep `SESSION_SECRET` stable across ordinary updates. Tiger backups protect the records; retain the production environment file privately so the service can be recovered. Keep Caddy's certificate volume across updates.

| Symptom                           | Check                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| Porkbun parking page              | Root/www DNS still points at parking, or cached records have not refreshed                 |
| Caddy certificate error           | DNS A/AAAA points at the correct host; public ports 80/443 are open                        |
| Site unavailable/app unhealthy    | App logs; Tiger connectivity must work before API startup                                  |
| Tiger `ETIMEDOUT`                 | Correct direct/pool hostname AND port, service ready, server IP allowed, outbound access   |
| TLS verification failure          | Correct endpoint, trusted certificate, no URL SSL overrides; keep TLS verification enabled |
| Auth0 callback mismatch           | Register exactly `https://mr-redactor.vip/callback` on the chosen app                      |
| Auth0 token exchange Unauthorized | Correct tenant/client/secret and Post method; real sign-in remains required                |
| Requester view for officer        | Assign officer role, attach/deploy the roles Action, then sign out/in                      |
| Gemini 401/403                    | Correct key, API restrictions, project permissions, and server IP restriction              |
| Gemini 429                        | Project/model quota or billing limit; retry after the limit recovers                       |
| Gemini 404                        | Configured generation/embedding model is not available for the current API/project         |

This guide prepares deployment; it is not proof that Vultr, DNS, HTTPS or live production integrations have been tested. Complete step 8 on the actual server before reporting the deployment as working.
