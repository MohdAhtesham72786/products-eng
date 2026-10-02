# SignalDesk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution or superpowers:subagent-driven-development for delegated execution. Track the checkboxes below.

**Goal:** Deliver all nine company intelligence tasks as a working, evidence-backed business development application.

**Architecture:** React client, TypeScript Node API, independent durable PostgreSQL worker. Share validated contracts and pure scoring/reliability logic. One workspace per account initially, with explicit workspace authorization on every resource.

**Tech Stack:** React, Vite, TypeScript, Express, Zod, PostgreSQL/pg, Vitest, Playwright, Docker Compose. Select supported dependency versions and commit a lockfile during setup.

**Spec:** [PROJECT_PROMPT.md](PROJECT_PROMPT.md)

## Global constraints

- Default maximum five qualified actions; do not pad results.
- Scoring weights: fit 35%, need 25%, timely trigger 25%, approachability 15%.
- Real external LLM adapter and explicitly labeled deterministic demo mode.
- UTC persistence, immutable snapshots, evidence-linked factual claims, no invented people/emails.
- Never silently use demo results after live research fails.
- Draft outreach only; sending and live hosting are not authorized deliverables.
- Secure fetching, durable retries, workspace isolation, migration-backed PostgreSQL persistence.
- Deliver source under `outputs/signaldesk`, with documentation and honest verification results.

## Review focus

1. DNS rebinding or redirect to internal address: reject before connecting, pin validated resolution.
2. Worker death after research: reclaim expired lease without duplicate snapshots/actions.
3. Cross-workspace IDs: return resource-not-found without revealing another workspace's data.
4. Provider returns plausible claims with nonexistent evidence: reject and retain research for retry.
5. Snooze boundaries and repeated research: honor UTC expiry, exclude completed/dismissed actions, avoid repeated recommendations for unchanged evidence.

## File boundaries

```text
outputs/signaldesk/
  package.json, package-lock.json, tsconfig.json, vite.config.ts
  client/{App.tsx,api.ts,styles.css,components/,pages/}
  shared/{contracts.ts,scoring.ts,reliability.ts,triggers.ts}
  server/{app.ts,index.ts,config.ts,db.ts,auth.ts,errors.ts}
  server/routes/{companies.ts,jobs.ts,actions.ts,settings.ts,outreach.ts}
  server/research/{safe-fetch.ts,extract.ts,providers.ts,evidence.ts}
  server/worker/{index.ts,queue.ts,pipeline.ts}
  migrations/001_initial.sql
  scripts/{migrate.ts,seed.ts}
  tests/{unit/,integration/,browser/}
  Dockerfile, compose.yaml, .dockerignore, .env.example, .gitignore
  README.md, docs/{API.md,ARCHITECTURE.md,REQUIREMENTS.md,VERIFICATION.md}
```

## Task 1 — Contracts, database, identity, configuration

**Files:** shared/contracts.ts; server/config.ts, db.ts, auth.ts, app.ts, errors.ts; migrations/001_initial.sql; scripts/migrate.ts; tests/integration/auth.test.ts.

**Interfaces:** `createApp(): Express`; `withTransaction<T>(fn): Promise<T>`; `requireSession` attaches `{userId, workspaceId}`. Shared Zod schemas define seller settings, source, claim, analysis, assessment, action, and stable API error `{code,message}`.

- [ ] Write integration assertions for migrations, registration/login/logout, hashed passwords, expired sessions, CSRF/origin rejection, and cross-workspace access.
- [ ] Run tests and confirm failure before implementation.
- [ ] Create package/build scripts, SQL migrations, secure cookie sessions, schema validation, rate limiting, configuration validation, and error handling.
- [ ] Store users, workspaces, sessions, settings, companies, jobs/attempts, research sources, snapshots, claims, contacts, assessments, triggers, actions, drafts, and audit events with constraints and indexes.
- [ ] Run typecheck and PostgreSQL integration tests; verify migration rerun safety.

## Task 2 — Safe research and durable queue

**Files:** server/routes/companies.ts, jobs.ts; server/research/safe-fetch.ts, extract.ts; server/worker/queue.ts, pipeline.ts, index.ts; tests/unit/safe-fetch.test.ts; tests/integration/queue.test.ts.

**Interfaces:** `normalizeWebsite(input:string): string`; `fetchPublicPage(url:string): Promise<Source>`; `enqueueResearch(workspaceId,companyId,mode): Promise<Job>`; `claimJob(workerId): Promise<Job|null>`.

- [ ] Test URL normalization, invalid rows, batch deduplication, private/reserved IPv4 and IPv6, redirects, rebinding, oversized bodies, unsupported MIME, and timeouts.
- [ ] Test competing workers, expired leases, bounded retries, cancellation, retained research after provider failure, and snapshot/action uniqueness per job.
- [ ] Run the tests and confirm failure.
- [ ] Implement validated DNS pinning, bounded public HTTP(S) fetches, useful text extraction, a small same-domain page budget, and per-domain rate limits.
- [ ] Implement transactional `FOR UPDATE SKIP LOCKED` claiming, heartbeat leases, retry scheduling, attempt records, cancellation checkpoints, and durable status endpoints.
- [ ] Verify unit and PostgreSQL queue tests, including restart/reclaim behavior.

## Task 3 — AI, evidence validation, reliability, and scoring

**Files:** server/research/providers.ts, evidence.ts; shared/scoring.ts, reliability.ts; tests/unit/analysis.test.ts, scoring.test.ts, reliability.test.ts; tests/integration/pipeline.test.ts.

**Interfaces:** `analyzeCompany(sources:Source[],seller:SellerSettings): Promise<Analysis>` through a provider adapter; `validateEvidence(analysis,sources): Analysis`; `scoreOpportunity(analysis,seller): Assessment`; `resolveClaims(claims,sources): Resolution[]`.

