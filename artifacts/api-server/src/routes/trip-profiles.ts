import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, travelersTable, preferencesTable } from "@workspace/db";
import { tripProfilesTable } from "@workspace/db";
import { computeAge } from "./travelers";
import { checkLimit, limitExceededResponse } from "../lib/plan-limits";

const router: IRouter = Router();

function getUserId(req: any): string {
  return req.userId as string;
}

// GET /trip-profiles
router.get("/trip-profiles", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const rows = await db
    .select()
    .from(tripProfilesTable)
    .where(eq(tripProfilesTable.userId, userId))
    .orderBy(tripProfilesTable.createdAt);
  res.json(rows);
});

// POST /trip-profiles
router.post("/trip-profiles", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const { name, travelerIds, emoji, isDefault } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name required" });
    return;
  }
  const limit = await checkLimit(userId, "tripProfiles");
  if (!limit.ok) {
    res.status(402).json(limitExceededResponse(limit));
    return;
  }
  const [row] = await db
    .insert(tripProfilesTable)
    .values({
      userId,
      name: name.trim(),
      travelerIds: Array.isArray(travelerIds) ? travelerIds : [],
      emoji: emoji ?? "✈️",
      isDefault: isDefault ? "true" : "false",
    })
    .returning();
  res.status(201).json(row);
});

// PUT /trip-profiles/:id
router.put("/trip-profiles/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const { name, travelerIds, emoji, isDefault } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = String(name).trim();
  if (travelerIds !== undefined) updates.travelerIds = Array.isArray(travelerIds) ? travelerIds : [];
  if (emoji !== undefined) updates.emoji = String(emoji);
  if (isDefault !== undefined) updates.isDefault = isDefault ? "true" : "false";
  const [row] = await db
    .update(tripProfilesTable)
    .set(updates)
    .where(and(eq(tripProfilesTable.id, id), eq(tripProfilesTable.userId, userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Profile not found" }); return; }
  res.json(row);
});

// DELETE /trip-profiles/:id
router.delete("/trip-profiles/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const [row] = await db
    .delete(tripProfilesTable)
    .where(and(eq(tripProfilesTable.id, id), eq(tripProfilesTable.userId, userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Profile not found" }); return; }
  res.sendStatus(204);
});

// POST /trip-profiles/:id/duplicate
router.post("/trip-profiles/:id/duplicate", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const [source] = await db
    .select()
    .from(tripProfilesTable)
    .where(and(eq(tripProfilesTable.id, id), eq(tripProfilesTable.userId, userId)));
  if (!source) { res.status(404).json({ error: "Profile not found" }); return; }
  const limit = await checkLimit(userId, "tripProfiles");
  if (!limit.ok) {
    res.status(402).json(limitExceededResponse(limit));
    return;
  }
  const [copy] = await db
    .insert(tripProfilesTable)
    .values({
      userId,
      name: `Copy of ${source.name}`,
      travelerIds: (source.travelerIds as number[]) ?? [],
      emoji: source.emoji ?? "✈️",
      isDefault: "false",
    })
    .returning();
  res.status(201).json(copy);
});

// GET /trip-profiles/:id/summary — profile-specific summary for browser extension
router.get("/trip-profiles/:id/summary", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }

  const [profile] = await db
    .select()
    .from(tripProfilesTable)
    .where(and(eq(tripProfilesTable.id, id), eq(tripProfilesTable.userId, userId)));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const travelerIdSet = new Set<number>((profile.travelerIds as number[]) ?? []);

  const [allTravelers, prefRows] = await Promise.all([
    db.select().from(travelersTable).where(eq(travelersTable.userId, userId)),
    db.select().from(preferencesTable).where(eq(preferencesTable.userId, userId)).limit(1),
  ]);

  const travelersRows = allTravelers.filter((t) => travelerIdSet.has(t.id));
  const prefs = prefRows[0] ?? null;
  const styleTags: string[] = Array.isArray(prefs?.travelStyleTags) ? (prefs.travelStyleTags as string[]) : [];

  const adults = travelersRows.filter((t) => t.travelerType === "adult");
  const children = travelersRows.filter((t) => t.travelerType === "child");

  const toItem = (t: typeof travelersTable.$inferSelect) => {
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

  const adultCount = adults.length;
  const childCount = children.length;
  const parts: string[] = [];
  if (adultCount > 0) parts.push(`${adultCount} adult${adultCount !== 1 ? "s" : ""}`);
  if (childCount > 0) parts.push(`${childCount} kid${childCount !== 1 ? "s" : ""}`);
  const partyDescription = parts.length > 0 ? parts.join(", ") : "No travelers";

  res.json({
    profileName: profile.name,
    profileEmoji: profile.emoji,
    family: {
      adults: adults.map(toItem),
      children: children.map(toItem),
      travelerCount: travelersRows.length,
      partyDescription,
    },
    preferences: {
      travelStyleTags: styleTags,
      luxuryIndexMin: prefs?.luxuryIndexMin ?? 6,
      luxuryIndexMax: prefs?.luxuryIndexMax ?? 9,
      priceValueWeight: prefs?.priceValueWeight ?? 8,
      notes: prefs?.notes ?? null,
    },
    autoFillPayload: {
      adults: adultCount,
      children: childCount,
      childAges: children.filter((c) => c.birthDate).map((c) => computeAge(c.birthDate!).ageYears),
      partyDescription,
    },
  });
});

export default router;
