import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  travelersTable,
  preferencesTable,
  favoritePropertiesTable,
  loyaltyProgramsTable,
  tripProfilesTable,
} from "@workspace/db";

const router: IRouter = Router();

const CURRENT_CONSENT_VERSION = "1.0";

router.post("/account/consent", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const version =
    (typeof req.body?.version === "string" && req.body.version.trim()) ||
    CURRENT_CONSENT_VERSION;
  const now = new Date();

  const existing = await db
    .select()
    .from(preferencesTable)
    .where(eq(preferencesTable.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    const [created] = await db
      .insert(preferencesTable)
      .values({
        userId,
        consentGivenAt: now,
        consentVersion: version,
      })
      .returning();
    res.json(created);
    return;
  }

  const [updated] = await db
    .update(preferencesTable)
    .set({ consentGivenAt: now, consentVersion: version })
    .where(eq(preferencesTable.userId, userId))
    .returning();
  res.json(updated);
});

router.get("/account/export", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;

  const [travelers, preferences, properties, loyalty, tripProfiles] =
    await Promise.all([
      db.select().from(travelersTable).where(eq(travelersTable.userId, userId)),
      db
        .select()
        .from(preferencesTable)
        .where(eq(preferencesTable.userId, userId))
        .limit(1),
      db
        .select()
        .from(favoritePropertiesTable)
        .where(eq(favoritePropertiesTable.userId, userId)),
      db
        .select()
        .from(loyaltyProgramsTable)
        .where(eq(loyaltyProgramsTable.userId, userId)),
      db
        .select()
        .from(tripProfilesTable)
        .where(eq(tripProfilesTable.userId, userId)),
    ]);

  const prefRow = preferences[0] ?? null;

  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="companion-data.json"',
  );
  res.json({
    account: {
      userId,
      consentGivenAt: prefRow?.consentGivenAt ?? null,
      consentVersion: prefRow?.consentVersion ?? null,
    },
    travelers,
    preferences: prefRow,
    properties,
    loyaltyPrograms: loyalty,
    tripProfiles,
    // Note: review scores are a global cache keyed by (propertyId, source, reviewHash),
    // not per-user, so they are intentionally excluded from a personal export.
    note: "Review scoring data is a shared anonymous cache and is not associated with your account.",
    exportedAt: new Date().toISOString(),
  });
});

router.delete("/account", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;

  // Wrap multi-table deletes in a transaction so we never end up half-deleted.
  await db.transaction(async (tx) => {
    await tx.delete(travelersTable).where(eq(travelersTable.userId, userId));
    await tx
      .delete(favoritePropertiesTable)
      .where(eq(favoritePropertiesTable.userId, userId));
    await tx
      .delete(loyaltyProgramsTable)
      .where(eq(loyaltyProgramsTable.userId, userId));
    await tx
      .delete(tripProfilesTable)
      .where(eq(tripProfilesTable.userId, userId));
    await tx.delete(preferencesTable).where(eq(preferencesTable.userId, userId));
  });

  res.json({ deleted: true });
});

export default router;
