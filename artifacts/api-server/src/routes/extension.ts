import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  db,
  preferencesTable,
  travelersTable,
  loyaltyProgramsTable,
  favoritePropertiesTable,
} from "@workspace/db";
import { computeAge } from "./travelers";

const router: IRouter = Router();

function newApiKey(): string {
  return "cpn_" + randomUUID().replace(/-/g, "");
}

async function ensureKeyForUser(userId: string): Promise<string> {
  const [existing] = await db
    .select({ id: preferencesTable.id, key: preferencesTable.extensionApiKey })
    .from(preferencesTable)
    .where(eq(preferencesTable.userId, userId))
    .limit(1);

  if (existing?.key) return existing.key;

  const key = newApiKey();
  if (existing) {
    await db
      .update(preferencesTable)
      .set({ extensionApiKey: key })
      .where(eq(preferencesTable.id, existing.id));
  } else {
    await db.insert(preferencesTable).values({ userId, extensionApiKey: key });
  }
  return key;
}

// ---- Clerk-authed: read or generate the user's extension API key ----------
router.get("/extension/key", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const apiKey = await ensureKeyForUser(userId);
  res.json({ apiKey });
});

// ---- Clerk-authed: regenerate (invalidates the previous key) --------------
router.post("/extension/key/regenerate", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const key = newApiKey();
  const [existing] = await db
    .select({ id: preferencesTable.id })
    .from(preferencesTable)
    .where(eq(preferencesTable.userId, userId))
    .limit(1);
  if (existing) {
    await db
      .update(preferencesTable)
      .set({ extensionApiKey: key })
      .where(eq(preferencesTable.id, existing.id));
  } else {
    await db.insert(preferencesTable).values({ userId, extensionApiKey: key });
  }
  res.json({ apiKey: key });
});

// ---- API-key-authed: full extension payload -------------------------------
// Auth is performed inside this handler (NOT via the global Clerk middleware).
router.get("/extension/sync", async (req, res): Promise<void> => {
  const apiKey = (req.headers["x-companion-key"] as string | undefined)?.trim();
  if (!apiKey) {
    res.status(401).json({ error: "Missing x-companion-key header" });
    return;
  }

  const [pref] = await db
    .select()
    .from(preferencesTable)
    .where(eq(preferencesTable.extensionApiKey, apiKey))
    .limit(1);

  if (!pref) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  const userId = pref.userId;

  const [travelersRows, loyaltyRows, propertyRows] = await Promise.all([
    db
      .select()
      .from(travelersTable)
      .where(eq(travelersTable.userId, userId))
      .orderBy(travelersTable.createdAt),
    db.select().from(loyaltyProgramsTable).where(eq(loyaltyProgramsTable.userId, userId)),
    db.select().from(favoritePropertiesTable).where(eq(favoritePropertiesTable.userId, userId)),
  ]);

  const styleTags: string[] = Array.from(
    new Set([
      ...(Array.isArray(pref.travelStyleTags) ? (pref.travelStyleTags as string[]) : []),
      ...(Array.isArray(pref.travelStyles) ? (pref.travelStyles as string[]) : []),
    ])
  ).filter(Boolean);

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

  const partyParts: string[] = [];
  if (adults.length > 0)
    partyParts.push(`${adults.length} adult${adults.length !== 1 ? "s" : ""}`);
  if (children.length > 0)
    partyParts.push(`${children.length} kid${children.length !== 1 ? "s" : ""}`);
  const partyDescription = partyParts.length ? partyParts.join(", ") : "No travelers yet";

  const family = {
    adults: adults.map(toSummaryItem),
    children: children.map(toSummaryItem),
    travelerCount: travelersRows.length,
    partyDescription,
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

  const reviewProfile = {
    weightVector: {
      luxuryValue: (pref.priceValueWeight ?? 8) / 10,
      foodie: styleTags.includes("foodie") ? 1.0 : 0.2,
      eco: styleTags.includes("eco") ? 1.0 : 0.2,
      adventurousMenu: styleTags.includes("adventurous_menu") ? 1.0 : 0.2,
    },
    description: styleTags.join(", ") || "No travel profile set",
  };

  const preferences = {
    travelStyleTags: styleTags,
    travelStyles: styleTags,
    luxuryIndexMin: pref.luxuryIndexMin ?? 6,
    luxuryIndexMax: pref.luxuryIndexMax ?? 9,
    priceValueWeight: pref.priceValueWeight ?? 8,
    valuePhilosophy: pref.valuePhilosophy ?? null,
    budgetPerNightMin: pref.budgetPerNightMin ?? null,
    budgetPerNightMax: pref.budgetPerNightMax ?? null,
    notes: pref.notes ?? null,
  };

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

  res.json({
    family,
    preferences,
    autoFillPayload,
    reviewProfile,
    loyaltyPrograms,
    lovedBrands,
    avoidBrands,
  });
});

export default router;
