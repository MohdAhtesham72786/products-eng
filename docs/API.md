# HTTP API

All paths below are prefixed `/api`. JSON request bodies are validated; invalid input returns 400 with `{code,message,issues?}`. Resource-not-found and cross-workspace IDs return 404. Duplicate/invalid lifecycle operations return 409. Cookie authentication is required except registration/login/logout. Browser mutations must originate from the configured app origin. No CORS access is enabled.

| Method | Path                                            | Request / result                                                                        |
| ------ | ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| POST   | `/auth/register`                                | `{email,password,name?}` → 201 user and session cookie; password minimum 12 characters  |
| POST   | `/auth/login`                                   | `{email,password}` → user and session cookie                                            |
| POST   | `/auth/logout`                                  | revoke session and clear cookie                                                         |
| GET    | `/auth/me`                                      | user, demo permission, live AI availability                                             |
| GET    | `/settings`                                     | seller settings and daily action limit                                                  |
| PUT    | `/settings`                                     | full SellerSettings object → persisted settings                                         |
| GET    | `/companies?q=&page=1`                          | 20-item paginated directory, latest assessment/status, total                            |
| POST   | `/companies/import`                             | `{input,mode:"demo"                                                                     | "live"}` → 202 companies/jobs, invalid rows and duplicate count; up to 20 websites |
| GET    | `/companies/:id?page=1`                         | company, 20 immutable snapshots, related sources, recent drafts, totalSnapshots         |
| POST   | `/companies/:id/research`                       | `{mode}` → 202 durable job; returns existing active job if present                      |
| GET    | `/companies/:id/compare?before=UUID&after=UUID` | evidence-linked changes between ordered snapshots of the same company                   |
| GET    | `/jobs?page=1`                                  | 50-item paginated job list                                                              |
| GET    | `/jobs/:id`                                     | durable status, attempt history, error code, analysis token usage                       |
| POST   | `/jobs/:id/cancel`                              | cancel queued/running job                                                               |
| POST   | `/jobs/:id/retry`                               | 202 requeue failed/cancelled job, retaining sources                                     |
| GET    | `/actions/today`                                | server-ranked qualified actions, configured limit, policy, explanation and refresh time |
| GET    | `/actions/history?page=1`                       | 50-item paginated action history                                                        |
| PATCH  | `/actions/:id`                                  | `{status:"open"                                                                         | "done"                                                                             | "dismissed" | "snoozed",snoozeUntil?:ISO_UTC}`; snoozing requires a future date |
| POST   | `/companies/:id/outreach`                       | `{channel:"email"                                                                       | "network"}` → 201 contextual editable draft with evidence/caveats                  |
| PATCH  | `/drafts/:id`                                   | `{subject,message}` → saved draft                                                       |

Non-API health endpoints: `GET /health/live` → 200 process status; `GET /health/ready` → 200 migrated database available or 503.

SellerSettings: `offering`, `industries[]`, `geography[]`, `size`, `personas[]`, `disqualifiers[]`, `style` (`concise`, `warm`, `formal`), `actionLimit` (1–20, default 5).

Job states: queued → running → succeeded; failures go to queued while attempts remain, otherwise failed. Cancellation prevents snapshot/action commit; sources already captured may remain available for retry. Common errors include AI_KEY_MISSING, AI_SCHEMA_INVALID, AI_EVIDENCE_INVALID, AI_VALUE_UNSUPPORTED, AI_CONTACT_UNSUPPORTED, UNSAFE_DESTINATION, SOURCE_TIMEOUT, SOURCE_TOO_LARGE, and RESEARCH_FAILED. Live AI credentials are checked before user-started live jobs.

Example import:

```json
{
  "input": "website\natlas-freight.example\nnorthstar-retail.example",
  "mode": "demo"
}
```

The demo source websites are intentionally fictional; API results explicitly mark `demo: true`.
