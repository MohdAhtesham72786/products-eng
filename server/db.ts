import pg from "pg";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});
pool.on("error", () => console.error("Database connection failed."));
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function migrate() {
  await withTransaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(870021)");
    await c.query(
      "CREATE TABLE IF NOT EXISTS migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const applied = await c.query(
      "SELECT 1 FROM migrations WHERE version='001'",
    );
    if (!applied.rowCount) {
      await c.query(
        await readFile(path.resolve("migrations/001_initial.sql"), "utf8"),
      );
      await c.query("INSERT INTO migrations(version) VALUES ('001')");
    }
  });
}
export function rowSnapshot(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    createdAt: new Date(row.created_at).toISOString(),
    analysis: row.analysis,
    assessment: row.assessment,
    resolutions: row.resolutions,
    triggers: row.triggers,
    demo: row.demo,
  };
}
