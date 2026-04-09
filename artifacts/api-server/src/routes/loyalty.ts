import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, loyaltyProgramsTable } from "@workspace/db";

const router: IRouter = Router();

export const SUGGESTED_PROGRAMS = [
  { brand: "Marriott", program: "Marriott Bonvoy" },
  { brand: "Hyatt", program: "World of Hyatt" },
  { brand: "Hilton", program: "Hilton Honors" },
  { brand: "IHG", program: "IHG One Rewards" },
  { brand: "Accor", program: "ALL - Accor Live Limitless" },
  { brand: "Four Seasons", program: "Four Seasons Preferred Partner" },
  { brand: "Rosewood", program: "Rosewood Sense" },
  { brand: "Aman", program: "Aman" },
  { brand: "Belmond", program: "Belmond Bellini Club" },
  { brand: "Virgin Hotels", program: "The Know" },
  { brand: "Auberge", program: "Auberge Rewards" },
  { brand: "Small Luxury Hotels", program: "SLH INVITED" },
];

// GET /loyalty/programs — static suggested list
router.get("/loyalty/programs", (_req, res): void => {
  res.json(SUGGESTED_PROGRAMS);
});

// GET /loyalty
router.get("/loyalty", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const rows = await db
    .select()
    .from(loyaltyProgramsTable)
    .where(eq(loyaltyProgramsTable.userId, userId))
    .orderBy(loyaltyProgramsTable.createdAt);
  res.json(rows);
});

// POST /loyalty
router.post("/loyalty", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const { programName, brand, membershipNumber, tier, notes } = req.body;
  if (!programName || !brand) {
    res.status(400).json({ error: "programName and brand are required" });
    return;
  }
  const [row] = await db
    .insert(loyaltyProgramsTable)
    .values({
      userId,
      programName,
      brand,
      membershipNumber: membershipNumber || null,
      tier: tier || null,
      notes: notes || null,
    })
    .returning();
  res.status(201).json(row);
});

// PUT /loyalty/:id
router.put("/loyalty/:id", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { programName, brand, membershipNumber, tier, notes } = req.body;
  const [row] = await db
    .update(loyaltyProgramsTable)
    .set({
      programName,
      brand,
      membershipNumber: membershipNumber || null,
      tier: tier || null,
      notes: notes || null,
    })
    .where(and(eq(loyaltyProgramsTable.id, id), eq(loyaltyProgramsTable.userId, userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

// DELETE /loyalty/:id
router.delete("/loyalty/:id", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db
    .delete(loyaltyProgramsTable)
    .where(and(eq(loyaltyProgramsTable.id, id), eq(loyaltyProgramsTable.userId, userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

export default router;
