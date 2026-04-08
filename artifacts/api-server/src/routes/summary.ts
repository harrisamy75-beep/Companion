import { Router, type IRouter } from "express";
import { db, childrenTable, preferencesTable } from "@workspace/db";
import { formatChild } from "./children";

const router: IRouter = Router();

router.get("/summary", async (_req, res): Promise<void> => {
  const [childrenRows, prefRows] = await Promise.all([
    db.select().from(childrenTable).orderBy(childrenTable.createdAt),
    db.select().from(preferencesTable).limit(1),
  ]);

  const children = childrenRows.map(formatChild);
  const preferences = prefRows.length > 0 ? prefRows[0] : null;
  const hasPreferences = preferences !== null && preferences.id !== 0;

  res.json({
    children,
    preferences: preferences ?? { id: 0 },
    totalTravelers: children.length,
    hasPreferences,
  });
});

export default router;
