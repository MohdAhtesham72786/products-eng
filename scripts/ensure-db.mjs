import pg from "pg";
const c = new pg.Client({
  connectionString:
    "postgresql://signaldesk:local-development-password@127.0.0.1:54329/postgres",
});
await c.connect();
if (
  !(await c.query("SELECT 1 FROM pg_database WHERE datname='signaldesk'"))
    .rowCount
)
  await c.query("CREATE DATABASE signaldesk");
if (
  !(await c.query("SELECT 1 FROM pg_database WHERE datname='signaldesk_test'"))
    .rowCount
)
  await c.query("CREATE DATABASE signaldesk_test");
await c.end();
console.log("Local database available.");
