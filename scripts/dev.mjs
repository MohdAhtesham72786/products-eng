import { spawn } from "node:child_process";
const command = (file, args) =>
  spawn(process.execPath, [file, ...args], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
const compiler = command("node_modules/typescript/bin/tsc", [
  "-p",
  "tsconfig.server.json",
  "--watch",
  "--preserveWatchOutput",
]);
const vite = command("node_modules/vite/bin/vite.js", [
  "--configLoader",
  "native",
]);
let backend = [];
function restart() {
  for (const child of backend) child.kill("SIGTERM");
  backend = ["dist/server/index.js", "dist/server/worker/index.js"].map(
    (file) =>
      spawn(process.execPath, [file], { stdio: "inherit", windowsHide: true }),
  );
}
compiler.stdout.on("data", (chunk) => {
  const output = chunk.toString();
  process.stdout.write(output);
  if (output.includes("Found 0 errors. Watching for file changes.")) restart();
});
for (const child of [compiler, vite]) {
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  child.on("error", (e) => console.error(e.message));
}
vite.stdout.on("data", (chunk) => process.stdout.write(chunk));
function stop() {
  for (const child of [compiler, vite, ...backend]) child.kill("SIGTERM");
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
