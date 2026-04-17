import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, travelersTable } from "@workspace/db";
import {
  CreateTravelerBody,
  UpdateTravelerParams,
} from "@workspace/api-zod";
import { checkLimit, limitExceededResponse } from "../lib/plan-limits";

const router: IRouter = Router();

export function computeAge(birthDate: string): {
  ageYears: number;
  ageMonths: number;
  ageDisplay: string;
} {
  const birth = new Date(birthDate);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const dayDiff = now.getDate() - birth.getDate();
  if (dayDiff < 0 && months > 0) {
    months -= 1;
  } else if (dayDiff < 0 && months === 0) {
    years -= 1;
    months = 11;
  }

  let ageDisplay: string;
  if (years === 0) {
    ageDisplay = `${months} month${months !== 1 ? "s" : ""}`;
  } else if (months === 0) {
    ageDisplay = `${years} year${years !== 1 ? "s" : ""}`;
  } else {
    ageDisplay = `${years} year${years !== 1 ? "s" : ""}, ${months} month${months !== 1 ? "s" : ""}`;
  }

  return { ageYears: years, ageMonths: months, ageDisplay };
}

export function formatTraveler(row: typeof travelersTable.$inferSelect) {
  const age = row.birthDate ? computeAge(row.birthDate) : null;
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    birthDate: row.birthDate ?? null,
    travelerType: row.travelerType,
    relationship: row.relationship ?? null,
    foodPreferences: (row.foodPreferences as string[] | null) ?? [],
    activityPreferences: (row.activityPreferences as string[] | null) ?? [],
    accessibilityNeeds: row.accessibilityNeeds ?? null,
    notes: row.notes ?? null,
    ageYears: age?.ageYears ?? null,
    ageMonths: age?.ageMonths ?? null,
    ageDisplay: age?.ageDisplay ?? null,
  };
}

// GET /travelers
router.get("/travelers", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const rows = await db
    .select()
    .from(travelersTable)
    .where(eq(travelersTable.userId, userId))
    .orderBy(travelersTable.createdAt);
  res.json(rows.map(formatTraveler));
});

// POST /travelers
router.post("/travelers", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const parsed = CreateTravelerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const limit = await checkLimit(userId, "travelers");
  if (!limit.ok) {
    res.status(402).json(limitExceededResponse(limit));
    return;
  }
  const [row] = await db
    .insert(travelersTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(formatTraveler(row));
});

// PUT /travelers/:id
router.put("/travelers/:id", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const params = UpdateTravelerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateTravelerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(travelersTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(
      and(
        eq(travelersTable.id, params.data.id),
        eq(travelersTable.userId, userId)
      )
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Traveler not found" });
    return;
  }
  res.json(formatTraveler(row));
});

// DELETE /travelers/:id
router.delete("/travelers/:id", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const params = UpdateTravelerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(travelersTable)
    .where(
      and(
        eq(travelersTable.id, params.data.id),
        eq(travelersTable.userId, userId)
      )
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Traveler not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
