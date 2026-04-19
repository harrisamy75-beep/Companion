import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, preferencesTable } from "@workspace/db";
import { UpsertPreferencesBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/preferences", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const rows = await db
    .select()
    .from(preferencesTable)
    .where(eq(preferencesTable.userId, userId))
    .limit(1);
  if (rows.length === 0) {
    res.json({ id: 0 });
    return;
  }
  res.json(rows[0]);
});

router.put("/preferences", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const parsed = UpsertPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Keep travel_styles (legacy text[]) and travel_style_tags (jsonb) in sync
  // so older read paths and newer ones both see the same selections.
  const data: Record<string, any> = { ...parsed.data };
  const incomingTags = data.travelStyleTags ?? data.travelStyles;
  if (Array.isArray(incomingTags)) {
    data.travelStyleTags = incomingTags;
    data.travelStyles = incomingTags;
  }

  const existing = await db
    .select()
    .from(preferencesTable)
    .where(eq(preferencesTable.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    const [created] = await db
      .insert(preferencesTable)
      .values({ ...data, userId })
      .returning();
    res.json(created);
    return;
  }

  const [updated] = await db
    .update(preferencesTable)
    .set(data)
    .where(eq(preferencesTable.userId, userId))
    .returning();
  res.json(updated);
});

export default router;
