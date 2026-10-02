CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL,
 password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workspaces (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 settings jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS companies (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 website text NOT NULL, name text NOT NULL, mode text NOT NULL CHECK(mode IN ('demo','live')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,website)
);
CREATE TABLE IF NOT EXISTS jobs (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 mode text NOT NULL CHECK(mode IN ('demo','live')), status text NOT NULL DEFAULT 'queued'
 CHECK(status IN ('queued','running','succeeded','failed','cancelled')),
 attempts int NOT NULL DEFAULT 0 CHECK(attempts>=0), max_attempts int NOT NULL DEFAULT 3,
 worker_id text, lease_until timestamptz, available_at timestamptz NOT NULL DEFAULT now(),
 error_code text, sources jsonb, usage jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_claim ON jobs(status,available_at,lease_until);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_one_active ON jobs(company_id) WHERE status IN ('queued','running');
CREATE TABLE IF NOT EXISTS job_attempts (
 id uuid PRIMARY KEY, job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 attempt int NOT NULL, status text NOT NULL, error_code text,
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, UNIQUE(job_id,attempt)
);
CREATE TABLE IF NOT EXISTS domain_limits (domain text PRIMARY KEY, next_allowed_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS sources (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS snapshots (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 job_id uuid NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
 analysis jsonb NOT NULL, assessment jsonb NOT NULL, resolutions jsonb NOT NULL, triggers jsonb NOT NULL,
 demo boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS snapshots_company ON snapshots(company_id,created_at DESC);
CREATE TABLE IF NOT EXISTS claims (
 id uuid PRIMARY KEY, snapshot_id uuid NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS contacts (
 id uuid PRIMARY KEY, snapshot_id uuid NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS triggers (
 id uuid PRIMARY KEY, snapshot_id uuid NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS scoring_policies (version text PRIMARY KEY, weights jsonb NOT NULL);
INSERT INTO scoring_policies(version,weights) VALUES ('v1','{"fit":0.35,"need":0.25,"timing":0.25,"approachability":0.15}') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS actions (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 snapshot_id uuid NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
 fingerprint text NOT NULL, title text NOT NULL, reason text NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','done','dismissed','snoozed')),
 snooze_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,fingerprint)
);
CREATE INDEX IF NOT EXISTS actions_workspace ON actions(workspace_id,status,snooze_until);
CREATE TABLE IF NOT EXISTS drafts (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 snapshot_id uuid NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
 channel text NOT NULL CHECK(channel IN ('email','network')), subject text NOT NULL, message text NOT NULL,
 source_ids jsonb NOT NULL, caveats jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_events (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 actor_id uuid REFERENCES users(id) ON DELETE SET NULL, kind text NOT NULL, resource_id uuid,
 created_at timestamptz NOT NULL DEFAULT now()
);
