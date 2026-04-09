import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, favoritePropertiesTable } from "@workspace/db";

const router: IRouter = Router();

const TIER_ORDER: Record<string, number> = { loved: 0, liked: 1, avoid: 2 };

// GET /properties
router.get("/properties", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const rows = await db
    .select()
    .from(favoritePropertiesTable)
    .where(eq(favoritePropertiesTable.userId, userId));

  rows.sort((a, b) => {
    const ta = TIER_ORDER[a.tier ?? "liked"] ?? 1;
    const tb = TIER_ORDER[b.tier ?? "liked"] ?? 1;
    return ta !== tb ? ta - tb : (a.propertyName < b.propertyName ? -1 : 1);
  });

  res.json(rows);
});

// GET /properties/brands — deduplicated brand list for this user
router.get("/properties/brands", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const rows = await db
    .select({ brand: favoritePropertiesTable.brand })
    .from(favoritePropertiesTable)
    .where(eq(favoritePropertiesTable.userId, userId));
  const brands = [...new Set(rows.map((r) => r.brand).filter(Boolean))] as string[];
  res.json(brands);
});

// POST /properties
router.post("/properties", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const { propertyName, brand, location, category, tier, tags, notes, visitedAt } = req.body;
  if (!propertyName) {
    res.status(400).json({ error: "propertyName is required" });
    return;
  }
  const [row] = await db
    .insert(favoritePropertiesTable)
    .values({
      userId,
      propertyName,
      brand: brand || null,
      location: location || null,
      category: category || null,
      tier: tier || "liked",
      tags: Array.isArray(tags) ? tags : [],
      notes: notes || null,
      visitedAt: visitedAt || null,
    })
    .returning();
  res.status(201).json(row);
});

// PUT /properties/:id
router.put("/properties/:id", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { propertyName, brand, location, category, tier, tags, notes, visitedAt } = req.body;
  const [row] = await db
    .update(favoritePropertiesTable)
    .set({
      propertyName,
      brand: brand || null,
      location: location || null,
      category: category || null,
      tier: tier || "liked",
      tags: Array.isArray(tags) ? tags : [],
      notes: notes || null,
      visitedAt: visitedAt || null,
    })
    .where(and(eq(favoritePropertiesTable.id, id), eq(favoritePropertiesTable.userId, userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

// DELETE /properties/:id
router.delete("/properties/:id", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db
    .delete(favoritePropertiesTable)
    .where(and(eq(favoritePropertiesTable.id, id), eq(favoritePropertiesTable.userId, userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

export default router;
