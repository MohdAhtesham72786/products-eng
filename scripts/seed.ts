import { randomUUID } from "node:crypto";
import { pool, withTransaction } from "../server/db.js";
import { hashPassword } from "../server/auth.js";
import { enqueueResearch, runOne } from "../server/worker/queue.js";
import { demoDomains } from "../server/research/demo.js";
import { config } from "../server/config.js";
if (!config.allowDemo) throw new Error("Demo mode is disabled.");
const email = process.env.SEED_EMAIL || "demo@signaldesk.local";
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 12)
  throw new Error(
    "Set SEED_PASSWORD to at least 12 characters. No default account password is created.",
  );
try {
  let workspaceId: string;
  const existing = await pool.query(
    "SELECT w.id FROM workspaces w JOIN users u ON u.id=w.owner_id WHERE u.email=$1",
    [email],
  );
  if (existing.rowCount) workspaceId = existing.rows[0].id;
  else {
    const userId = randomUUID();
    workspaceId = randomUUID();
    const passwordHash = await hashPassword(password);
    await withTransaction(async (c) => {
      await c.query(
        "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)",
        [userId, email, "Demo workspace", passwordHash],
      );
      await c.query(
        "INSERT INTO workspaces(id,owner_id,settings) VALUES($1,$2,$3)",
        [
          workspaceId,
          userId,
          {
            offering: "Operations workflow automation",
            industries: ["logistics", "software"],
            geography: ["India"],
            size: "10–500 employees",
            personas: ["Operations lead", "COO"],
            disqualifiers: [],
            style: "concise",
            actionLimit: 5,
          },
        ],
      );
    });
  }
  for (const domain of demoDomains) {
    const id = (
      await pool.query(
        "INSERT INTO companies(id,workspace_id,website,name,mode) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,website) DO UPDATE SET website=EXCLUDED.website RETURNING id",
        [randomUUID(), workspaceId, "https://" + domain, domain, "demo"],
      )
    ).rows[0].id;
    await enqueueResearch(workspaceId, id, "demo");
  }
  while (await runOne()) {
    /* Drain available demo jobs. */
  }
  console.log(`Fictional demo seeded for ${email}. Password is not logged.`);
} finally {
  await pool.end();
}
