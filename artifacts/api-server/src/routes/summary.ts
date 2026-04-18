import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, travelersTable, preferencesTable, favoritePropertiesTable, loyaltyProgramsTable } from "@workspace/db";
import { tripProfilesTable } from "@workspace/db";
import { computeAge } from "./travelers";

const router: IRouter = Router();

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

// GET /summary — frontend dashboard endpoint (optional ?profile_id= filter)
router.get("/summary", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const profileId = req.query.profile_id ? parseInt(req.query.profile_id as string, 10) : null;

  let travelerIdSet: Set<number> | null = null;
  if (profileId && !isNaN(profileId)) {
    const [profile] = await db
      .select()
      .from(tripProfilesTable)
      .where(and(eq(tripProfilesTable.id, profileId), eq(tripProfilesTable.userId, userId)));
    if (profile) {
      travelerIdSet = new Set<number>((profile.travelerIds as number[]) ?? []);
    }
  }

  const [allTravelers, prefRows, loyaltyRows, propertyRows, profileRows] = await Promise.all([
    db.select().from(travelersTable).where(eq(travelersTable.userId, userId)).orderBy(travelersTable.createdAt),
    db.select().from(preferencesTable).where(eq(preferencesTable.userId, userId)).limit(1),
    db.select().from(loyaltyProgramsTable).where(eq(loyaltyProgramsTable.userId, userId)).orderBy(loyaltyProgramsTable.createdAt),
    db.select().from(favoritePropertiesTable).where(eq(favoritePropertiesTable.userId, userId)).orderBy(favoritePropertiesTable.createdAt),
    db.select().from(tripProfilesTable).where(eq(tripProfilesTable.userId, userId)).orderBy(tripProfilesTable.createdAt),
  ]);

  const travelersRows = travelerIdSet
    ? allTravelers.filter((t) => travelerIdSet!.has(t.id))
    : allTravelers;

  const preferences = prefRows.length > 0 ? prefRows[0] : null;
  const hasPreferences = preferences !== null && preferences.id !== 0;
  const children = travelersRows.filter((t) => t.travelerType === "child");

  res.json({
    userName: userId,
    travelers: travelersRows,
    children,
    preferences: preferences ?? { id: 0 },
    totalTravelers: travelersRows.length,
    hasPreferences,
    loyaltyPrograms: loyaltyRows.map((r) => ({
      id: r.id,
      brand: r.brand,
      programName: r.programName,
      tier: r.tier ?? null,
      membershipNumber: r.membershipNumber ?? null,
    })),
    favoriteProperties: propertyRows.map((r) => ({
      id: r.id,
      propertyName: r.propertyName,
      brand: r.brand ?? null,
      location: r.location ?? null,
      tier: r.tier,
    })),
    tripProfiles: profileRows.map((r) => ({
      id: r.id,
      name: r.name,
      travelerIds: (r.travelerIds as number[]) ?? [],
      emoji: r.emoji ?? "✈️",
      isDefault: r.isDefault,
    })),
    personality: null,
  });
});

// GET /summary/:userId — rich payload for browser extension
router.get("/summary/:userId", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const [travelersRows, prefRows] = await Promise.all([
    db
      .select()
      .from(travelersTable)
      .where(eq(travelersTable.userId, userId))
      .orderBy(travelersTable.createdAt),
    db
      .select()
      .from(preferencesTable)
      .where(eq(preferencesTable.userId, userId))
      .limit(1),
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

  const partyDescription = buildPartyDescription(adults.length, children.length);

  const family = {
    adults: adults.map(toSummaryItem),
    children: children.map(toSummaryItem),
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

  const childAges = children
    .filter((c) => c.birthDate)
    .map((c) => computeAge(c.birthDate!).ageYears);

  const autoFillPayload = {
    adults: adults.length,
    children: children.length,
    childAges,
    partyDescription,
  };

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

  const [loyaltyRows, propertyRows] = await Promise.all([
    db.select().from(loyaltyProgramsTable).where(eq(loyaltyProgramsTable.userId, userId)),
    db.select().from(favoritePropertiesTable).where(eq(favoritePropertiesTable.userId, userId)),
  ]);

  const loyaltyPrograms = loyaltyRows.map((r) => ({
    brand: r.brand,
    programName: r.programName,
    tier: r.tier ?? null,
    membershipNumber: r.membershipNumber ?? null,
  }));

  const lovedBrands = propertyRows
    .filter((r) => r.tier === "loved" && r.brand)
    .map((r) => r.brand as string);

  const avoidBrands = propertyRows
    .filter((r) => r.tier === "avoid" && r.brand)
    .map((r) => r.brand as string);

  res.json({ family, preferences, autoFillPayload, reviewProfile, loyaltyPrograms, lovedBrands, avoidBrands });
});

export default router;
