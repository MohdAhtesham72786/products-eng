import { migrate, pool } from "../server/db.js";
try {
  await migrate();
  console.log("Migrations applied.");
} finally {
  await pool.end();
}
