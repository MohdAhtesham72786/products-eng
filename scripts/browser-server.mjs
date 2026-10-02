import { spawn } from "node:child_process";
const children = ["dist/server/index.js", "dist/server/worker/index.js"].map(
  (file) =>
    spawn(process.execPath, [file], { stdio: "inherit", windowsHide: true }),
);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children)
  child.on("exit", (code) => {
    if (!stopping) {
      stop();
      process.exit(code || 1);
    }
  });
