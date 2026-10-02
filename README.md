# SignalDesk

A full-stack company intelligence workspace for business development: research public websites, explain opportunity scores, identify buyers, draft contextual outreach, compare historical evidence, and prioritize up to five worthwhile actions today.

## What is included

- React interface: daily shortlist, company directory/CSV import, research activity, dossiers, evidence/conflicts, snapshot comparison, outreach editor, and seller settings.
- TypeScript API with password hashing, cookie sessions, origin protection, rate limits, workspace isolation, validation, audit events, and health checks.
- PostgreSQL migrations and a durable worker with row-lock claiming, leases, retries, cancellation, retained research, and idempotent results.
- Server-side Gemini structured-output integration and a separately labeled fictional demo provider. Live failures never become demo results.
- Safe public-site research with DNS validation/pinning, redirect checks, time/body limits, and provenance.
- Docker application/worker/database configuration, CI, unit tests, real PostgreSQL integration tests, and Playwright browser workflows.

See [requirements coverage](docs/REQUIREMENTS.md), [architecture](docs/ARCHITECTURE.md), [API](docs/API.md), and [verification](docs/VERIFICATION.md). The approved prompt and plan are also included under `docs/`.

## Run locally

Requires Node.js 24 and npm. The portable database helper supports the operating systems provided by embedded-postgres; Windows x64 was exercised during development. Use a normal PostgreSQL instance or Docker if your platform is unsupported. Linux initialization must run under a non-root account.

```sh
npm ci
```

Copy `.env.example` to `.env`. The default local database URL uses the development-only credentials shown in that example.

Terminal 1 — database:

```sh
npm run db:local
```

This creates real PostgreSQL databases `signaldesk` and `signaldesk_test`, bound to loopback port 54329. Keep the terminal running. Data persists in `.local-db/`.

Terminal 2 — build, migrate, and serve:

```sh
npm run build
npm run migrate
npm start
```

Terminal 3 — background worker:

```sh
npm run start:worker
```

Open **http://localhost:3000**, create an account, then select **Load fictional demo**. It creates twelve fictional companies and, for a new workspace, a demo seller profile. The dashboard fills as jobs finish. Demo results are fixtures, including the `.example` source URLs; those links are provenance identifiers, not real company websites.

For live use, set `GEMINI_API_KEY` and an available `GEMINI_MODEL` in `.env`, restart the API/worker, configure your seller profile, and import websites in **Live public research** mode. Research currently fetches the homepage, `/about`, and `/careers`; JavaScript-only sites or sites blocking automated access can yield insufficient evidence or an explicit error. An external search/enrichment service is not required or included. The AI integration uses [Gemini's REST generateContent API](https://ai.google.dev/api/generate-content) with schema-validated JSON output.

## Optional seeded account

The UI can load the demo without a pre-existing account. For an explicitly seeded account, set `SEED_PASSWORD` to a unique value of at least twelve characters and optionally set `SEED_EMAIL`, then run:

```sh
npm run seed
```

The default seed email is `demo@signaldesk.local`. No default account password is created. Re-running the seed does not change an existing password. Seed only a development/demo database.

## Development

```sh
npm run dev
```

The development runner watches TypeScript, starts the API and worker after successful compilation, and serves the React app through Vite at http://localhost:5173. Keep the database running and migrate first. Compiler errors prevent a new backend restart; the previous compiled server remains running until the errors are fixed.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npx playwright install chromium
npm run test:browser
npm audit
```

Integration tests use `TEST_DATABASE_URL` or the local `signaldesk_test` database. They reset that dedicated database's application tables; the configuration rejects database names that do not end in `_test`. Never point test settings at production data. Browser tests create their own temporary accounts and can use a running local API/worker or start the built services automatically. In CI, PostgreSQL is provided by a service container.

## Docker Compose

Requires Docker Compose v2. Copy `.env.example` to `.env`, set a strong `POSTGRES_PASSWORD`, and set `DATABASE_URL` using host **db** and port **5432**:

```text
DATABASE_URL=postgresql://signaldesk:<URL-encoded-password>@db:5432/signaldesk
```

For a local Docker demo, keep `NODE_ENV=development`, `APP_ORIGIN=http://localhost:3000`, and `ALLOW_DEMO=true`.

```sh
docker compose up --build -d
docker compose logs -f app worker
```

The migration service runs before the API and worker. PostgreSQL data uses a named persistent volume. The API binds to host loopback; a reverse proxy should expose it for production.

## Production deployment

1. Use a strong database password and private PostgreSQL connectivity. Set `NODE_ENV=production`, a public HTTPS `APP_ORIGIN`, and the live AI key/model. Set `ALLOW_DEMO=false` if fictional research should be unavailable.
2. Build the image and run migrations as a release step before starting the API and worker. Use the same image for both; worker command is `node dist/server/worker/index.js`.
3. Terminate HTTPS at a reverse proxy. Preserve Origin and forwarded protocol headers. Set `TRUST_PROXY=true` only behind exactly one trusted proxy; keep direct access to the API private. Production sessions use Secure/HttpOnly/SameSite cookies.
4. Probe `/health/live` for process liveness and `/health/ready` for migrated database availability. Monitor failed jobs and worker progress, not just API health. Permit outbound HTTPS for the provider and public research; block internal/metadata network targets at infrastructure level too.
5. Back up PostgreSQL regularly, test restoring into a separate database, and review retention of public contact information. Scale worker replicas for throughput; database leases and row locks prevent duplicate claims. Do not interrupt an active release migration.
6. Verify the deployed URL, secure sessions, a live research job, AI output grounding, and persisted action lifecycle before business use. Configure operational alerting and recovery procedures for your hosting environment.

Example backup and restore commands for Compose:

```sh
docker compose exec -T db pg_dump -U signaldesk -d signaldesk -Fc > signaldesk.dump
# Restore only into a deliberately created, separate database:
docker compose exec -T db pg_restore -U signaldesk -d signaldesk_restore < signaldesk.dump
```

Migrations are transactional and serialized with a PostgreSQL advisory lock. Keep a backup before future schema changes. The initial schema is additive; future migrations must include explicit operational/rollback guidance.

## Product decisions and limits

- Scores are deterministic weighted arithmetic; AI supplies evidence-backed component assessments. Confidence is separate. The default threshold is score 55 and confidence 65%, with evidence for all four components. Zero seller fit excludes a company even when other components are strong.
- Buyer personas are recommendations. A named person requires their name and role in cited public text. Email addresses are never guessed.
- A first snapshot cannot establish historical change. Event dates remain unknown unless the source explicitly contains the date.
- Conflicts remain visible, including when a selected value is withheld. Missing headcount/revenue is displayed as unknown.
- Seller changes invalidate the daily qualification of earlier assessments until re-research. Changing only the daily limit does not invalidate seller context.
- Outreach is editable draft content. No messages are sent automatically.
- Automated lexical checks and schema validation reduce unsupported outputs; they cannot prove every semantic judgment made by a live model. Review evidence before acting.
- Live AI and live hosting require your credentials. Container configuration is included; see the verification report for what was actually exercised in this environment.
