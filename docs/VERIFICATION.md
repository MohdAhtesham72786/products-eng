# Verification report

Verified on 2 October 2026 with Node.js 24.13.1, real PostgreSQL 17.6, and Chromium through Playwright on Windows x64.

| Check                                         | Result                                                               |
| --------------------------------------------- | -------------------------------------------------------------------- |
| ESLint                                        | Passed                                                               |
| TypeScript strict type-check                  | Passed                                                               |
| Prettier formatting                           | Passed                                                               |
| Unit tests                                    | 39 passed                                                            |
| PostgreSQL integration tests                  | 13 passed                                                            |
| Browser workflows                             | 2 passed: full desktop workflow and mobile sign-in error state       |
| React production build and server compilation | Passed                                                               |
| Migration rerun / concurrent migration        | Passed                                                               |
| Local PostgreSQL helper                       | Started a real local server; persistent database reconnect exercised |
| npm dependency audit                          | Zero reported vulnerabilities, including development dependencies    |

The desktop browser test exercises account creation, twelve-company demo import, the five-action shortlist, dossier facts/evidence, editable persisted outreach, a second snapshot and expansion comparison, action completion, invalid import rows, and changing the daily limit to three.
It also switches the authenticated workspace to a mobile viewport, checks directory navigation/overflow, and signs out.

PostgreSQL tests exercise session/password handling, origin protection, workspace isolation, batch validation, row-lock job claiming, expired lease recovery, source/snapshot/action persistence, retry/source retention, cancellation, stale seller context, migration idempotency, global concurrency limits, and active-job mode conflicts. Unit tests cover weighted scoring, confidence/thresholds, stable ranking, snooze expiry, conflicts/freshness, change/noise detection, SSRF/DNS/redirect/body-size boundaries, AI structured-output retry/usage validation, factual grounding, contact-role evidence, seller disqualifiers, and outreach tone.

## Checks requiring another environment or credentials

- **Live Gemini invocation:** not executed; no real provider API key was supplied. The real REST adapter is implemented and boundary-tested with controlled external responses. No demo fallback is used for live failures.
- **Docker image/Compose startup:** not executed; Docker is not installed in this execution environment. Files are included, but a successful local Node/PostgreSQL run is not evidence that a container build passed.
- **Live hosting:** not deployed; no target hosting account or domain was supplied. Deployment configuration and operational instructions are included.
- **Production load/soak and hosting-specific recovery:** not performed. The passing functional/security tests do not substitute for deployment acceptance, performance testing, monitoring, or backup-restore drills.

Accordingly this deliverable is a working, tested project with production deployment configuration; an unconditional claim of production readiness for a particular live environment would require the checks above.

## Independent review

A separate read-only reviewer checked the complete source against the approved specification. Four Important findings were corrected with regression tests: retained research and provenance now commit atomically (and recover missing source rows), zero seller fit cannot qualify, action identity derives from normalized source evidence instead of generated prose, and conflict resolution compares every distinct value rather than only the first two claims. Unit and real PostgreSQL regression suites were rerun after the fixes.

Live public-page fetching was also exercised against a real HTTPS page and produced extracted evidence with demo=false. The browser regression verifies that a user's chosen historical snapshot is preserved across polling.
