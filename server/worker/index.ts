import { randomUUID } from "node:crypto";
import { runOne } from "./queue.js";
import { pool } from "../db.js";
const id = randomUUID();
let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});
console.log("SignalDesk worker started.");
while (!stopping) {
  try {
    if (!(await runOne(id))) await new Promise((r) => setTimeout(r, 1500));
  } catch {
    console.error("Worker unavailable; retrying connection.");
    await new Promise((r) => setTimeout(r, 3000));
  }
}
await pool.end();
