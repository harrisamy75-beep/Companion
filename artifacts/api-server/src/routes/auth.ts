import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "user";
}

router.get("/auth/me", (req: Request, res: Response) => {
  res.json({
    userId: req.session.userId ?? null,
    displayName: req.session.displayName ?? null,
  });
});

router.post("/auth/login", (req: Request, res: Response) => {
  const raw = req.body?.name ?? req.body?.userId;
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    res.status(400).json({ error: "name required" });
    return;
  }
  const displayName = raw.trim().slice(0, 60);
  const userId = slugify(displayName);
  req.session.userId = userId;
  req.session.displayName = displayName;
  res.json({ ok: true, userId, displayName });
});

router.post("/auth/logout", (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

export default router;
