# Architecture

## Boundaries

`shared/` owns validated data contracts and pure scoring, ranking, source reliability, and change detection. `client/` is a React SPA and sends credentialed same-origin API requests. `server/` owns identity/authorization, database transactions, public research, provider access, and the durable worker. PostgreSQL is the system of record; there is no in-memory persistence substitute.

The API serves the built frontend. A separate process uses the same backend modules for research. The queue is PostgreSQL-backed so process restarts preserve jobs and captured evidence.

## Research data flow

1. Validate and normalize a single or batch input; deduplicate by workspace and website.
2. Enqueue one active job per company and return HTTP 202.
3. Worker claims a job transactionally using `FOR UPDATE SKIP LOCKED`; a 90-second lease is refreshed every 15 seconds.
4. Fetch bounded public pages, pin validated DNS answers, revalidate redirect destinations, and record immutable source excerpts/timestamps. Live per-domain starts are separated by 60 seconds.
5. Persist raw source evidence before AI analysis. Provider retries are bounded; schema or evidence failures become stable job error codes, never fictional results.
6. Validate factual values/excerpts and references, preserve conflict alternatives, compute deterministic weighted scoring and confidence, and compare developments to the prior snapshot.
7. Lock the current job and verify ownership/lease/cancellation before committing snapshots, claim/contact/trigger records, actions, AI usage, audit event, and job success.

Failed attempts retry up to three times, with a ten-second queue delay. Explicit retries add three allowed attempts and retain research. Expired leases are reclaimed; exhausted jobs fail. Snapshot uniqueness by job and action uniqueness by company/fingerprint prevent duplicate results. A repeated unchanged recommendation preserves its lifecycle; it does not reopen a completed action.

## Ranking

The directory includes every researched company. The daily dashboard ranks only latest-snapshot actions that meet thresholds, match the current seller context, and are neither completed/dismissed nor actively snoozed. It selects one per company and applies the policy limit on the server. Ranking order is score, meaningful-change count, observation recency, confidence, and stable action ID.

The original assessments retain seller inputs. New seller context requires re-research; daily-limit-only changes apply immediately. This keeps historical scores reproducible.

## Reliability and changes

Claims hold exact source excerpts and evidence IDs. Reliability groups claims by field, prefers primary authority and corroboration/freshness, and retains alternatives. Equally credible conflicting values are withheld. A dossier differentiates missing values from unresolved conflicts.

Trigger detection compares normalized, evidence-backed development text and category. It ignores source-page layout, reordered claims, and copyright noise. A first snapshot produces no historical trigger. This is a conservative text-based comparison, not a general web-scale event database; paraphrased newly captured developments can require review.

## Security

Password hashes use salted scrypt. Random session tokens are stored only as hashes. Cookies are HttpOnly/SameSite Strict and Secure in production. Browser mutations are origin-checked; authenticated production mutations require an Origin. Each resource query is scoped by workspace, preventing disclosure by guessed IDs. Structured errors and logs omit raw provider responses/API keys.

Research rejects private/link-local/reserved addresses, unsafe protocols/ports/credentials, mixed unsafe DNS answers, redirects to blocked destinations, oversized bodies and unsupported MIME. The selected public DNS address is used for the actual connection, avoiding a second uncontrolled lookup. Research sources are untrusted AI data and cannot invoke tools or send messages. Infrastructure should enforce outbound network isolation too.

## Operations

Run migrations as a separate release step; readiness checks require the migration table. API and worker stop on process signals. Job leases recover work after interruptions. Docker uses a non-root runtime user and a persistent PostgreSQL volume. Credentials are external environment values. See README for deployment, backup, and restore.
