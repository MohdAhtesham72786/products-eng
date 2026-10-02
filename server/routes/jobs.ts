import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { uuid } from "../../shared/contracts.js";
import { notFound, ApiError } from "../errors.js";
export const jobsRouter = Router();
jobsRouter.get("/", async (req, res) => {
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .parse(req.query.page || 1);
  const rows = await pool.query(
    "SELECT j.id,j.company_id,j.mode,j.status,j.attempts,j.max_attempts,j.error_code,j.created_at,j.updated_at,c.name FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.workspace_id=$1 ORDER BY j.created_at DESC LIMIT 50 OFFSET $2",
    [req.identity.workspaceId, (page - 1) * 50],
  );
  res.json({ jobs: rows.rows, page });
});
jobsRouter.get("/:id", async (req, res) => {
  const r = await pool.query(
    "SELECT id,company_id,mode,status,attempts,max_attempts,error_code,usage,created_at,updated_at FROM jobs WHERE id=$1 AND workspace_id=$2",
    [uuid.parse(req.params.id), req.identity.workspaceId],
  );
  if (!r.rowCount) throw notFound();
  const attempts = await pool.query(
    "SELECT attempt,status,error_code,started_at,finished_at FROM job_attempts WHERE job_id=$1 ORDER BY attempt",
    [r.rows[0].id],
  );
  res.json({ ...r.rows[0], attemptHistory: attempts.rows });
});
jobsRouter.post("/:id/cancel", async (req, res) => {
  const r = await pool.query(
    "UPDATE jobs SET status='cancelled',lease_until=NULL,updated_at=now() WHERE id=$1 AND workspace_id=$2 AND status IN ('queued','running') RETURNING id,status",
    [uuid.parse(req.params.id), req.identity.workspaceId],
  );
  if (!r.rowCount) {
    const owned = await pool.query(
      "SELECT 1 FROM jobs WHERE id=$1 AND workspace_id=$2",
      [req.params.id, req.identity.workspaceId],
    );
    if (!owned.rowCount) throw notFound();
    throw new ApiError(
      409,
      "JOB_NOT_ACTIVE",
      "Only active research can be cancelled.",
    );
  }
  await pool.query(
    "UPDATE job_attempts SET status='cancelled',finished_at=now() WHERE job_id=$1 AND status='running'",
    [r.rows[0].id],
  );
  res.json(r.rows[0]);
});
jobsRouter.post("/:id/retry", async (req, res) => {
  const owned = await pool.query(
    "SELECT * FROM jobs WHERE id=$1 AND workspace_id=$2",
    [uuid.parse(req.params.id), req.identity.workspaceId],
  );
  if (!owned.rowCount) throw notFound();
  if (!["failed", "cancelled"].includes(owned.rows[0].status))
    throw new ApiError(
      409,
      "JOB_NOT_RETRYABLE",
      "Retry a failed or cancelled job.",
    );
  const r = await pool.query(
    "UPDATE jobs SET status='queued',max_attempts=attempts+3,available_at=now(),worker_id=NULL,lease_until=NULL,error_code=NULL,updated_at=now() WHERE id=$1 RETURNING id,status",
    [req.params.id],
  );
  res.status(202).json(r.rows[0]);
});
