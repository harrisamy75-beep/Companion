import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, childrenTable } from "@workspace/db";
import {
  CreateChildBody,
  UpdateChildBody,
  UpdateChildParams,
  DeleteChildParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function computeAge(birthdate: string): { ageYears: number; ageMonths: number; ageDisplay: string } {
  const birth = new Date(birthdate);
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

function formatChild(child: { id: number; name: string; birthdate: string }) {
  const age = computeAge(child.birthdate);
  return {
    id: child.id,
    name: child.name,
    birthdate: child.birthdate,
    ...age,
  };
}

router.get("/children", async (_req, res): Promise<void> => {
  const rows = await db.select().from(childrenTable).orderBy(childrenTable.createdAt);
  res.json(rows.map(formatChild));
});

router.post("/children", async (req, res): Promise<void> => {
  const parsed = CreateChildBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [child] = await db.insert(childrenTable).values(parsed.data).returning();
  res.status(201).json(formatChild(child));
});

router.put("/children/:id", async (req, res): Promise<void> => {
  const params = UpdateChildParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateChildBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [child] = await db
    .update(childrenTable)
    .set(parsed.data)
    .where(eq(childrenTable.id, params.data.id))
    .returning();

  if (!child) {
    res.status(404).json({ error: "Child not found" });
    return;
  }

  res.json(formatChild(child));
});

router.delete("/children/:id", async (req, res): Promise<void> => {
  const params = DeleteChildParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [child] = await db
    .delete(childrenTable)
    .where(eq(childrenTable.id, params.data.id))
    .returning();

  if (!child) {
    res.status(404).json({ error: "Child not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
export { computeAge, formatChild };
