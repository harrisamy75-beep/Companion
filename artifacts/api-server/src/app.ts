import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { jwtVerify } from "jose";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const EXT_TOKEN_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-secret"
);

async function userIdFromExtensionToken(req: Request): Promise<string | null> {
  const auth = req.headers.authorization;
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, EXT_TOKEN_SECRET);
    if (payload.kind !== "extension") return null;
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
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

  // 2) Extension JWT fallback (HS256, signed with SESSION_SECRET).
  //    Used by the browser extension where Clerk's __session cookie
  //    isn't reliably available to the service worker.
  const extUserId = await userIdFromExtensionToken(req);
  if (extUserId) {
    (req as any).userId = extUserId;
    return next();
  }

  res.status(401).json({ error: "Unauthorized" });
});

app.use("/api", router);

export default app;
