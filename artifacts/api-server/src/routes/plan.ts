import { Router, type IRouter } from "express";
import { PLANS, getUserPlan, getUsage, setUserPlan, type PlanId } from "../lib/plan-limits";

const router: IRouter = Router();

// GET /plan — current plan + usage + all plan definitions
router.get("/plan", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const [plan, usage] = await Promise.all([getUserPlan(userId), getUsage(userId)]);
  const current = PLANS[plan];
  res.json({
    plan,
    label: current.label,
    limits: {
      travelers: current.limits.travelers === Infinity ? -1 : current.limits.travelers,
      favoriteProperties: current.limits.favoriteProperties === Infinity ? -1 : current.limits.favoriteProperties,
      loyaltyPrograms: current.limits.loyaltyPrograms === Infinity ? -1 : current.limits.loyaltyPrograms,
      tripProfiles: current.limits.tripProfiles === Infinity ? -1 : current.limits.tripProfiles,
    },
    usage,
    plans: Object.values(PLANS).map((p) => ({
      id: p.id,
      label: p.label,
      priceLabel: p.priceLabel,
      limits: {
        travelers: p.limits.travelers === Infinity ? -1 : p.limits.travelers,
        favoriteProperties: p.limits.favoriteProperties === Infinity ? -1 : p.limits.favoriteProperties,
        loyaltyPrograms: p.limits.loyaltyPrograms === Infinity ? -1 : p.limits.loyaltyPrograms,
        tripProfiles: p.limits.tripProfiles === Infinity ? -1 : p.limits.tripProfiles,
      },
    })),
  });
});

// POST /plan — change plan
// Pro upgrades require a real billing flow (e.g. Stripe). Until that is wired in,
// self-upgrade is allowed in development so the UI is testable. In production
// it requires ALLOW_SELF_UPGRADE=1 (or, eventually, a verified checkout).
// Downgrades to free are always permitted (user-initiated cancellation).
router.post("/plan", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const requested = String(req.body?.plan ?? "").toLowerCase() as PlanId;
  if (requested !== "free" && requested !== "pro") {
    res.status(400).json({ error: "invalid_plan" });
    return;
  }
  const isProd = process.env.NODE_ENV === "production";
  const selfUpgradeAllowed = !isProd || process.env.ALLOW_SELF_UPGRADE === "1";
  if (requested === "pro" && !selfUpgradeAllowed) {
    res.status(402).json({
      error: "upgrade_requires_billing",
      message: "Pro upgrades require checkout. Billing integration coming soon.",
    });
    return;
  }
  await setUserPlan(userId, requested);
  res.json({ plan: requested });
});

export default router;
