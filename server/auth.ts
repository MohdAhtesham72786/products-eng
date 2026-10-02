import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { rateLimit } from "express-rate-limit";
import { pool, withTransaction } from "./db.js";
import { authSchema, sellerSchema } from "../shared/contracts.js";
import { ApiError } from "./errors.js";
import { config } from "./config.js";
import { z } from "zod";
const scrypt = promisify(scryptCallback);
declare global {
  namespace Express {
    interface Request {
      identity: { userId: string; workspaceId: string };
    }
  }
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return (
    salt + ":" + ((await scrypt(password, salt, 64)) as Buffer).toString("hex")
  );
}
async function verify(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  const result = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(key, "hex");
  return expected.length === result.length && timingSafeEqual(result, expected);
}
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
async function session(res: Response, userId: string, workspaceId: string) {
  const token = randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO sessions VALUES($1,$2,$3,now()+interval '7 days')",
    [digest(token), userId, workspaceId],
  );
  res.cookie("sd_session", token, {
    httpOnly: true,
    secure: config.production,
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 86400000,
  });
}
export async function requireSession(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = req.cookies?.sd_session;
    if (!token) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in.");
    const result = await pool.query(
      "SELECT user_id,workspace_id FROM sessions WHERE token_hash=$1 AND expires_at>now()",
      [digest(token)],
    );
    if (!result.rowCount)
      throw new ApiError(401, "UNAUTHENTICATED", "Your session has expired.");
    req.identity = {
      userId: result.rows[0].user_id,
      workspaceId: result.rows[0].workspace_id,
    };
    next();
  } catch (e) {
    next(e);
  }
}
export const authRouter = Router();
authRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
authRouter.post("/register", async (req, res) => {
  const input = authSchema.parse(req.body);
  const userId = randomUUID(),
    workspaceId = randomUUID();
  const hash = await hashPassword(input.password);
  await withTransaction(async (c) => {
    await c.query(
      "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)",
      [userId, input.email, input.name || input.email.split("@")[0], hash],
    );
    await c.query(
      "INSERT INTO workspaces(id,owner_id,settings) VALUES($1,$2,$3)",
      [workspaceId, userId, sellerSchema.parse({})],
    );
  });
  await session(res, userId, workspaceId);
  res
    .status(201)
    .json({ id: userId, name: input.name || input.email, email: input.email });
});
authRouter.post("/login", async (req, res) => {
  const input = authSchema
    .pick({ email: true, password: true })
    .extend({ password: z.string().min(1).max(200) })
    .parse(req.body);
  const r = await pool.query(
    "SELECT u.*,w.id AS workspace_id FROM users u JOIN workspaces w ON w.owner_id=u.id WHERE u.email=$1",
    [input.email],
  );
  const dummy = "00000000000000000000000000000000:" + "00".repeat(64);
  if (
    !(await verify(input.password, r.rows[0]?.password_hash || dummy)) ||
    !r.rowCount
  )
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "Email or password is incorrect.",
    );
  await session(res, r.rows[0].id, r.rows[0].workspace_id);
  res.json({ id: r.rows[0].id, name: r.rows[0].name, email: input.email });
});
authRouter.post("/logout", async (req, res) => {
  if (req.cookies?.sd_session)
    await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
      digest(req.cookies.sd_session),
    ]);
  res.clearCookie("sd_session", { path: "/" });
  res.json({ ok: true });
});
authRouter.get("/me", requireSession, async (req, res) => {
  const r = await pool.query("SELECT id,name,email FROM users WHERE id=$1", [
    req.identity.userId,
  ]);
  res.json({
    ...r.rows[0],
    allowDemo: config.allowDemo,
    liveAvailable: !!config.GEMINI_API_KEY,
  });
});
