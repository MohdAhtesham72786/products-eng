import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool, rowSnapshot } from "../db.js";
import { modeSchema, uuid } from "../../shared/contracts.js";
import { compareSnapshots } from "../../shared/triggers.js";
import { parseBatch } from "../research/safe-fetch.js";
import { enqueueResearch } from "../worker/queue.js";
import { ApiError, notFound } from "../errors.js";
import { config } from "../config.js";
export function checkMode(mode: "demo" | "live") {
  if (mode === "demo" && !config.allowDemo)
    throw new ApiError(403, "DEMO_DISABLED", "Demo mode is disabled.");
  if (mode === "live" && !config.GEMINI_API_KEY)
    throw new ApiError(
      503,
      "AI_KEY_MISSING",
      "Live research requires the server GEMINI_API_KEY.",
    );
}
export async function ownedCompany(id: unknown, workspaceId: string) {
  const result = await pool.query(
    "SELECT * FROM companies WHERE id=$1 AND workspace_id=$2",
    [uuid.parse(id), workspaceId],
  );
  if (!result.rowCount) throw notFound();
  return result.rows[0];
}
export const companiesRouter = Router();
companiesRouter.get("/", async (req, res) => {
  const q = z
    .string()
    .max(200)
    .parse(req.query.q || "");
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .parse(req.query.page || 1);
  const limit = 20;
  const result = await pool.query(
    `SELECT c.*,s.assessment,s.demo,s.created_at AS researched_at,j.status AS job_status FROM companies c
 LEFT JOIN LATERAL(SELECT assessment,demo,created_at FROM snapshots WHERE company_id=c.id ORDER BY created_at DESC LIMIT 1)s ON true
 LEFT JOIN LATERAL(SELECT status FROM jobs WHERE company_id=c.id ORDER BY created_at DESC LIMIT 1)j ON true
 WHERE c.workspace_id=$1 AND (c.name ILIKE $2 OR c.website ILIKE $2) ORDER BY c.created_at DESC LIMIT $3 OFFSET $4`,
    [req.identity.workspaceId, "%" + q + "%", limit, (page - 1) * limit],
  );
  const count = await pool.query(
    "SELECT count(*)::int AS total FROM companies WHERE workspace_id=$1 AND (name ILIKE $2 OR website ILIKE $2)",
    [req.identity.workspaceId, "%" + q + "%"],
  );
  res.json({
    companies: result.rows,
    total: count.rows[0].total,
    page,
    pageSize: limit,
  });
});
companiesRouter.post("/import", async (req, res) => {
  const { input, mode } = z
    .object({ input: z.string().min(1).max(10000), mode: modeSchema })
    .parse(req.body);
  checkMode(mode);
  let batch;
  try {
    batch = parseBatch(input);
  } catch {
    throw new ApiError(
      400,
      "BATCH_TOO_LARGE",
      "Import up to 20 company websites at a time.",
    );
  }
  const companies = [];
  for (const website of batch.urls) {
    const company = (
      await pool.query(
        "INSERT INTO companies(id,workspace_id,website,name,mode) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,website) DO UPDATE SET website=EXCLUDED.website RETURNING *",
        [
          randomUUID(),
          req.identity.workspaceId,
          website,
          new URL(website).hostname,
          mode,
        ],
      )
    ).rows[0];
    const job = await enqueueResearch(
      req.identity.workspaceId,
      company.id,
      mode,
    );
    companies.push({ ...company, jobId: job.id });
  }
  res
    .status(202)
    .json({ companies, errors: batch.errors, duplicates: batch.duplicates });
});
companiesRouter.get("/:id", async (req, res) => {
  const c = await ownedCompany(req.params.id, req.identity.workspaceId);
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .parse(req.query.page || 1);
  const snaps = await pool.query(
    "SELECT * FROM snapshots WHERE company_id=$1 AND workspace_id=$2 ORDER BY created_at DESC LIMIT 20 OFFSET $3",
    [c.id, req.identity.workspaceId, (page - 1) * 20],
  );
  const sources = await pool.query(
    "SELECT data FROM sources WHERE company_id=$1 AND workspace_id=$2 AND job_id IN (SELECT job_id FROM snapshots WHERE company_id=$1 ORDER BY created_at DESC LIMIT 20 OFFSET $3)",
    [c.id, req.identity.workspaceId, (page - 1) * 20],
  );
  const drafts = await pool.query(
    "SELECT * FROM drafts WHERE company_id=$1 AND workspace_id=$2 ORDER BY created_at DESC LIMIT 20",
    [c.id, req.identity.workspaceId],
  );
  const count = await pool.query(
    "SELECT count(*)::int total FROM snapshots WHERE company_id=$1",
    [c.id],
  );
  res.json({
    company: c,
    snapshots: snaps.rows.map(rowSnapshot),
    sources: sources.rows.map((x) => x.data),
    drafts: drafts.rows.map((d) => ({ ...d, sourceIds: d.source_ids })),
    page,
    totalSnapshots: count.rows[0].total,
  });
});
companiesRouter.get("/:id/compare", async (req, res) => {
  const c = await ownedCompany(req.params.id, req.identity.workspaceId);
  const { before, after } = z
    .object({ before: uuid, after: uuid })
    .parse(req.query);
  if (before === after)
    throw new ApiError(
      400,
      "INVALID_COMPARISON",
      "Choose two different snapshots.",
    );
  const snapshots = await pool.query(
    "SELECT * FROM snapshots WHERE company_id=$1 AND workspace_id=$2 AND id IN ($3,$4)",
    [c.id, req.identity.workspaceId, before, after],
  );
  if (snapshots.rowCount !== 2) throw notFound();
  const b = rowSnapshot(snapshots.rows.find((s) => s.id === before)),
    a = rowSnapshot(snapshots.rows.find((s) => s.id === after));
  if (Date.parse(b.createdAt) > Date.parse(a.createdAt))
    throw new ApiError(
      400,
      "INVALID_COMPARISON",
      "Before must be older than after.",
    );
  res.json({
    before: b,
    after: a,
    triggers: compareSnapshots(b, a),
    note: "Formatting and unchanged developments are ignored. Event dates remain unknown unless sourced.",
  });
});
companiesRouter.post("/:id/research", async (req, res) => {
  const company = await ownedCompany(req.params.id, req.identity.workspaceId);
  const { mode } = z.object({ mode: modeSchema }).parse(req.body);
  checkMode(mode);
  res
    .status(202)
    .json(await enqueueResearch(req.identity.workspaceId, company.id, mode));
});
