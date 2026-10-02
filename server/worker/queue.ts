import { randomUUID } from "node:crypto";
import { pool, withTransaction } from "../db.js";
import { processJob } from "./pipeline.js";
import { ApiError } from "../errors.js";
export async function enqueueResearch(
  workspaceId: string,
  companyId: string,
  mode: "demo" | "live",
) {
  return withTransaction(async (c) => {
    const result = await c.query(
      `INSERT INTO jobs(id,workspace_id,company_id,mode) VALUES($1,$2,$3,$4) ON CONFLICT(company_id) WHERE status IN ('queued','running') DO UPDATE SET company_id=EXCLUDED.company_id RETURNING *`,
      [randomUUID(), workspaceId, companyId, mode],
    );
    if (result.rows[0].mode !== mode)
      throw new ApiError(
        409,
        "RESEARCH_MODE_CONFLICT",
        "Cancel or finish the active job before changing research mode.",
      );
    await c.query(
      "UPDATE companies SET mode=$1 WHERE id=$2 AND workspace_id=$3",
      [mode, companyId, workspaceId],
    );
    return result.rows[0];
  });
}
export async function claimJob(workerId: string) {
  return withTransaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(870022)");
    await c.query(
      "UPDATE jobs SET status='failed',error_code='RETRY_EXHAUSTED',updated_at=now() WHERE status='running' AND lease_until<now() AND attempts>=max_attempts",
    );
    const active = await c.query(
      "SELECT count(*)::int AS count FROM jobs WHERE status='running' AND lease_until>now()",
    );
    if (active.rows[0].count >= 3) return null;
    const r =
      await c.query(`SELECT j.*,co.website FROM jobs j JOIN companies co ON co.id=j.company_id WHERE
 ((j.status='queued' AND j.available_at<=now()) OR (j.status='running' AND j.lease_until<now())) AND j.attempts<j.max_attempts
 ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1`);
    if (!r.rowCount) return null;
    const job = r.rows[0];
    if (job.mode === "live" && !job.sources) {
      const domain = new URL(job.website).hostname;
      await c.query(
        "INSERT INTO domain_limits(domain,next_allowed_at) VALUES($1,now()) ON CONFLICT DO NOTHING",
        [domain],
      );
      const d = await c.query(
        "SELECT * FROM domain_limits WHERE domain=$1 FOR UPDATE",
        [domain],
      );
      if (new Date(d.rows[0].next_allowed_at).getTime() > Date.now()) {
        await c.query("UPDATE jobs SET available_at=$1 WHERE id=$2", [
          d.rows[0].next_allowed_at,
          job.id,
        ]);
        return null;
      }
      await c.query(
        "UPDATE domain_limits SET next_allowed_at=now()+interval '60 seconds' WHERE domain=$1",
        [domain],
      );
    }
    await c.query(
      "UPDATE job_attempts SET status='lease_expired',finished_at=now() WHERE job_id=$1 AND status='running'",
      [job.id],
    );
    const updated = (
      await c.query(
        "UPDATE jobs SET status='running',worker_id=$1,lease_until=now()+interval '90 seconds',attempts=attempts+1,updated_at=now() WHERE id=$2 RETURNING *",
        [workerId, job.id],
      )
    ).rows[0];
    await c.query(
      "INSERT INTO job_attempts(id,job_id,attempt,status) VALUES($1,$2,$3,'running')",
      [randomUUID(), job.id, updated.attempts],
    );
    return updated;
  });
}
export async function runOne(workerId = randomUUID()) {
  const job = await claimJob(workerId);
  if (!job) return false;
  const heartbeat = setInterval(() => {
    pool
      .query(
        "UPDATE jobs SET lease_until=now()+interval '90 seconds' WHERE id=$1 AND status='running' AND worker_id=$2",
        [job.id, workerId],
      )
      .catch(() => {});
  }, 15000);
  try {
    await processJob(job);
  } catch (e) {
    const code =
      e instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(e.message)
        ? e.message
        : "RESEARCH_FAILED";
    await withTransaction(async (c) => {
      await c.query(
        "UPDATE jobs SET status=CASE WHEN attempts<max_attempts THEN 'queued' ELSE 'failed' END,error_code=$1,lease_until=NULL,available_at=now()+interval '10 seconds',updated_at=now() WHERE id=$2 AND status='running' AND worker_id=$3",
        [code, job.id, workerId],
      );
      await c.query(
        "UPDATE job_attempts SET status='failed',error_code=$1,finished_at=now() WHERE job_id=$2 AND attempt=$3 AND status='running'",
        [code, job.id, job.attempts],
      );
    });
  } finally {
    clearInterval(heartbeat);
  }
  return true;
}
