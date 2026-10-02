import { randomUUID } from "node:crypto";
import { pool, withTransaction, rowSnapshot } from "../db.js";
import { sellerSchema } from "../../shared/contracts.js";
import { scoreOpportunity } from "../../shared/scoring.js";
import { resolveClaims } from "../../shared/reliability.js";
import { compareSnapshots } from "../../shared/triggers.js";
import { researchWebsite } from "../research/safe-fetch.js";
import { demoResearch } from "../research/demo.js";
import { analyzeCompany } from "../research/providers.js";
import { actionFingerprint } from "./fingerprint.js";
export async function processJob(job: any) {
  const company = (
    await pool.query(
      "SELECT * FROM companies WHERE id=$1 AND workspace_id=$2",
      [job.company_id, job.workspace_id],
    )
  ).rows[0];
  if (!company) throw new Error("COMPANY_NOT_FOUND");
  const seller = sellerSchema.parse(
    (
      await pool.query("SELECT settings FROM workspaces WHERE id=$1", [
        job.workspace_id,
      ])
    ).rows[0].settings,
  );
  const previous = (
    await pool.query(
      "SELECT * FROM snapshots WHERE company_id=$1 ORDER BY created_at DESC LIMIT 1",
      [company.id],
    )
  ).rows[0];
  let sources = job.sources;
  if (!sources) {
    sources =
      job.mode === "demo"
        ? demoResearch(company.website, previous ? 1 : 0)
        : await researchWebsite(company.website);
  }
  await withTransaction(async (c) => {
    const retained = await c.query(
      "UPDATE jobs SET sources=$1,updated_at=now() WHERE id=$2 AND status='running' AND worker_id=$3 AND lease_until>now() RETURNING id",
      [JSON.stringify(sources), job.id, job.worker_id],
    );
    if (!retained.rowCount) throw new Error("JOB_LEASE_LOST");
    for (const source of sources)
      await c.query(
        "INSERT INTO sources(id,workspace_id,company_id,job_id,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
        [source.id, job.workspace_id, company.id, job.id, source],
      );
  });
  const { analysis, usage } = await analyzeCompany(sources, seller, job.mode);
  const resolutions = resolveClaims(analysis.claims, sources);
  const assessment = scoreOpportunity(analysis, !!seller.offering.trim());
  assessment.sellerContext = seller;
  if (resolutions.some((r) => r.status === "unresolved_conflict")) {
    assessment.qualified = false;
    assessment.reasons.push("Unresolved factual conflicts require review.");
  }
  const snapshotId = randomUUID(),
    createdAt = new Date().toISOString();
  const triggers = compareSnapshots(previous ? rowSnapshot(previous) : null, {
    analysis,
    createdAt,
  });
  const fingerprint = actionFingerprint(company.id, sources);
  await withTransaction(async (c) => {
    const current = (
      await c.query("SELECT * FROM jobs WHERE id=$1 FOR UPDATE", [job.id])
    ).rows[0];
    if (
      current.status !== "running" ||
      current.worker_id !== job.worker_id ||
      new Date(current.lease_until).getTime() < Date.now()
    )
      throw new Error("JOB_LEASE_LOST");
    await c.query(
      "INSERT INTO snapshots(id,workspace_id,company_id,job_id,analysis,assessment,resolutions,triggers,demo,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(job_id) DO NOTHING",
      [
        snapshotId,
        job.workspace_id,
        company.id,
        job.id,
        analysis,
        assessment,
        JSON.stringify(resolutions),
        JSON.stringify(triggers),
        job.mode === "demo",
        createdAt,
      ],
    );
    for (const claim of analysis.claims)
      await c.query("INSERT INTO claims VALUES($1,$2,$3,$4)", [
        randomUUID(),
        snapshotId,
        job.workspace_id,
        claim,
      ]);
    await c.query("INSERT INTO contacts VALUES($1,$2,$3,$4)", [
      randomUUID(),
      snapshotId,
      job.workspace_id,
      analysis.contact,
    ]);
    for (const trigger of triggers)
      await c.query("INSERT INTO triggers VALUES($1,$2,$3,$4)", [
        randomUUID(),
        snapshotId,
        job.workspace_id,
        trigger,
      ]);
    await c.query("UPDATE companies SET name=$1 WHERE id=$2", [
      analysis.name,
      company.id,
    ]);
    await c.query(
      `INSERT INTO actions(id,workspace_id,company_id,snapshot_id,fingerprint,title,reason) VALUES($1,$2,$3,$4,$5,$6,$7)
   ON CONFLICT(company_id,fingerprint) DO UPDATE SET snapshot_id=EXCLUDED.snapshot_id,reason=EXCLUDED.reason,updated_at=now()`,
      [
        randomUUID(),
        job.workspace_id,
        company.id,
        snapshotId,
        fingerprint,
        `Approach ${analysis.name}`,
        analysis.approach,
      ],
    );
    await c.query(
      "UPDATE jobs SET status='succeeded',lease_until=NULL,usage=$1,error_code=NULL,updated_at=now() WHERE id=$2",
      [usage, job.id],
    );
    await c.query(
      "UPDATE job_attempts SET status='succeeded',finished_at=now() WHERE job_id=$1 AND attempt=$2",
      [job.id, job.attempts],
    );
    await c.query(
      "INSERT INTO audit_events(id,workspace_id,kind,resource_id) VALUES($1,$2,$3,$4)",
      [randomUUID(), job.workspace_id, "research.succeeded", job.id],
    );
  });
}
