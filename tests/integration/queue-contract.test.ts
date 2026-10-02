import { beforeAll, afterAll, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { pool, migrate } from "../../server/db.js";
import { enqueueResearch, claimJob } from "../../server/worker/queue.js";
const userId = randomUUID(),
  workspaceId = randomUUID();
let companyId: string;
beforeAll(async () => {
  await migrate();
  await pool.query(
    "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)",
    [userId, `queue-${userId}@example.com`, "Queue test", "unused"],
  );
  await pool.query("INSERT INTO workspaces(id,owner_id) VALUES($1,$2)", [
    workspaceId,
    userId,
  ]);
  for (let i = 0; i < 4; i++) {
    const id = randomUUID();
    if (i === 0) companyId = id;
    await pool.query(
      "INSERT INTO companies(id,workspace_id,website,name,mode) VALUES($1,$2,$3,$4,$5)",
      [
        id,
        workspaceId,
        `https://queue-${i}-${userId}.example`,
        "Queue test",
        "demo",
      ],
    );
    await enqueueResearch(workspaceId, id, "demo");
  }
});
afterAll(async () => {
  await pool.query("DELETE FROM users WHERE id=$1", [userId]);
  await pool.end();
});
it("caps globally active workers at three while keeping extra jobs queued", async () => {
  const claimed = await Promise.all(
    Array.from({ length: 4 }, (_, i) => claimJob("limit-" + i)),
  );
  expect(claimed.filter(Boolean)).toHaveLength(3);
});
it("never silently changes the research mode of an existing active job", async () => {
  await expect(
    enqueueResearch(workspaceId, companyId, "live"),
  ).rejects.toThrow();
});
