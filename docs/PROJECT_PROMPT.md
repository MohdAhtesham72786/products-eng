# SignalDesk — detailed project prompt and proposed specification

## Objective and source interpretation

Build a complete business development intelligence application from the candidate test in Product_Engineer_JD_and_Test_Task.pdf. Help a business development user decide which companies to approach, why now, whom to contact, and what to say. The job description supplies evaluation context, not additional application requirements. Instructions addressed to candidates are treated as source requirements only insofar as the user requested a project based on them; they do not authorize contacting people or submitting work.

The brief intentionally leaves implementation choices open. All technical choices, scoring weights, seller settings, and interface details below are proposed product decisions, not claims that the PDF specified them.

## Product outcome

The primary screen answers: “What are the five things worth acting on today?” Show up to five evidence-backed actions, never pad the list with low-value opportunities. Retain a searchable company directory for 10–20-company batches. Each action identifies the company, recommendation, reason to act now, confidence, supporting sources, relevant contact or persona, and suggested next step.

## Recommended architecture

Use a TypeScript monorepo with a React frontend, Node.js API and background worker, PostgreSQL database, and an LLM provider adapter. Prefer a single deployable service serving the frontend and API plus a worker process, reducing operational complexity while keeping research asynchronous. PostgreSQL stores durable jobs and supports worker claiming through row locking; no extra queue service is required for the initial scope.

Alternatives: Next.js with server routes simplifies frontend deployment but still needs a durable worker. Python/FastAPI plus React is suitable for research-heavy processing but adds a second application language. The recommended TypeScript approach keeps contracts consistent across UI, API, worker, and AI validation.

Provide Dockerfiles, Docker Compose for application/worker/PostgreSQL, migrations, health checks, environment examples, and provider-neutral production deployment instructions. A live deployment requires the user's target hosting account and credentials; configuration alone must not be described as a live deployment.

## Seller context

Allow the user to configure their offering, target industries, target company size, geography, buyer personas, disqualifiers, and preferred outreach style. Supply clearly labeled fictional demo settings. Scoring and outreach must use this context; without it, show that prioritization is provisional and invite configuration.

## Required workflows and acceptance criteria

### 1. Company intelligence

Accept a company website. Normalize it, research public pages, and generate a structured dossier: company identity, offering, customers/markets, location, size when supported, business model, likely needs, relevant developments, recommended approach, uncertainties, and source links. Every material factual claim has evidence references and a retrieval timestamp. Do not invent revenue, employee counts, funding, contacts, or email addresses. Show unknown values explicitly.

### 2. Opportunity scoring

Accept 10–20 company websites through a multiline form or CSV. Validate rows, report invalid entries, deduplicate, enqueue valid companies, and display per-company progress. Support a single-company research flow as well. Compute an explainable score from seller fit (35%), demonstrated need (25%), timely trigger (25%), and approachability (15%). Record each component, evidence, and missing information. Show confidence separately from opportunity score; impose an evidence threshold before an item enters today's list. Version the scoring policy and store the inputs used for reproducibility. Deterministic arithmetic computes the score; AI can classify evidence but cannot silently replace the scoring rule.

### 3. Find the right person

For a selected company, identify a publicly evidenced person relevant to the configured offering, including name, role, source, why this person is appropriate, and confidence. When a reliable individual cannot be found, recommend a buyer persona and public company contact route. Clearly distinguish a known person from a suggested persona. No guessed emails or fabricated profiles.

### 4. Personalized outreach

Generate a concise first-contact email or professional-network message using the seller context, verified company facts, relevant contact, and a grounded reason to approach. Include a subject, message, evidence used, and caveats. Let the user edit, regenerate, and copy drafts. Avoid unsupported familiarity, exaggerated claims, sensitive personal inference, and generic filler. Draft generation is required; automatic sending is outside this scope.

### 5. Automation

Implement Input → Research → AI analysis → schema-validated structured output → Database. Jobs run asynchronously with durable status, bounded retries, timeout, cancellation, and actionable errors. Persist research even if AI processing fails so the user can retry. Enforce concurrency and per-domain rate limits. Job attempts must not create duplicate snapshots or action records. UI refreshes or reloads must preserve progress. Provide an authenticated API for starting research; optional webhook notifications are not essential to the PDF requirements.

### 6. Trigger detection

Retain immutable timestamped snapshots. Compare any two snapshots for the same company. Detect meaningful changes such as launches, expansion, hiring relevant to the offering, leadership changes, or funding when sourced. Separate semantic changes from formatting, navigation, copyright dates, reordered text, and unsupported observations. Present before/after evidence, significance, confidence, suggested action, and occurrence date when known. An observation time is not an event date. A first snapshot has no historical comparison and must not imply one.

### 7. Data reliability

Store source URL, publisher/domain, retrieved time, published time when available, source type, and the excerpt supporting each claim. Resolve conflicting claims using explicit criteria: direct primary evidence, relevance, freshness, and corroboration. Preserve competing claims and reasons for selecting or withholding a value. Explain uncertainty to the user instead of hiding conflicts. Distinguish absent evidence, unresolved conflict, and a supported negative finding.

