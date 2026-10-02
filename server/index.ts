import { createApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db.js";
const app = createApp();
const server = app.listen(config.PORT, "0.0.0.0", () =>
  console.log(`SignalDesk listening on port ${config.PORT}.`),
);
async function stop() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15000).unref();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
