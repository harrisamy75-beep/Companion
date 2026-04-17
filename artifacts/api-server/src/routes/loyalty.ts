import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, loyaltyProgramsTable } from "@workspace/db";
import { checkLimit, limitExceededResponse } from "../lib/plan-limits";

const router: IRouter = Router();

type LoyaltyProgramDef = {
  brand: string;
  program: string;
  tier_type: string;
  tiers?: string[];
};

export const LOYALTY_PROGRAMS: LoyaltyProgramDef[] = [
  // Ultra Luxury (no traditional points)
  { brand: "Aman", program: "Aman", tier_type: "ultra_luxury" },
  { brand: "Rosewood", program: "Rosewood Sense", tier_type: "ultra_luxury" },
  { brand: "Four Seasons", program: "Four Seasons Preferred Partner", tier_type: "ultra_luxury" },
  { brand: "Belmond", program: "Belmond Bellini Club", tier_type: "ultra_luxury" },
  { brand: "Auberge", program: "Auberge Rewards", tier_type: "ultra_luxury" },
  { brand: "Oetker Collection", program: "Oetker Collection", tier_type: "ultra_luxury" },
  { brand: "Relais & Chateaux", program: "Relais & Chateaux", tier_type: "ultra_luxury" },
  { brand: "Small Luxury Hotels", program: "SLH INVITED", tier_type: "ultra_luxury" },
  { brand: "Leading Hotels", program: "Leaders Club", tier_type: "ultra_luxury" },
  { brand: "Six Senses", program: "Six Senses", tier_type: "ultra_luxury" },
  { brand: "Banyan Tree", program: "Banyan Tree Sanctuary", tier_type: "ultra_luxury" },
  { brand: "Soneva", program: "Soneva", tier_type: "ultra_luxury" },
  { brand: "Mandarin Oriental", program: "Fans of M.O.", tier_type: "ultra_luxury" },
  { brand: "Peninsula", program: "Peninsula Pages", tier_type: "ultra_luxury" },
  { brand: "Cheval Blanc", program: "Cheval Blanc", tier_type: "ultra_luxury" },

  // Luxury Points Programs
  { brand: "Hyatt", program: "World of Hyatt", tier_type: "luxury_points",
    tiers: ["Member", "Discoverist", "Explorist", "Globalist"] },
  { brand: "Marriott", program: "Marriott Bonvoy", tier_type: "luxury_points",
    tiers: ["Member", "Silver Elite", "Gold Elite", "Platinum Elite", "Titanium Elite", "Ambassador Elite"] },
  { brand: "Hilton", program: "Hilton Honors", tier_type: "luxury_points",
    tiers: ["Member", "Silver", "Gold", "Diamond"] },
  { brand: "IHG", program: "IHG One Rewards", tier_type: "luxury_points",
    tiers: ["Club", "Silver Elite", "Gold Elite", "Platinum Elite", "Spire Elite"] },
  { brand: "Accor", program: "ALL - Accor Live Limitless", tier_type: "luxury_points",
    tiers: ["Classic", "Silver", "Gold", "Platinum", "Diamond"] },
  { brand: "Wyndham", program: "Wyndham Rewards", tier_type: "luxury_points",
    tiers: ["Blue", "Gold", "Platinum", "Diamond"] },
  { brand: "Choice Hotels", program: "Choice Privileges", tier_type: "luxury_points",
    tiers: ["Member", "Gold", "Platinum", "Diamond"] },
  { brand: "Best Western", program: "Best Western Rewards", tier_type: "luxury_points",
    tiers: ["Member", "Gold", "Platinum", "Diamond", "Diamond Select"] },
  { brand: "Radisson", program: "Radisson Rewards", tier_type: "luxury_points",
    tiers: ["Club", "Silver", "Gold", "Platinum"] },

  // Boutique & Lifestyle
  { brand: "Soho House", program: "Soho House Membership", tier_type: "boutique" },
  { brand: "Firmdale", program: "Firmdale Hotels", tier_type: "boutique" },
  { brand: "Montage", program: "Montage Meaningful Moments", tier_type: "boutique" },
  { brand: "Pendry", program: "Pendry Preferred", tier_type: "boutique" },
  { brand: "Kimpton", program: "IHG One Rewards (Kimpton)", tier_type: "boutique" },
  { brand: "Ace Hotel", program: "Ace Hotel", tier_type: "boutique" },
  { brand: "Graduate Hotels", program: "Graduate Hotels", tier_type: "boutique" },
  { brand: "1 Hotels", program: "1 Hotels", tier_type: "boutique" },
  { brand: "Virgin Hotels", program: "The Know by Virgin Hotels", tier_type: "boutique" },
  { brand: "Nobu Hotels", program: "Nobu Hotels", tier_type: "boutique" },
  { brand: "25hours", program: "25hours Hotels", tier_type: "boutique" },
  { brand: "Mama Shelter", program: "Mama Shelter", tier_type: "boutique" },
  { brand: "citizenM", program: "mycitizenM", tier_type: "boutique" },
  { brand: "Hoxton", program: "The Hoxton", tier_type: "boutique" },
  { brand: "Morgans Originals", program: "Morgans Originals", tier_type: "boutique" },

  // Airlines
  { brand: "American Airlines", program: "AAdvantage", tier_type: "airline",
    tiers: ["Member", "Gold", "Platinum", "Platinum Pro", "Executive Platinum", "Concierge Key"] },
  { brand: "Delta", program: "SkyMiles", tier_type: "airline",
    tiers: ["Member", "Silver Medallion", "Gold Medallion", "Platinum Medallion", "Diamond Medallion"] },
  { brand: "United", program: "MileagePlus", tier_type: "airline",
    tiers: ["Member", "Silver", "Gold", "Platinum", "1K", "Global Services"] },
  { brand: "Southwest", program: "Rapid Rewards", tier_type: "airline",
    tiers: ["Member", "A-List", "A-List Preferred", "Companion Pass"] },
  { brand: "British Airways", program: "Executive Club", tier_type: "airline",
    tiers: ["Blue", "Bronze", "Silver", "Gold"] },
  { brand: "Emirates", program: "Skywards", tier_type: "airline",
    tiers: ["Blue", "Silver", "Gold", "Platinum"] },
  { brand: "Air France / KLM", program: "Flying Blue", tier_type: "airline",
    tiers: ["Explorer", "Silver", "Gold", "Platinum", "Ultimate"] },
  { brand: "Lufthansa", program: "Miles & More", tier_type: "airline",
    tiers: ["Base", "Frequent Traveller", "Senator", "HON Circle"] },
  { brand: "Singapore Airlines", program: "KrisFlyer", tier_type: "airline",
    tiers: ["Member", "Elite Silver", "Elite Gold", "Elite Gold with PPS Club"] },
  { brand: "Qatar Airways", program: "Privilege Club", tier_type: "airline",
    tiers: ["Burgundy", "Silver", "Gold", "Platinum"] },
  { brand: "Alaska Airlines", program: "Mileage Plan", tier_type: "airline",
    tiers: ["Member", "MVP", "MVP Gold", "MVP Gold 75K"] },
  { brand: "JetBlue", program: "TrueBlue", tier_type: "airline",
    tiers: ["Member", "Mosaic 1", "Mosaic 2", "Mosaic 3", "Mosaic 4"] },

  // Credit Card Travel Programs
  { brand: "American Express", program: "Amex Membership Rewards", tier_type: "credit_card" },
  { brand: "Chase", program: "Chase Ultimate Rewards", tier_type: "credit_card" },
  { brand: "Capital One", program: "Capital One Miles", tier_type: "credit_card" },
  { brand: "Citi", program: "Citi ThankYou Rewards", tier_type: "credit_card" },
  { brand: "Bilt", program: "Bilt Rewards", tier_type: "credit_card" },

  // Car Rental
  { brand: "Hertz", program: "Hertz Gold Plus Rewards", tier_type: "car_rental",
    tiers: ["Gold", "Five Star", "President's Circle"] },
  { brand: "Avis", program: "Avis Preferred", tier_type: "car_rental",
    tiers: ["Preferred", "Preferred Plus", "President's Club"] },
  { brand: "Enterprise", program: "Enterprise Plus", tier_type: "car_rental",
    tiers: ["Member", "Silver", "Gold", "Platinum"] },
  { brand: "National", program: "Emerald Club", tier_type: "car_rental",
    tiers: ["Member", "Emerald Club Executive", "Executive Elite"] },
];

const TIER_TYPE_LABELS: Record<string, string> = {
  ultra_luxury: "Ultra Luxury",
  luxury_points: "Luxury Points",
  boutique: "Boutique & Lifestyle",
  airline: "Airlines",
  credit_card: "Credit Cards",
  car_rental: "Car Rental",
};

const TIER_TYPE_ORDER = [
  "ultra_luxury",
  "luxury_points",
  "boutique",
  "airline",
  "credit_card",
  "car_rental",
];

// GET /loyalty/programs — full list grouped by tier_type
router.get("/loyalty/programs", (_req, res): void => {
  const grouped = TIER_TYPE_ORDER.map((tt) => ({
    tier_type: tt,
    label: TIER_TYPE_LABELS[tt],
    programs: LOYALTY_PROGRAMS.filter((p) => p.tier_type === tt),
  })).filter((g) => g.programs.length > 0);
  res.json(grouped);
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
  const limit = await checkLimit(userId, "loyaltyPrograms");
  if (!limit.ok) {
    res.status(402).json(limitExceededResponse(limit));
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
