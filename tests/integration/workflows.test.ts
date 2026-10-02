import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../server/app.js";
import { pool, migrate } from "../../server/db.js";
import { runOne, claimJob } from "../../server/worker/queue.js";
let a: ReturnType<typeof request.agent>, b: ReturnType<typeof request.agent>;
let companyId: string;
beforeAll(async () => {
  await migrate();
  await pool.query("TRUNCATE workspaces,users CASCADE");
  a = request.agent(createApp());
  b = request.agent(createApp());
});
afterAll(async () => {
  await pool.end();
});
describe("authenticated end-to-end PostgreSQL workflows", () => {
  it("serializes migrations and safely reruns them", async () => {
    await Promise.all([migrate(), migrate()]);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int total FROM migrations WHERE version='001'",
        )
      ).rows[0].total,
    ).toBe(1);
  });
  it("registers two isolated accounts, hashes passwords and rejects wrong credentials", async () => {
    expect(
      (
        await a.post("/api/auth/register").send({
          email: "alice@example.com",
          password: "a-secure-password-123",
          name: "Alice",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await b.post("/api/auth/register").send({
          email: "bob@example.com",
          password: "another-password-123",
          name: "Bob",
        })
      ).status,
    ).toBe(201);
    const r = await pool.query(
      "SELECT password_hash FROM users WHERE email=$1",
      ["alice@example.com"],
    );
    expect(r.rows[0].password_hash).not.toContain("a-secure-password-123");
    expect(
      (
        await request(createApp())
          .post("/api/auth/login")
          .send({ email: "alice@example.com", password: "incorrect" })
      ).status,
    ).toBe(401);
    expect(
      (
        await a
          .put("/api/settings")
          .set("Origin", "https://evil.example")
          .send({})
      ).status,
    ).toBe(403);
  });
  it("stores seller context and validates/deduplicates a batch", async () => {
    expect(
      (
        await a.put("/api/settings").send({
          offering: "Operations workflow automation",
          industries: ["logistics"],
          geography: ["India"],
          size: "10–500",
          personas: ["Operations lead"],
          disqualifiers: [],
          style: "concise",
          actionLimit: 5,
        })
      ).status,
    ).toBe(200);
    const r = await a.post("/api/companies/import").send({
      input:
        "website\natlas-freight.example\nhttps://atlas-freight.example\nfile:///etc/passwd\nnorthstar-retail.example",
      mode: "demo",
    });
    expect(r.status).toBe(202);
    expect(r.body.companies).toHaveLength(2);
    expect(r.body.errors).toHaveLength(1);
    expect(r.body.duplicates).toBe(1);
    companyId = r.body.companies[0].id;
    expect((await b.get("/api/companies/" + companyId)).status).toBe(404);
    expect(
      (
        await b
          .post("/api/companies/" + companyId + "/research")
          .send({ mode: "demo" })
      ).status,
    ).toBe(404);
  });
  it("persists the full research-to-action pipeline and prevents double claims", async () => {
    const results = await Promise.all([
      claimJob("worker-a"),
      claimJob("worker-b"),
    ]);
    expect(new Set(results.filter(Boolean).map((x) => x!.id)).size).toBe(2);
    // Let lease reclamation return claimed jobs to the real worker.
    await pool.query(
      "UPDATE jobs SET lease_until=now()-interval '1 second' WHERE status='running'",
    );
    await runOne();
    await runOne();
    const r = await a.get("/api/companies/" + companyId);
    expect(r.status).toBe(200);
    expect(r.body.snapshots).toHaveLength(1);
    expect(r.body.snapshots[0].analysis.claims.length).toBeGreaterThan(0);
    expect(r.body.snapshots[0].assessment.score).toBeGreaterThan(50);
    expect(r.body.sources[0].demo).toBe(true);
    expect(
      (await a.get("/api/actions/today")).body.actions.length,
    ).toBeGreaterThan(0);
    const ids = await pool.query(
      "SELECT job_id,count(*)::int FROM snapshots GROUP BY job_id",
    );
    expect(ids.rows.every((x) => x.count === 1)).toBe(true);
  });
  it("creates a second snapshot and evidence-linked historical comparison", async () => {
    expect(
      (
        await a
          .post("/api/companies/" + companyId + "/research")
          .send({ mode: "demo" })
      ).status,
    ).toBe(202);
    await runOne();
    const r = await a.get("/api/companies/" + companyId);
    expect(r.body.snapshots).toHaveLength(2);
    const compare = await a.get(
      `/api/companies/${companyId}/compare?before=${r.body.snapshots[1].id}&after=${r.body.snapshots[0].id}`,
    );
    expect(compare.status).toBe(200);
    expect(compare.body.triggers.length).toBeGreaterThan(0);
  });
  it("persists editable contextual outreach and excludes completed actions", async () => {
    const r = await a
      .post("/api/companies/" + companyId + "/outreach")
      .send({ channel: "email" });
    expect(r.status).toBe(201);
    expect(r.body.message).toContain("Operations workflow automation");
    expect(r.body.sourceIds.length).toBeGreaterThan(0);
    expect(
      (
        await a
          .patch("/api/drafts/" + r.body.id)
          .send({ subject: "Edited subject", message: "My reviewed message" })
      ).body.message,
    ).toBe("My reviewed message");
    expect(
      (
        await b
          .patch("/api/drafts/" + r.body.id)
          .send({ subject: "No", message: "No" })
      ).status,
    ).toBe(404);
    const today = await a.get("/api/actions/today");
    const id = today.body.actions[0].id;
    expect(
      (await a.patch("/api/actions/" + id).send({ status: "done" })).status,
    ).toBe(200);
    expect(
      (await a.get("/api/actions/today")).body.actions.some(
        (x: any) => x.id === id,
      ),
    ).toBe(false);
  });
  it("cancels jobs, enforces session expiry and logs out", async () => {
    const r = await a
      .post("/api/companies/" + companyId + "/research")
      .send({ mode: "demo" });
    expect(
      (await a.post("/api/jobs/" + r.body.id + "/cancel")).body.status,
    ).toBe("cancelled");
    expect((await b.post("/api/jobs/" + r.body.id + "/retry")).status).toBe(
      404,
    );
    expect((await a.post("/api/auth/logout")).status).toBe(200);
    expect((await a.get("/api/companies")).status).toBe(401);
    await pool.query(
      "UPDATE sessions SET expires_at=now()-interval '1 second'",
    );
    expect((await b.get("/api/companies")).status).toBe(401);
  });
  it("retains research on AI failure and retries without duplicating snapshots", async () => {
    const agent = request.agent(createApp());
    await agent.post("/api/auth/register").send({
      email: "retry@example.com",
      password: "retry-secure-password-123",
    });
    const imported = await agent
      .post("/api/companies/import")
      .send({ input: "retry-company.example", mode: "demo" });
    const jobId = imported.body.companies[0].jobId;
    await pool.query(
      "UPDATE jobs SET mode='live',sources=$1,max_attempts=1 WHERE id=$2",
      [
        JSON.stringify([
          {
            id: "f30cd72e-aacc-4c90-ab19-d57232a87f10",
            url: "https://retry-company.example",
            publisher: "retry-company.example",
            retrievedAt: "2026-10-02T00:00:00Z",
            publishedAt: null,
            type: "primary",
            text: "Retained public research",
            demo: false,
          },
        ]),
        jobId,
      ],
    );
    await runOne();
    const failed = await agent.get("/api/jobs/" + jobId);
    expect(failed.body.status).toBe("failed");
    expect(failed.body.error_code).toBe("AI_KEY_MISSING");
    const kept = await pool.query("SELECT sources FROM jobs WHERE id=$1", [
      jobId,
    ]);
    expect(kept.rows[0].sources[0].text).toBe("Retained public research");
    await pool.query("UPDATE jobs SET mode='demo',sources=NULL WHERE id=$1", [
      jobId,
    ]);
    expect((await agent.post("/api/jobs/" + jobId + "/retry")).status).toBe(
      202,
    );
    await runOne();
    expect((await agent.get("/api/jobs/" + jobId)).body.status).toBe(
      "succeeded",
    );
    expect(
      (
        await pool.query(
          "SELECT count(*)::int total FROM snapshots WHERE job_id=$1",
          [jobId],
        )
      ).rows[0].total,
    ).toBe(1);
  });
  it("does not recommend assessments made for a different seller context", async () => {
    const agent = request.agent(createApp());
    await agent
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: "a-secure-password-123" });
    const settings = (await agent.get("/api/settings")).body;
    expect(
      (await agent.get("/api/actions/today")).body.actions.length,
    ).toBeGreaterThan(0);
    await agent
      .put("/api/settings")
      .send({ ...settings, offering: "Office furniture" });
    expect((await agent.get("/api/actions/today")).body.actions).toHaveLength(
      0,
    );
  });
});
