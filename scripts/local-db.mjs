// Local convenience only. Deployment uses PostgreSQL containers or a managed service.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
const packageName =
  process.platform === "win32"
    ? "windows-x64"
    : process.platform === "darwin"
      ? `darwin-${process.arch}`
      : `linux-${process.arch}`;
const binaries = await import(`@embedded-postgres/${packageName}`);
const data = path.resolve(".local-db"),
  passwordFile = path.resolve(".local-db-password");
if (!existsSync(path.join(data, "PG_VERSION"))) {
  await writeFile(passwordFile, "local-development-password\n", {
    mode: 0o600,
  });
  try {
    await new Promise((resolve, reject) => {
      const init = spawn(
        binaries.initdb,
        [
          "-D",
          data,
          "-U",
          "signaldesk",
          "-A",
          "scram-sha-256",
          `--pwfile=${passwordFile}`,
          "--encoding=UTF8",
          "--locale=C",
        ],
        { stdio: "inherit", windowsHide: true },
      );
      init.on("error", reject);
      init.on("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error("PostgreSQL initialization failed.")),
      );
    });
  } finally {
    await unlink(passwordFile).catch(() => {});
  }
}
const child = spawn(
  binaries.postgres,
  ["-D", data, "-h", "127.0.0.1", "-p", "54329"],
  { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
);
child.stderr.on("data", (chunk) => {
  const line = chunk.toString();
  if (!line.includes("LOG:")) process.stderr.write(line);
});
child.on("error", (e) => {
  console.error(e.message);
  process.exit(1);
});
let ready = false;
for (let i = 0; i < 40; i++) {
  const client = new pg.Client({
    connectionString:
      "postgresql://signaldesk:local-development-password@127.0.0.1:54329/postgres",
  });
  try {
    await client.connect();
    for (const name of ["signaldesk", "signaldesk_test"])
      if (
        !(
          await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [
            name,
          ])
        ).rowCount
      )
        await client.query(`CREATE DATABASE ${name}`);
    ready = true;
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  } finally {
    await client.end().catch(() => {});
  }
}
if (!ready) {
  child.kill();
  throw new Error("Local PostgreSQL did not become ready.");
}
console.log(
  "Local PostgreSQL ready on 127.0.0.1:54329. Keep this terminal running.",
);
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", (code) => process.exit(code || 0));
