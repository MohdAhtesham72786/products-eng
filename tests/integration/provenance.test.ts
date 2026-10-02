import { beforeAll, afterAll, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { pool, migrate } from "../../server/db.js";
import { enqueueResearch, runOne } from "../../server/worker/queue.js";
import { demoResearch } from "../../server/research/demo.js";
const uid = randomUUID(),
  wid = randomUUID(),
  cid = randomUUID();
let jobId: string;
beforeAll(async () => {
  await migrate();
  await pool.query(
    "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)",
    [uid, `provenance-${uid}@example.com`, "Provenance test", "unused"],
  );
  await pool.query(
    "INSERT INTO workspaces(id,owner_id,settings) VALUES($1,$2,$3)",
    [wid, uid, { offering: "Operations automation" }],
  );
  await pool.query(
    "INSERT INTO companies(id,workspace_id,website,name,mode) VALUES($1,$2,$3,$4,$5)",
    [cid, wid, "https://provenance.example", "Provenance", "demo"],
  );
  jobId = (await enqueueResearch(wid, cid, "demo")).id;
});
afterAll(async () => {
  await pool.query("DELETE FROM users WHERE id=$1", [uid]);
  await pool.end();
});
it("materializes retained evidence rows before committing a recovered snapshot", async () => {
  const retained = demoResearch("https://provenance.example", 0);
  await pool.query("UPDATE jobs SET sources=$1 WHERE id=$2", [
    JSON.stringify(retained),
    jobId,
  ]);
  await runOne();
  expect(
    (await pool.query("SELECT status FROM jobs WHERE id=$1", [jobId])).rows[0]
      .status,
  ).toBe("succeeded");
  expect(
    (
      await pool.query(
        "SELECT count(*)::int total FROM sources WHERE job_id=$1",
        [jobId],
      )
    ).rows[0].total,
  ).toBe(2);
});
it("preserves completed action lifecycle on identical researched evidence", async () => {
  await pool.query("UPDATE actions SET status='done' WHERE company_id=$1", [
    cid,
  ]);
  await enqueueResearch(wid, cid, "demo");
  await runOne(); // Revision changes after the first snapshot; complete that new evidenced action too.
  await pool.query("UPDATE actions SET status='done' WHERE company_id=$1", [
    cid,
  ]);
  await enqueueResearch(wid, cid, "demo");
  await runOne();
  const rows = await pool.query(
    "SELECT status FROM actions WHERE company_id=$1",
    [cid],
  );
  expect(rows.rows.every((a) => a.status === "done")).toBe(true);
});
