import { Router, type IRouter } from "express";
import { db, childrenTable, preferencesTable } from "@workspace/db";
import { formatChild, computeAge } from "./children";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_ADULTS = 2;

function tagWeight(tags: string[], tag: string): number {
  return tags.includes(tag) ? 1.0 : 0.2;
}

function buildReviewProfile(tags: string[], priceValueWeight: number) {
  const luxuryValue = priceValueWeight / 10;
  const foodie = tagWeight(tags, "foodie");
  const eco = tagWeight(tags, "eco");
  const adventurousMenu = tagWeight(tags, "adventurous_menu");

  const weightVector = { luxuryValue, foodie, eco, adventurousMenu };

  // Human-readable description
  const parts: string[] = [];

  if (luxuryValue >= 0.8) parts.push("luxury-value focused");
  else if (luxuryValue <= 0.4) parts.push("budget-conscious");
  else parts.push("mid-range value");

  if (foodie === 1.0) parts.push("foodie");
  if (eco === 1.0) parts.push("eco-minded");
  if (adventurousMenu === 1.0) parts.push("adventurous menu");

  if (tags.includes("kids_menu_only")) parts.push("kids menu required");
  else if (tags.includes("no_kids_menu_required")) parts.push("no kids menu required");
  if (tags.includes("hiking_nearby")) parts.push("hiking nearby");
  if (tags.includes("family_friendly")) parts.push("family friendly");
  if (tags.includes("romantic")) parts.push("romantic");

  const description =
    parts.length > 0
      ? parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(", ")
      : "No travel profile set";

  return { weightVector, description };
}

// ---------------------------------------------------------------------------
// GET /summary — original endpoint (kept for frontend compatibility)
// ---------------------------------------------------------------------------
router.get("/summary", async (_req, res): Promise<void> => {
  const [childrenRows, prefRows] = await Promise.all([
    db.select().from(childrenTable).orderBy(childrenTable.createdAt),
    db.select().from(preferencesTable).limit(1),
  ]);

  const children = childrenRows.map(formatChild);
  const preferences = prefRows.length > 0 ? prefRows[0] : null;
  const hasPreferences = preferences !== null && preferences.id !== 0;

  res.json({
    children,
    preferences: preferences ?? { id: 0 },
    totalTravelers: children.length,
    hasPreferences,
  });
});

// ---------------------------------------------------------------------------
// GET /summary/:userId — rich payload for browser extension
// ---------------------------------------------------------------------------
router.get("/summary/:userId", async (req, res): Promise<void> => {
  const [childrenRows, prefRows] = await Promise.all([
    db.select().from(childrenTable).orderBy(childrenTable.createdAt),
    db.select().from(preferencesTable).limit(1),
  ]);

  const prefs = prefRows[0] ?? null;
  const styleTags: string[] = Array.isArray(prefs?.travelStyleTags)
    ? (prefs.travelStyleTags as string[])
    : [];
  const luxuryIndexMin = prefs?.luxuryIndexMin ?? 6;
  const luxuryIndexMax = prefs?.luxuryIndexMax ?? 9;
  const priceValueWeight = prefs?.priceValueWeight ?? 8;

  // Family block
  const childrenSummary = childrenRows.map((child) => {
    const age = computeAge(child.birthdate);
    return {
      name: child.name,
      ageYears: age.ageYears,
      ageMonths: age.ageMonths,
      foodPreferences: (child.foodPreferences as string[] | null) ?? [],
      activityPreferences: (child.activityPreferences as string[] | null) ?? [],
    };
  });

  const family = {
    children: childrenSummary,
    travelerCount: DEFAULT_ADULTS + childrenSummary.length,
  };

  // Preferences block
  const preferences = {
    travelStyleTags: styleTags,
    luxuryIndexMin,
    luxuryIndexMax,
    priceValueWeight,
    notes: prefs?.notes ?? null,
  };

  // Auto-fill payload — the key piece for the browser extension
  const autoFillPayload = {
    adults: DEFAULT_ADULTS,
    children: childrenSummary.length,
    childAges: childrenSummary.map((c) => c.ageYears),
  };

  // Review profile
  const reviewProfile = buildReviewProfile(styleTags, priceValueWeight);

  res.json({ family, preferences, autoFillPayload, reviewProfile });
});

export default router;
