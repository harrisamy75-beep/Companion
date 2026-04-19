import { Router, type IRouter } from "express";
import { SignJWT } from "jose";

const router: IRouter = Router();

// Issues a short-lived (7-day) JWT that the browser extension can store
// and send as `Authorization: Bearer ...`. This sidesteps the SameSite /
// service-worker cookie issues that prevent Clerk's __session cookie
// from reaching the API on extension-originated requests.
router.get("/extension-token", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const secret = new TextEncoder().encode(
    process.env.SESSION_SECRET ?? "dev-secret"
  );

  const token = await new SignJWT({ userId, kind: "extension" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  res.json({ token, expiresInDays: 7 });
});

export default router;