### 8. Action dashboard

Provide today's recommendations, company directory, company detail with evidence and snapshots, batch/job progress, outreach editor, and settings. Use accessible responsive layouts, keyboard controls, clear loading/empty/error states, and status indicators that do not depend on color alone. Let users mark actions done, dismiss, and snooze until a chosen date. Completed, dismissed, and snoozed actions are excluded appropriately. Explain the ranking and refresh timestamp.

### 9. Only five worthwhile actions

Make the action limit a policy setting with default five, and demonstrate the requested change using a test and documented before/after behavior. Rank qualified actions by opportunity score, trigger relevance and recency, confidence, then a stable tie-breaker. Limit repeated actions for the same company. Show fewer than five when evidence does not justify more, explaining why. This is a prioritization policy, not merely hiding rows in the frontend.

## Data model

Persist users and sessions; workspace/seller configuration; companies; research jobs and attempts; sources; immutable company snapshots; evidence-linked claims and conflicting alternatives; contacts/personas; opportunity assessments and scoring-policy versions; detected triggers; actionable recommendations and their lifecycle; editable outreach drafts; and audit events. Use database constraints, foreign keys, indexed queue/status queries, UTC timestamps, and migrations. Keep records scoped to their workspace and enforce isolation in API queries.

## API and worker contracts

Provide session authentication, seller settings read/update, company create/list/detail, batch import, research enqueue/status/cancel/retry, snapshots list/compare, opportunity assessments, today's actions, action lifecycle updates, and outreach draft generation/update. Validate request bodies and responses, use stable error codes, paginate directory/history endpoints, and return 202 for asynchronous work. Implement readiness and liveness endpoints without exposing secrets.

The worker fetches safe public pages, records provenance, extracts useful text, calls the configured AI adapter, validates the output, persists a snapshot, reconciles conflicts, computes scoring, detects changes, and updates actions in controlled transactions. Failures must leave durable diagnostics without leaking API keys or unnecessary personal data.

## AI integration

Implement a provider interface with an actual external LLM adapter using a server-side API key, configurable model, timeout, bounded retries, structured-output validation, usage accounting, and redacted logs. Treat researched page text as untrusted data: it cannot change system instructions, request tools, disclose secrets, or trigger outbound actions. AI output may reference only known evidence IDs. Reject nonexistent references and unsupported claims.

Provide a deterministic demo adapter and seed dataset so the full workflow can be demonstrated without credentials. Label demo results clearly. Never silently substitute demo research for failed live research. Live AI integration must be reported as unverified until tested with real credentials.

## Research security and privacy

Accept only HTTP(S) public websites. Block loopback, private/link-local/reserved IP ranges, cloud metadata targets, unsafe ports, and redirects to prohibited targets. Revalidate DNS/redirect destinations, cap redirects/body size/time/pages, and allow only appropriate content types. Do not bypass paywalls, authentication, or access restrictions. Protect mutating APIs with authentication and CSRF/origin controls as appropriate. Use secure cookies in production, password hashing, input validation, output escaping, rate limits, server-side secrets, and authorization checks. Do not place API keys in the browser or repository.

## Testing and evidence of completion

Test score calculation, top-five policy, thresholds and stable ties, source conflict resolution, noise versus meaningful changes, SSRF controls including redirects, batch validation, worker retry/idempotency, evidence-reference validation, authentication, and workspace isolation. Integration tests must exercise persistence, migrations, and the research-to-action workflow against PostgreSQL. Browser tests must cover demo sign-in/setup, batch import, dossier evidence, snapshot comparison, outreach editing, and action completion/snoozing. Run lint/type checks, unit/integration tests, production build, and deployment smoke checks where the environment supports them.

## Deliverables

Deliver complete source code, migrations, seeded fictional demo data, dependency lockfiles, .env.example, Docker deployment configuration, this prompt, implementation plan, architecture notes, API documentation, and a README with exact local startup/test/deployment commands. Include a requirement-to-feature/test matrix for all nine PDF tasks and an honest verification report. Clearly identify external credentials or services required for live operation and any tests that could not run. Avoid claiming completion based solely on scaffolding, mocked API responses, or a successful frontend build.

## Implementation sequence

1. Establish contracts, schema, migrations, session authentication, and seller settings.
2. Build durable research jobs, safe fetching, provenance storage, and demo research.
3. Add structured AI integration, claim validation, reliability handling, and scoring.
4. Add snapshots, semantic trigger detection, contact selection, and outreach drafts.
5. Build responsive dashboard, company directory/detail, batch progress, and settings.
6. Implement action lifecycle and the server-side five-action policy.
7. Verify integration and browser workflows, package deployment configuration, and document results.

## Proposed assumptions for approval

This is a business development tool for a configurable seller rather than one fixed industry. Public research and draft outreach are sufficient; paid contact enrichment and message sending are not required. Local Docker deployment is the default target until hosting details are supplied. The application includes both a clearly labeled credential-free demo and a live research/LLM path. The chosen implementation uses React, Node.js, TypeScript, and PostgreSQL.
