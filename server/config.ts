import "dotenv/config";
import { z } from "zod";
const env = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z
      .string()
      .default(
        "postgresql://signaldesk:local-development-password@127.0.0.1:54329/signaldesk",
      ),
    APP_ORIGIN: z.url().default("http://localhost:3000"),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z
      .string()
      .regex(/^[a-zA-Z0-9.-]+$/)
      .default("gemini-2.5-flash"),
    ALLOW_DEMO: z.enum(["true", "false"]).default("true"),
    TRUST_PROXY: z.enum(["true", "false"]).default("false"),
  })
  .parse(process.env);
if (
  env.NODE_ENV === "production" &&
  (env.DATABASE_URL.includes("local-development-password") ||
    !env.APP_ORIGIN.startsWith("https://"))
)
  throw new Error(
    "Production requires an explicit secure database URL and HTTPS APP_ORIGIN.",
  );
export const config = {
  ...env,
  production: env.NODE_ENV === "production",
  allowDemo: env.ALLOW_DEMO === "true",
};
