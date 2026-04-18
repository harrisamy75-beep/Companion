import { Router, type IRouter, type Request } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/whoami", (req: Request, res) => {
  const auth = getAuth(req);
  const reqUserId = (req as { userId?: string }).userId;
  res.json({
    clerkUserId: auth?.userId ?? null,
    sessionId: auth?.sessionId ?? null,
    reqUserId: reqUserId ?? null,
    authenticated: Boolean(auth?.userId),
  });
});

export default router;
