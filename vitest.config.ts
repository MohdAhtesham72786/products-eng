import { defineConfig } from "vitest/config";
if (process.argv.some((a) => a.includes("tests/integration"))) {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    "postgresql://signaldesk:local-development-password@127.0.0.1:54329/signaldesk_test";
  if (!new URL(process.env.DATABASE_URL).pathname.endsWith("_test"))
    throw new Error(
      "Integration tests require a dedicated database name ending in _test.",
    );
}
export default defineConfig({
  test: { testTimeout: 30000, hookTimeout: 30000, fileParallelism: false },
});
