import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, travelersTable, preferencesTable } from "@workspace/db";
import { computeAge } from "./travelers";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tagWeight(tags: string[], tag: string): number {
  return tags.includes(tag) ? 1.0 : 0.2;
}

function buildPartyDescription(adultCount: number, childCount: number): string {
  if (adultCount === 0 && childCount === 0) return "No travelers yet";
  const parts: string[] = [];
  if (adultCount > 0)
    parts.push(`${adultCount} adult${adultCount !== 1 ? "s" : ""}`);
  if (childCount > 0)
    parts.push(`${childCount} kid${childCount !== 1 ? "s" : ""}`);
  return parts.join(", ");
}

function buildReviewProfile(
  styleTags: string[],
  priceValueWeight: number,
  allFood: string[],
  allActivity: string[]
) {
  const luxuryValue = priceValueWeight / 10;

  // Union of style tags + inferred traveler preferences
  const isVegetarian = allFood.some((p) =>
    ["vegetarian", "vegan", "plant-based"].includes(p.toLowerCase())
  );
  const isAdventurous = allActivity.some((p) =>
    ["adventure", "adventurous", "hiking", "outdoors"].includes(p.toLowerCase())
  );

  const foodie = styleTags.includes("foodie") ? 1.0 : 0.2;
  const eco = styleTags.includes("eco") || isVegetarian ? 1.0 : 0.2;
  const adventurousMenu =
    styleTags.includes("adventurous_menu") || isAdventurous ? 1.0 : 0.2;

  const weightVector = { luxuryValue, foodie, eco, adventurousMenu };

  const parts: string[] = [];
  if (luxuryValue >= 0.8) parts.push("Luxury-value focused");
  else if (luxuryValue <= 0.4) parts.push("Budget-conscious");
  else parts.push("Mid-range value");

  if (foodie === 1.0) parts.push("foodie");
  if (eco === 1.0) parts.push("eco-minded");
  if (adventurousMenu === 1.0) parts.push("adventurous menu");

  if (styleTags.includes("kids_menu_only")) parts.push("kids menu required");
  if (styleTags.includes("family_friendly")) parts.push("family friendly");
  if (styleTags.includes("romantic")) parts.push("romantic");

  const description =
    parts.length > 0 ? parts.join(", ") : "No travel profile set";

  return { weightVector, description };
}

// ---------------------------------------------------------------------------
// GET /summary — original endpoint (kept for frontend compatibility)
// ---------------------------------------------------------------------------
router.get("/summary", async (_req, res): Promise<void> => {
  const [travelersRows, prefRows] = await Promise.all([
    db.select().from(travelersTable).orderBy(travelersTable.createdAt),
    db.select().from(preferencesTable).limit(1),
  ]);

  const preferences = prefRows.length > 0 ? prefRows[0] : null;
  const hasPreferences = preferences !== null && preferences.id !== 0;
  const children = travelersRows.filter((t) => t.travelerType === "child");

  res.json({
    travelers: travelersRows,
    children,
    preferences: preferences ?? { id: 0 },
    totalTravelers: travelersRows.length,
    hasPreferences,
  });
});

// ---------------------------------------------------------------------------
// GET /summary/:userId — rich payload for browser extension
// ---------------------------------------------------------------------------
router.get("/summary/:userId", async (req, res): Promise<void> => {
  const [travelersRows, prefRows] = await Promise.all([
    db.select().from(travelersTable).orderBy(travelersTable.createdAt),
    db.select().from(preferencesTable).limit(1),
  ]);

  const prefs = prefRows[0] ?? null;
  const styleTags: string[] = Array.isArray(prefs?.travelStyleTags)
    ? (prefs.travelStyleTags as string[])
    : [];
  const luxuryIndexMin = prefs?.luxuryIndexMin ?? 6;
  const luxuryIndexMax = prefs?.luxuryIndexMax ?? 9;
  const priceValueWeight = prefs?.priceValueWeight ?? 8;

  const adults = travelersRows.filter((t) => t.travelerType === "adult");
  const children = travelersRows.filter((t) => t.travelerType === "child");

  const toSummaryItem = (t: typeof travelersTable.$inferSelect) => {
    const age = t.birthDate ? computeAge(t.birthDate) : null;
    return {
      name: t.name,
      travelerType: t.travelerType,
      relationship: t.relationship ?? null,
      ageYears: age?.ageYears ?? null,
      ageMonths: age?.ageMonths ?? null,
      foodPreferences: (t.foodPreferences as string[] | null) ?? [],
      activityPreferences: (t.activityPreferences as string[] | null) ?? [],
    };
  };

  const adultSummaries = adults.map(toSummaryItem);
  const childSummaries = children.map(toSummaryItem);

  const partyDescription = buildPartyDescription(adults.length, children.length);

  const family = {
    adults: adultSummaries,
    children: childSummaries,
    travelerCount: travelersRows.length,
    partyDescription,
  };

  const preferences = {
    travelStyleTags: styleTags,
    luxuryIndexMin,
    luxuryIndexMax,
    priceValueWeight,
    notes: prefs?.notes ?? null,
  };

  // Auto-fill payload
  const childAges = children
    .filter((c) => c.birthDate)
    .map((c) => computeAge(c.birthDate!).ageYears);

  const autoFillPayload = {
    adults: adults.length,
    children: children.length,
    childAges,
    partyDescription,
  };

  // Merge all travelers' food + activity preferences for weight vector
  const allFood = travelersRows.flatMap(
    (t) => (t.foodPreferences as string[] | null) ?? []
  );
  const allActivity = travelersRows.flatMap(
    (t) => (t.activityPreferences as string[] | null) ?? []
  );

  const reviewProfile = buildReviewProfile(
    styleTags,
    priceValueWeight,
    allFood,
    allActivity
  );

  res.json({ family, preferences, autoFillPayload, reviewProfile });
});

export default router;
