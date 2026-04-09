import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

router.get("/auth/me", (req: Request, res: Response) => {
  res.json({ userId: req.session.userId ?? null });
});

router.post("/auth/login", (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId || typeof userId !== "string" || !userId.trim()) {
    res.status(400).json({ error: "userId required" });
    return;
  }
  req.session.userId = userId.trim();
  res.json({ ok: true, userId: req.session.userId });
});

router.post("/auth/logout", (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

export default router;
