import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool } from "../db.js";
import { sellerSchema, uuid } from "../../shared/contracts.js";
import { ownedCompany } from "./companies.js";
import { generateDraft } from "../research/providers.js";
import { notFound, ApiError } from "../errors.js";
export const outreachRouter = Router();
outreachRouter.post("/companies/:id/outreach", async (req, res) => {
  const company = await ownedCompany(req.params.id, req.identity.workspaceId);
  const { channel } = z
    .object({ channel: z.enum(["email", "network"]) })
    .parse(req.body);
  const snapshot = (
    await pool.query(
      "SELECT * FROM snapshots WHERE company_id=$1 ORDER BY created_at DESC LIMIT 1",
      [company.id],
    )
  ).rows[0];
  if (!snapshot)
    throw new ApiError(
      409,
      "RESEARCH_REQUIRED",
      "Research this company before generating outreach.",
    );
  const seller = sellerSchema.parse(
    (
      await pool.query("SELECT settings FROM workspaces WHERE id=$1", [
        req.identity.workspaceId,
      ])
    ).rows[0].settings,
  );
  if (!seller.offering.trim())
    throw new ApiError(
      409,
      "SELLER_REQUIRED",
      "Configure your offering first.",
    );
  const sources = (
    await pool.query("SELECT data FROM sources WHERE job_id=$1", [
      snapshot.job_id,
    ])
  ).rows.map((x) => x.data);
  let draft;
  try {
    draft = await generateDraft(
      snapshot.analysis,
      sources,
      seller,
      channel,
      snapshot.demo,
    );
  } catch (e) {
    throw new ApiError(
      502,
      "DRAFT_GENERATION_FAILED",
      e instanceof Error && e.message === "AI_KEY_MISSING"
        ? "Configure the server AI key."
        : "AI draft generation failed validation or could not complete. Please retry.",
    );
  }
  const id = randomUUID();
  await pool.query(
    "INSERT INTO drafts(id,workspace_id,company_id,snapshot_id,channel,subject,message,source_ids,caveats) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [
      id,
      req.identity.workspaceId,
      company.id,
      snapshot.id,
      channel,
      draft.subject,
      draft.message,
      JSON.stringify(draft.sourceIds),
      JSON.stringify(draft.caveats),
    ],
  );
  res.status(201).json({ id, channel, ...draft });
});
outreachRouter.patch("/drafts/:id", async (req, res) => {
  const { subject, message } = z
    .object({
      subject: z.string().max(200),
      message: z.string().min(1).max(10000),
    })
    .parse(req.body);
  const r = await pool.query(
    "UPDATE drafts SET subject=$1,message=$2,updated_at=now() WHERE id=$3 AND workspace_id=$4 RETURNING *",
    [subject, message, uuid.parse(req.params.id), req.identity.workspaceId],
  );
  if (!r.rowCount) throw notFound();
  res.json({ ...r.rows[0], sourceIds: r.rows[0].source_ids });
});
