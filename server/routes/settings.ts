import { Router } from "express";
import { randomUUID } from "node:crypto";
import { pool, withTransaction } from "../db.js";
import { sellerSchema } from "../../shared/contracts.js";
export const settingsRouter = Router();
settingsRouter.get("/", async (req, res) => {
  const r = await pool.query("SELECT settings FROM workspaces WHERE id=$1", [
    req.identity.workspaceId,
  ]);
  res.json(sellerSchema.parse(r.rows[0].settings));
});
settingsRouter.put("/", async (req, res) => {
  const settings = sellerSchema.parse(req.body);
  await withTransaction(async (c) => {
    await c.query("UPDATE workspaces SET settings=$1 WHERE id=$2", [
      settings,
      req.identity.workspaceId,
    ]);
    await c.query(
      "INSERT INTO audit_events(id,workspace_id,actor_id,kind) VALUES($1,$2,$3,$4)",
      [
        randomUUID(),
        req.identity.workspaceId,
        req.identity.userId,
        "settings.updated",
      ],
    );
  });
  res.json(settings);
});
