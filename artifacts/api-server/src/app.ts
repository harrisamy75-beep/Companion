import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, preferencesTable } from "@workspace/db";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

async function userIdFromCompanionKey(req: Request): Promise<string | null> {
  const key = (req.headers["x-companion-key"] as string | undefined)?.trim();
  if (!key) return null;
  const [pref] = await db
    .select({ userId: preferencesTable.userId })
    .from(preferencesTable)
    .where(eq(preferencesTable.extensionApiKey, key))
    .limit(1);
  return pref?.userId ?? null;
}

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use("/api", async (req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/healthz" || req.path === "/health") return next();

  // 1) Clerk session (cookie / Clerk Bearer) — primary path for the web app.
  const userId = getAuth(req)?.userId;
  if (userId) {
    (req as any).userId = userId;
    return next();
  }

  // 2) Companion API key (x-companion-key header) — browser extension auth.
  //    The key is generated per-user from /api/extension/key and stored in
  //    the preferences row. Maps key → userId for downstream routes.
  const extUserId = await userIdFromCompanionKey(req);
  if (extUserId) {
    (req as any).userId = extUserId;
    return next();
  }

  res.status(401).json({ error: "Unauthorized" });
});

app.use("/api", router);

export default app;
