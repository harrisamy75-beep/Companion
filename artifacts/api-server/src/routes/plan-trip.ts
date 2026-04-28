import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import {
  db,
  preferencesTable,
  travelersTable,
  childrenTable,
  favoritePropertiesTable,
  loyaltyProgramsTable,
} from "@workspace/db";

const router: IRouter = Router();

function buildClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) return new Anthropic({ apiKey: key });
  const baseURL = process.env.ANTHROPIC_BASE_URL;
  const proxyKey = process.env.REPLIT_AI_ANTHROPIC_API_KEY;
  if (proxyKey) return new Anthropic({ apiKey: proxyKey, ...(baseURL ? { baseURL } : {}) });
  return null;
}

interface PlanTripBody {
  destination?: string;
  checkIn?: string;
  checkOut?: string;
  perNightBudget?: number | string | null;
  totalBudget?: number | string | null;
  rooms?: number | string | null;
}

interface RecommendedHotel {
  name: string;
  location: string;
  whyMatches: string;
  nightlyRate: string;
  matchScore: number;
}

function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

function nightsBetween(checkIn: string, checkOut: string): number | null {
  const ci = new Date(checkIn);
  const co = new Date(checkOut);
  if (Number.isNaN(ci.getTime()) || Number.isNaN(co.getTime())) return null;
  const diff = Math.round((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : null;
}

router.post("/plan-trip", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const {
    destination,
    checkIn,
    checkOut,
    perNightBudget,
    totalBudget,
    rooms,
  } = req.body as PlanTripBody;

  if (!destination?.trim()) {
    res.status(400).json({ error: "destination required" });
    return;
  }

  const parsedRooms = (() => {
    const n = parseInt(String(rooms ?? "1"), 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  })();
  const parsedPerNight = (() => {
    const n = parseFloat(String(perNightBudget ?? ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  })();
  const parsedTotal = (() => {
    const n = parseFloat(String(totalBudget ?? ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  })();

  // Pull all profile context in parallel. Each query is isolated so a missing
  // table or transient error degrades gracefully rather than failing the whole
  // request.
  const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await p;
    } catch (err) {
      console.warn("[plan-trip] profile query failed, using fallback:", err instanceof Error ? err.message : err);
      return fallback;
    }
  };

  const [prefRows, travelers, kids, favorites, loyalty] = await Promise.all([
    safe(db.select().from(preferencesTable).where(eq(preferencesTable.userId, userId)).limit(1), [] as any[]),
    safe(db.select().from(travelersTable).where(eq(travelersTable.userId, userId)), [] as any[]),
    safe(db.select().from(childrenTable).where(eq(childrenTable.userId, userId)), [] as any[]),
    safe(db.select().from(favoritePropertiesTable).where(eq(favoritePropertiesTable.userId, userId)), [] as any[]),
    safe(db.select().from(loyaltyProgramsTable).where(eq(loyaltyProgramsTable.userId, userId)), [] as any[]),
  ]);

  const prefs = prefRows[0] ?? null;

  const travelStyles: string[] = Array.from(new Set([
    ...(Array.isArray(prefs?.travelStyleTags) ? (prefs!.travelStyleTags as string[]) : []),
    ...(Array.isArray(prefs?.travelStyles) ? (prefs!.travelStyles as string[]) : []),
  ])).filter(Boolean);

  const adults = travelers.filter((t) => t.travelerType === "adult");
  const adultsCount = adults.length || 1;
  const childAges = kids
    .map((k) => ageFromBirthDate(k.birthdate))
    .filter((n): n is number => n !== null);
  const adultAges = adults
    .map((t) => ageFromBirthDate(t.birthDate))
    .filter((n): n is number => n !== null);

  const lovedFavorites = favorites.filter((f) => f.tier === "loved");
  const avoidedFavorites = favorites.filter((f) => f.tier === "avoid");

  const client = buildClient();
  if (!client) {
    res.status(503).json({
      error: "Trip planning is temporarily unavailable. Please try again later.",
    });
    return;
  }

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : null;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: `You are a luxury travel concierge curating a personalised hotel shortlist.

Return ONLY valid JSON, no other text. Schema:
{
  "hotels": [
    {
      "name": string (real, currently-operating hotel — no invented properties),
      "location": string (neighbourhood, city),
      "why_matches": string (ONE sentence, max 28 words, specific to THIS traveller's profile — reference their styles, party composition, loved properties, or loyalty programs by name where relevant),
      "nightly_rate": string (estimated rate as "$XXX" or "$XXX-$YYY" in USD),
      "match_score": number (1-10, how well this hotel fits the traveller's profile)
    }
  ]
}

Return EXACTLY 5 hotels. They MUST:
- Be real, currently-operating hotels in or near the requested destination.
- Genuinely match the traveller's PRIMARY travel styles and party composition.
- Respect the per-night budget the traveller provided (most picks within budget; at most one stretch property if it's an exceptional match).
- Avoid any property the traveller has marked as AVOID, and avoid that style of property.
- Where the traveller has a relevant loyalty program, prefer hotels in that brand portfolio when quality is comparable, and reference the program in why_matches.
- Reference loved properties as a benchmark in why_matches when stylistically relevant.
- For families with children, factor in age-appropriate amenities (kids' clubs, family suites, pools, beach) when children are in the party.

Order the array by match_score descending. Be honest — if no hotel in the destination is a perfect fit, score accordingly (don't inflate everything to 9-10).`,
      messages: [
        {
          role: "user",
          content: (() => {
            const lines: string[] = [];
            lines.push(`DESTINATION: ${destination.trim()}`);
            if (checkIn && checkOut) {
              lines.push(`DATES: ${checkIn} → ${checkOut}${nights ? ` (${nights} night${nights === 1 ? "" : "s"})` : ""}`);
            }
            lines.push(`ROOMS: ${parsedRooms}`);
            if (parsedPerNight !== null) lines.push(`PER-NIGHT BUDGET: $${parsedPerNight.toLocaleString()} USD`);
            if (parsedTotal !== null) lines.push(`TOTAL TRIP BUDGET: $${parsedTotal.toLocaleString()} USD`);

            lines.push("");
            lines.push("--- TRAVELLER PROFILE ---");
            lines.push(`Adults: ${adultsCount}${adultAges.length ? ` (ages ${adultAges.join(", ")})` : ""}`);
            if (childAges.length > 0) {
              lines.push(`Children: ${childAges.length} (ages ${childAges.join(", ")})`);
            } else if (kids.length > 0) {
              lines.push(`Children: ${kids.length}`);
            }

            if (travelStyles.length > 0) {
              lines.push(`Travel styles: ${travelStyles.join(", ")}`);
            }
            if (prefs?.luxuryIndexMin && prefs?.luxuryIndexMax) {
              lines.push(`Luxury index target: ${prefs.luxuryIndexMin}-${prefs.luxuryIndexMax} / 10`);
            }
            if (prefs?.valuePhilosophy) {
              lines.push(`Value philosophy: ${prefs.valuePhilosophy}`);
            }
            if (Array.isArray(prefs?.worthSplurgingOn) && prefs!.worthSplurgingOn!.length > 0) {
              lines.push(`Worth splurging on: ${(prefs!.worthSplurgingOn as string[]).join(", ")}`);
            }
            if (Array.isArray(prefs?.happyToSaveOn) && prefs!.happyToSaveOn!.length > 0) {
              lines.push(`Happy to save on: ${(prefs!.happyToSaveOn as string[]).join(", ")}`);
            }
            if (prefs?.hotelPreferences) {
              lines.push(`Hotel preferences: ${prefs.hotelPreferences}`);
            }
            if (prefs?.accessibilityNeeds) {
              lines.push(`Accessibility: ${prefs.accessibilityNeeds}`);
            }

            if (loyalty.length > 0) {
              lines.push("");
              lines.push("LOYALTY PROGRAMS (prefer these brands when quality is comparable):");
              for (const l of loyalty) {
                const tier = l.tier ? ` — ${l.tier}` : "";
                lines.push(`- ${l.brand}: ${l.programName}${tier}`);
              }
            }

            if (lovedFavorites.length > 0) {
              lines.push("");
              lines.push("LOVED properties (positive style benchmark):");
              for (const f of lovedFavorites.slice(0, 8)) {
                const bits: string[] = [];
                if (f.starRating) bits.push(`${f.starRating}★`);
                if (f.pricePerNight) bits.push(`~$${f.pricePerNight}/night`);
                const note = (f.notes ?? "").trim().slice(0, 80);
                lines.push(`- ${f.propertyName}${f.location ? ` (${f.location})` : ""}${bits.length ? ` — ${bits.join(", ")}` : ""}${note ? ` — "${note}"` : ""}`);
              }
            }

            if (avoidedFavorites.length > 0) {
              lines.push("");
              lines.push("AVOIDED properties (do NOT recommend these or similar):");
              for (const f of avoidedFavorites.slice(0, 6)) {
                lines.push(`- ${f.propertyName}${f.location ? ` (${f.location})` : ""}`);
              }
            }

            lines.push("");
            lines.push("Return the 5-hotel JSON shortlist now.");
            return lines.join("\n");
          })(),
        },
      ],
    });

    const text = message.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();

    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      res.status(502).json({ error: "Recommendation service returned an unexpected response." });
      return;
    }

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as {
      hotels?: Array<{
        name?: string;
        location?: string;
        why_matches?: string;
        nightly_rate?: string;
        match_score?: number;
      }>;
    };

    const hotels: RecommendedHotel[] = (parsed.hotels ?? [])
      .filter((h) => h.name && h.location)
      .map((h) => ({
        name: String(h.name).trim(),
        location: String(h.location).trim(),
        whyMatches: String(h.why_matches ?? "").trim(),
        nightlyRate: String(h.nightly_rate ?? "").trim(),
        matchScore: Math.max(1, Math.min(10, Math.round(Number(h.match_score) || 7))),
      }))
      .slice(0, 5);

    if (hotels.length === 0) {
      res.status(502).json({ error: "No recommendations could be generated. Please try a different destination." });
      return;
    }

    res.json({
      hotels,
      profileSummary: {
        adults: adultsCount,
        children: childAges.length || kids.length,
        travelStyles,
        loyaltyCount: loyalty.length,
        lovedCount: lovedFavorites.length,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Failed to generate recommendations: ${msg}` });
  }
});

export default router;