- [ ] Test schema failures, invented source IDs, unsupported person identification, provider timeout/retry, and no fallback from live to demo.
- [ ] Assert all component values 0–100, weighted arithmetic, separate confidence, policy version, reproducible stored inputs, missing seller context, and disqualifier handling.
- [ ] Test fresh primary versus stale secondary evidence, equally credible conflicts, corroboration, unknown values, and retained alternatives.
- [ ] Confirm failing tests, then implement an external LLM adapter using server-side credentials, bounded retries, structured outputs, usage accounting, and untrusted-source instructions.
- [ ] Implement explicit demo provider with fictional companies and deterministic evidence, plus source-bound claims and deterministic reliability/scoring rules.
- [ ] Verify tests and real database persistence; record live-provider verification separately from mocked adapter tests.

## Task 4 — Historical changes, contact selection, outreach

**Files:** shared/triggers.ts; server/routes/companies.ts, outreach.ts; server/worker/pipeline.ts; tests/unit/triggers.test.ts; tests/integration/outreach.test.ts.

**Interfaces:** `compareSnapshots(before:Snapshot,after:Snapshot): Trigger[]`; `selectContact(analysis,seller): ContactRecommendation`; `generateDraft(snapshot,contact,seller,channel): Promise<Draft>`.

- [ ] Test first snapshot, identical content, text reordering, navigation/copyright noise, supported launch/hiring changes, observation versus event date, and company-mismatched snapshot IDs.
- [ ] Test sourced named person versus persona fallback, unknown contact details, draft grounding, regeneration, persistent edits, and workspace isolation.
- [ ] Confirm failure, then implement immutable snapshot history, evidence-linked comparisons, meaningful trigger significance/confidence, and contact/persona rationale.
- [ ] Implement email/network draft generation with subject, message, evidence references, and caveats; validate AI output and persist editable versions.
- [ ] Verify unit/integration tests and repeated research with two distinct snapshots.

## Task 5 — Server-side daily action policy

**Files:** shared/scoring.ts; server/routes/actions.ts, settings.ts; server/worker/pipeline.ts; tests/unit/actions.test.ts; tests/integration/actions.test.ts.

**Interfaces:** `rankActions(candidates,policy,now): Action[]`; `GET /api/actions/today`; `PATCH /api/actions/:id` accepts done/dismissed/snoozed plus optional UTC snooze expiry.

- [ ] Assert maximum five by default, configurable limit, evidence/score/confidence qualification, fewer-than-five explanation, unique company selection, and stable ranking.
- [ ] Test done/dismissed exclusion, snooze expiry exactly at the boundary, repeated unchanged snapshots, and seller policy changes.
- [ ] Confirm failure, implement query/ranking/lifecycle and audit events, then run unit/integration tests.
- [ ] Document the task-nine change: larger opportunity directory → configurable server-side daily shortlist, with tests showing limit changes do not change directory size.

## Task 6 — Complete responsive React application

**Files:** client/App.tsx, api.ts, styles.css, components/, pages/; tests/browser/workflows.spec.ts.

**Interfaces:** credentialed API client consumes shared validated contracts. Screens: account entry, today, directory/import, dossier, snapshots/compare, research status, outreach, and seller/policy settings.

- [ ] Write browser workflows for login, fictional demo setup, single and batch import, invalid-row feedback, job completion surviving reload, dossier evidence, contact/persona, snapshot comparison, outreach edit/copy, snooze/done, and seller settings.
- [ ] Verify expected failures before UI implementation.
- [ ] Build responsive navigation and accessible forms, status/error/empty states, score component explanations, provenance/conflict views, selectable snapshots, and clear demo/live labels.
- [ ] Poll durable job status with cleanup/backoff and display retry/cancel controls. Preserve unsaved outreach edits against background refresh.
- [ ] Run browser tests, keyboard/mobile checks, typecheck, and production build.

## Task 7 — Deployment, documentation, final verification

**Files:** Dockerfile, compose.yaml, .env.example, scripts/seed.ts; README.md; docs/API.md, ARCHITECTURE.md, REQUIREMENTS.md, VERIFICATION.md.

**Interfaces:** `npm run dev`, `npm run worker`, `npm run migrate`, `npm run seed`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run test:browser`, `npm run build`; `/health/live`, `/health/ready`.

- [ ] Package a multi-stage non-root image, PostgreSQL persistent volume, migration service, application/worker services, graceful shutdown, and health checks.
- [ ] Add explicit fictional seed data, server-only credentials, production environment validation, TLS/reverse-proxy guidance, backup/restore and migration procedures.
- [ ] Document every API route and map all nine source tasks to implementation and tests.
- [ ] Run unit tests, PostgreSQL integration tests, browser workflows, typecheck, build, and container startup/readiness smoke test. Record exact results and any blocked checks.
- [ ] Review authorization, fetch security, retry/idempotency, grounding, and action policy against the specification; fix material findings and rerun affected checks.
- [ ] Deliver source and verification report. Do not claim live deployment, live AI success, or production readiness for checks that remain unverified.

## Environment and execution decisions

Node.js is installed. Docker was not found during initial inspection. Before dependency installation, determine whether package registry access requires additional permissions. For real PostgreSQL integration, use an available local PostgreSQL runtime or a user-approved service; do not replace these tests with an in-memory database and label them PostgreSQL verification. Browser binaries may also need installation permissions. Keep these limitations explicit while implementing independently testable parts.

Recommended execution: native in this chat, because queue, evidence, scoring, and action-policy tasks share evolving contracts. Delegation is optional and requires the user's selection. The complete build remains the objective; this plan is the implementation review checkpoint.
