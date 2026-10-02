import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool, withTransaction } from "../db.js";
import { sellerSchema, uuid, type Action } from "../../shared/contracts.js";
import { rankActions, sellerContextKey } from "../../shared/scoring.js";
import { notFound, ApiError } from "../errors.js";
export const actionsRouter = Router();
actionsRouter.get("/today", async (req, res) => {
  const settings = sellerSchema.parse(
    (
      await pool.query("SELECT settings FROM workspaces WHERE id=$1", [
        req.identity.workspaceId,
      ])
    ).rows[0].settings,
  );
  const r = await pool.query(
    `SELECT a.*,c.name,c.website,s.assessment,s.analysis,s.demo,s.triggers,s.created_at AS observed_at FROM actions a JOIN companies c ON c.id=a.company_id JOIN snapshots s ON s.id=a.snapshot_id WHERE a.workspace_id=$1 AND a.status IN ('open','snoozed') AND s.id=(SELECT id FROM snapshots WHERE company_id=a.company_id ORDER BY created_at DESC LIMIT 1)`,
    [req.identity.workspaceId],
  );
  const rows = r.rows.map((x) => ({
    ...x,
    companyId: x.company_id,
    snoozeUntil: x.snooze_until ? new Date(x.snooze_until).toISOString() : null,
    score: x.assessment.score,
    confidence: x.assessment.confidence,
    qualified:
      !!settings.offering.trim() &&
      x.assessment.qualified &&
      !!x.assessment.sellerContext &&
      sellerContextKey(x.assessment.sellerContext) ===
        sellerContextKey(settings),
    triggerRelevance: x.triggers.length,
    observedAt: new Date(x.observed_at).toISOString(),
  })) as Action[];
  const now = new Date();
  const actions = rankActions(rows, settings.actionLimit, now);
  res.json({
    actions,
    limit: settings.actionLimit,
    evaluated: rows.length,
    refreshedAt: now.toISOString(),
    explanation: !settings.offering.trim()
      ? "Configure your offering to enable prioritization."
      : actions.length < settings.actionLimit
        ? "Only these actions meet the evidence, seller-context, score and lifecycle requirements; the list is not padded. Re-research companies after changing seller context."
        : "Ranked by score, meaningful changes, research recency and confidence.",
    policy: {
      version: "v1",
      weights: { fit: 35, need: 25, timing: 25, approachability: 15 },
      minimumScore: 55,
      minimumConfidence: 65,
    },
  });
});
actionsRouter.patch("/:id", async (req, res) => {
  const input = z
    .object({
      status: z.enum(["open", "done", "dismissed", "snoozed"]),
      snoozeUntil: z.string().datetime().optional(),
    })
    .parse(req.body);
  if (
    input.status === "snoozed" &&
    (!input.snoozeUntil || Date.parse(input.snoozeUntil) <= Date.now())
  )
    throw new ApiError(400, "INVALID_SNOOZE", "Choose a future snooze date.");
  const row = await withTransaction(async (c) => {
    const r = await c.query(
      "UPDATE actions SET status=$1,snooze_until=$2,updated_at=now() WHERE id=$3 AND workspace_id=$4 RETURNING *",
      [
        input.status,
        input.status === "snoozed" ? input.snoozeUntil : null,
        uuid.parse(req.params.id),
        req.identity.workspaceId,
      ],
    );
    if (!r.rowCount) throw notFound();
    await c.query(
      "INSERT INTO audit_events(id,workspace_id,actor_id,kind,resource_id) VALUES($1,$2,$3,$4,$5)",
      [
        randomUUID(),
        req.identity.workspaceId,
        req.identity.userId,
        "action." + input.status,
        req.params.id,
      ],
    );
    return r.rows[0];
  });
  res.json(row);
});
actionsRouter.get("/history", async (req, res) => {
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .parse(req.query.page || 1);
  const r = await pool.query(
    "SELECT a.*,c.name FROM actions a JOIN companies c ON c.id=a.company_id WHERE a.workspace_id=$1 ORDER BY a.updated_at DESC LIMIT 50 OFFSET $2",
    [req.identity.workspaceId, (page - 1) * 50],
  );
  res.json({ actions: r.rows, page });
});
