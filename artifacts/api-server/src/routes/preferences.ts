import { Router, type IRouter } from "express";
import { db, preferencesTable } from "@workspace/db";
import { UpsertPreferencesBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/preferences", async (_req, res): Promise<void> => {
  const rows = await db.select().from(preferencesTable).limit(1);
  if (rows.length === 0) {
    res.json({ id: 0 });
    return;
  }
  res.json(rows[0]);
});

router.put("/preferences", async (req, res): Promise<void> => {
  const parsed = UpsertPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select().from(preferencesTable).limit(1);

  if (existing.length === 0) {
    const [created] = await db.insert(preferencesTable).values(parsed.data).returning();
    res.json(created);
    return;
  }

  const [updated] = await db
    .update(preferencesTable)
    .set(parsed.data)
    .returning();

  res.json(updated);
});

export default router;
