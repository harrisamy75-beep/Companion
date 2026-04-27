import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db, preferencesTable, favoritePropertiesTable } from "@workspace/db";
import { lookupPlace, type PlaceLookup } from "../lib/places-lookup.js";

const router = Router();

function buildClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) return new Anthropic({ apiKey: key });
  const baseURL = process.env.ANTHROPIC_BASE_URL;
  const proxyKey = process.env.REPLIT_AI_ANTHROPIC_API_KEY;
  if (proxyKey) return new Anthropic({ apiKey: proxyKey, ...(baseURL ? { baseURL } : {}) });
  return null;
}

// ---------------------------------------------------------------------------
// URL → display-name extraction
// "https://www.melia.com/.../villa-agrippina-gran-melia" → "Villa Agrippina Gran Melia"
// Plain hotel name passes through unchanged.
// ---------------------------------------------------------------------------
function extractDisplayName(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  const looksLikeUrl =
    /^https?:\/\//i.test(trimmed) ||
    /^www\./i.test(trimmed) ||
    /^[a-z0-9-]+\.(com|net|org|co|io|travel|hotel)/i.test(trimmed);

  if (!looksLikeUrl) return trimmed;

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return url.hostname.replace(/^www\./, "");

    // Prefer the last meaningful segment, falling back to the longest.
    const candidate =
      segments[segments.length - 1] ||
      segments.sort((a, b) => b.length - a.length)[0];

    const cleaned = candidate
      .replace(/\.(html?|php|aspx?)$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

    return cleaned || trimmed;
  } catch {
    return trimmed;
  }
}

// ---------------------------------------------------------------------------
// Fuzzy match against the user's saved favourite properties.
// Returns true if the query overlaps meaningfully with a favourite's name
// or brand (substring or 2+ shared tokens of length ≥3).
// ---------------------------------------------------------------------------
function normalize(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface FavoriteLike {
  propertyName: string | null;
  brand?: string | null;
}

function isLovedPropertyMatch(query: string, favorites: FavoriteLike[]): boolean {
  const q = normalize(query);
  if (!q) return false;
  const qTokens = new Set(q.split(" ").filter((t) => t.length >= 3));

  for (const fav of favorites) {
    const name = normalize(fav.propertyName);
    const brand = normalize(fav.brand);

    if (name && name.length >= 4) {
      if (q.includes(name) || name.includes(q)) return true;
    }
    if (brand && brand.length >= 4) {
      if (q.includes(brand) || brand.includes(q)) return true;
    }

    const favTokens = new Set(
      [...name.split(" "), ...brand.split(" ")].filter((t) => t.length >= 3)
    );
    let shared = 0;
    for (const t of qTokens) if (favTokens.has(t)) shared += 1;
    if (shared >= 2) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Match tier — copy that sits above the big score number on the dashboard.
// ---------------------------------------------------------------------------
function tierFromScore(
  score: number,
  avoid: boolean,
  styleMismatch: boolean
): { tier: "avoid" | "mismatch" | "strong" | "good" | "weak"; label: string } {
  if (avoid) return { tier: "avoid", label: "Avoid — guests warn against this" };
  if (styleMismatch) return { tier: "mismatch", label: "Popular, but wrong for your style" };
  if (score >= 95) return { tier: "strong", label: "Exceptional match" };
  if (score >= 85) return { tier: "strong", label: "Strong match" };
  if (score >= 70) return { tier: "good", label: "Good match with some gaps" };
  if (score >= 50) return { tier: "good", label: "Partial match" };
  return { tier: "weak", label: "Poor match for your style" };
}

// ---------------------------------------------------------------------------
// AVOID warning rule — a property is flagged AVOID when guests have spoken
// loudly and unfavourably. We need a reasonable sample (≥30 reviews) so we
// don't penalise small boutiques unfairly.
// ---------------------------------------------------------------------------
function avoidReason(place: PlaceLookup | null): string | null {
  if (!place || place.rating === null) return null;
  const reviews = place.userRatingsTotal ?? 0;
  if (reviews < 30) return null;
  if (place.rating < 3.5) {
    return `Google rating ${place.rating.toFixed(1)}/5 across ${reviews.toLocaleString()} reviews — well below acceptable.`;
  }
  if (place.rating < 3.8 && reviews >= 200) {
    return `Google rating ${place.rating.toFixed(1)}/5 across ${reviews.toLocaleString()} reviews — too many guests are unhappy.`;
  }
  return null;
}

router.post("/reviews/quick-match", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const { query, hotelStarRating, guestScore } = req.body as {
    query?: string;
    hotelStarRating?: number | string | null;
    guestScore?: number | string | null;
  };

  const parsedStar = (() => {
    const n = parseInt(String(hotelStarRating ?? ""), 10);
    return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
  })();
  const parsedGuestScore = (() => {
    const n = parseFloat(String(guestScore ?? ""));
    return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
  })();

  if (!query?.trim()) {
    res.status(400).json({ error: "query required" });
    return;
  }

  // Fetch preferences, favourites, and live Google data in parallel.
  const [prefRows, favorites, place] = await Promise.all([
    db.select().from(preferencesTable).where(eq(preferencesTable.userId, userId)).limit(1),
    db.select().from(favoritePropertiesTable).where(eq(favoritePropertiesTable.userId, userId)),
    lookupPlace(query),
  ]);

  // Merge both style columns (legacy text[] + new jsonb), dedup, drop empties.
  const prefs = prefRows[0] ?? null;
  const travelStyles: string[] = Array.from(new Set([
    ...(Array.isArray(prefs?.travelStyleTags) ? (prefs!.travelStyleTags as string[]) : []),
    ...(Array.isArray(prefs?.travelStyles) ? (prefs!.travelStyles as string[]) : []),
  ])).filter(Boolean);

  // Top styles get prominent treatment in the prompt so the explanation
  // references what the traveller cares about most rather than every tag.
  const topStyles = travelStyles.slice(0, 5);
  const remainingStyles = travelStyles.slice(5);
  const styleDesc =
    travelStyles.length > 0
      ? topStyles.length === travelStyles.length
        ? topStyles.join(", ")
        : `PRIMARY: ${topStyles.join(", ")}; ALSO: ${remainingStyles.slice(0, 5).join(", ")}`
      : "no travel style preferences set";

  const personality: string | null = (req as any).session?.personality ?? null;
  // Prefer Google's resolved name once we have a real place, otherwise fall
  // back to the URL-cleaned name from the user input.
  const displayName = place?.name ?? extractDisplayName(query);
  const lovedPropertyMatch = isLovedPropertyMatch(query, favorites);

  const client = buildClient();
  if (!client) {
    res.status(503).json({ error: "AI service not configured" });
    return;
  }

  // If Google says rating < 3.5 with a meaningful sample, treat as AVOID
  // regardless of what Claude returns. This is the "Grand Sirenes" safety net.
  const avoid = avoidReason(place);

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: `You are a luxury travel concierge. Given a hotel or destination, REAL guest review data (when available), and a traveler's preferences, return ONLY valid JSON with no other text:
{
  "score": number (0-100 match),
  "tags": string[] (2-3 short descriptive words),
  "headline": string (max 20 words, specific and evocative, no quotes),
  "score_explanation": string (max 2 sentences, total under 45 words; lead with what matched the traveler's PRIMARY styles, then what held it back),
  "score_breakdown": {
    "luxury_value":     { "score": number 1-10, "reason": string (max 8 words) },
    "foodie":           { "score": number 1-10, "reason": string (max 8 words) },
    "eco":              { "score": number 1-10, "reason": string (max 8 words) },
    "adventurous_menu": { "score": number 1-10, "reason": string (max 8 words) }
  }
}

CRITICAL — when REAL Google review data is provided, ground EVERY judgement in that data. Do NOT default to your training-set impression of the brand. Read the review snippets carefully — recurring complaints (timeshare pressure, cleanliness, bait-and-switch, dated rooms, food quality, service) directly cap luxury_value and overall score.

Google rating → score floor:
- ≥ 4.7 with ≥500 reviews: world-class. luxury_value 9-10. Overall 85+.
- 4.4–4.6: strong. luxury_value 7-9. Overall 70-90 depending on style fit.
- 4.0–4.3: solid mid-tier. luxury_value 5-7. Overall 55-75.
- 3.7–3.9: mediocre. luxury_value 3-5. Overall 35-55. Mention specific complaints.
- 3.5–3.6: weak. luxury_value 2-4. Overall 25-40. Mention specific complaints.
- < 3.5 with ≥30 reviews: AVOID territory. luxury_value 1-2. Overall 5-25. Quote the worst recurring theme in score_explanation.

Hotel-class ladder (use ONLY when no Google data is provided):
- 5-star luxury brand (Aman, Rosewood, Four Seasons, Ritz-Carlton, St. Regis, Park Hyatt, Bvlgari, Mandarin Oriental, Belmond, Cheval Blanc, Capella): luxury_value 9-10. Overall 80+ for luxury-leaning travelers.
- 5-star upscale (Waldorf Astoria, Conrad, JW Marriott, Grand Hyatt, W Hotels, Andaz, EDITION, 1 Hotels, Soho House, NoMad, Faena, The Standard, Ace, Design Hotels collection): luxury_value 7-8. Overall 65-85 for luxury-leaning travelers.
- 4-star full service (Marriott, Hilton, Hyatt Regency, Westin, Sheraton, Renaissance, Le Méridien, Kimpton): luxury_value 5-6. Overall 50-65.
- 3-star select service (Courtyard, Hampton Inn, Hyatt Place, Aloft, Hilton Garden Inn, Fairfield Inn, Residence Inn, Holiday Inn Resort): luxury_value 3-4. Overall 40-55.
- 2-star / budget chains: luxury_value 1-2. Overall 25-45.

Score 80+ ONLY for strong matches with strong supporting data. Be honest — a poor match should score 30-50, an actively bad property should score below 30. Do not inflate.

Location calibration:
- Hollywood Blvd corridor, airport, highway, strip-mall locations: -2 luxury_value, -5 overall
- Premium locations (Beverly Hills, Malibu, Palm Beach, Aspen, Hamptons, Mayfair, St-Germain): +1 luxury_value, +3 overall
- Beach / mountain / destination resort: neutral to +1`,
      messages: [
        {
          role: "user",
          content: (() => {
            const lines: string[] = [
              `Hotel or destination: ${displayName}`,
              `Traveler's style: ${styleDesc}`,
            ];
            if (personality) lines.push(`Personality: ${personality}`);

            // Prefer authoritative Google data over user-entered values.
            if (place) {
              lines.push("");
              lines.push("REAL Google review data for this property:");
              if (place.formattedAddress) lines.push(`- Address: ${place.formattedAddress}`);
              if (place.rating !== null) {
                lines.push(`- Google rating: ${place.rating.toFixed(1)}/5${place.userRatingsTotal ? ` (${place.userRatingsTotal.toLocaleString()} reviews)` : ""}`);
              }
              if (place.priceLevel !== null) {
                lines.push(`- Google price level: ${"$".repeat(Math.max(1, place.priceLevel))} (0-4 scale, ${place.priceLevel}/4)`);
              }
              if (place.editorialSummary) {
                lines.push(`- Editorial summary: ${place.editorialSummary}`);
              }
              if (place.reviews.length > 0) {
                lines.push("");
                lines.push("Recent guest review snippets (most recent first):");
                place.reviews.forEach((rv, i) => {
                  const stars = rv.rating ? `${rv.rating}/5` : "?/5";
                  const when = rv.relativeTime ? ` (${rv.relativeTime})` : "";
                  lines.push(`${i + 1}. [${stars}${when}] "${rv.text}"`);
                });
              }
              lines.push("");
              lines.push("Ground your scoring in this real data. Quote specific themes from the reviews in your explanation.");
            } else {
              if (parsedStar !== null) lines.push(`Hotel star rating: ${parsedStar} stars`);
              if (parsedGuestScore !== null) lines.push(`Guest review score: ${parsedGuestScore.toFixed(1)}/10`);
            }

            const lovedBench = favorites
              .filter((f) => f.tier === "loved" && (f.starRating || f.pricePerNight))
              .slice(0, 6)
              .map((f) => {
                const bits: string[] = [];
                if (f.starRating) bits.push(`${f.starRating} star${f.starRating === 1 ? "" : "s"}`);
                if (f.pricePerNight) bits.push(`~$${f.pricePerNight}/night`);
                return `- ${f.propertyName}${f.location ? ` (${f.location})` : ""}${bits.length ? ` — ${bits.join(", ")}` : ""}`;
              });
            if (lovedBench.length > 0) {
              lines.push("");
              lines.push("This user's loved properties (use as a benchmark for what they consider a strong match):");
              lines.push(...lovedBench);
              lines.push("Score the new property relative to this benchmark.");
            }

            return lines.join("\n");
          })(),
        },
      ],
    });

    const raw = (message.content[0] as { type: string; text: string }).text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    const cat = (key: string) => {
      const e = parsed.score_breakdown?.[key];
      const s = Math.min(10, Math.max(1, Math.round(Number(e?.score) || 5)));
      const r = typeof e?.reason === "string" ? e.reason.slice(0, 80) : "";
      return { score: s, reason: r };
    };

    const luxuryValue = cat("luxury_value");
    const foodie = cat("foodie");
    const eco = cat("eco");
    const adventurousMenu = cat("adventurous_menu");

    const luxWeight = travelStyles.includes("luxury") ? 1.0 : 0.8;
    const foodieWeight = travelStyles.includes("foodie") ? 1.0 : 0.2;
    const ecoWeight = travelStyles.includes("eco") ? 1.0 : 0.2;
    const advWeight = travelStyles.includes("adventurous_menu") ? 1.0 : 0.2;

    const scoreBreakdown = {
      luxuryValue: { ...luxuryValue, weight: luxWeight, contribution: Number((luxuryValue.score * luxWeight).toFixed(1)) },
      foodie: { ...foodie, weight: foodieWeight, contribution: Number((foodie.score * foodieWeight).toFixed(1)) },
      eco: { ...eco, weight: ecoWeight, contribution: Number((eco.score * ecoWeight).toFixed(1)) },
      adventurousMenu: { ...adventurousMenu, weight: advWeight, contribution: Number((adventurousMenu.score * advWeight).toFixed(1)) },
    };

    const whatWorked: string[] = [];
    const whatHeldItBack: string[] = [];
    if (luxuryValue.score >= 7) whatWorked.push(luxuryValue.reason || "Strong luxury-value");
    else if (luxuryValue.score <= 4) whatHeldItBack.push(luxuryValue.reason || "Luxury-value off");
    if (travelStyles.includes("foodie")) {
      if (foodie.score >= 7) whatWorked.push(foodie.reason || "Excellent food");
      else if (foodie.score <= 4) whatHeldItBack.push(foodie.reason || "Food underwhelms");
    }
    if (travelStyles.includes("eco")) {
      if (eco.score >= 7) whatWorked.push(eco.reason || "Strong eco practices");
      else if (eco.score <= 4) whatHeldItBack.push(eco.reason || "Limited eco focus");
    }
    if (travelStyles.includes("adventurous_menu")) {
      if (adventurousMenu.score >= 7) whatWorked.push(adventurousMenu.reason || "Adventurous menu");
      else if (adventurousMenu.score <= 4) whatHeldItBack.push(adventurousMenu.reason || "Menu plays it safe");
    }

    // Apply the +15 loved-property bonus AFTER Claude scores so it's
    // additive recognition, not a thumb on the model's scale.
    const baseScore = Math.min(100, Math.max(0, Math.round(Number(parsed.score) || 72)));
    let finalScore = lovedPropertyMatch ? Math.min(100, baseScore + 15) : baseScore;

    // AVOID safety net: cap the score hard so the UI cannot show a "good
    // match" for a property the data clearly says to avoid.
    if (avoid) {
      finalScore = Math.min(finalScore, 20);
    }

    // STYLE MISMATCH: the property is well-rated by the public (Google ≥ 4.0
    // with ≥100 reviews) but scores poorly for THIS traveller's style. This
    // is the "popular all-inclusive vs. luxury-leaning guest" case.
    const styleMismatch =
      !avoid &&
      finalScore < 45 &&
      !!place &&
      place.rating !== null &&
      place.rating >= 4.0 &&
      (place.userRatingsTotal ?? 0) >= 100;

    const styleMismatchReason = styleMismatch
      ? `Loved by the general public (${place!.rating!.toFixed(1)}/5 across ${place!.userRatingsTotal!.toLocaleString()} reviews) but the vibe doesn't fit your travel style.`
      : null;

    const tier = tierFromScore(finalScore, !!avoid, styleMismatch);

    // Cap explanation copy to ~45 words / 2 sentences as a server-side
    // safety net even if Claude over-writes.
    const trimToTwoSentences = (s: string): string => {
      const sentences = s.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
      return sentences.length > 280 ? sentences.slice(0, 277).trimEnd() + "…" : sentences;
    };
    const trimToWords = (s: string, n: number): string => {
      const words = s.split(/\s+/);
      return words.length <= n ? s : words.slice(0, n).join(" ").replace(/[,;:.\-–—]+$/, "");
    };

    res.json({
      score: finalScore,
      displayName,
      lovedPropertyMatch,
      matchTier: tier.tier,
      matchTierLabel: tier.label,
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : [],
      headline:
        typeof parsed.headline === "string"
          ? trimToWords(parsed.headline, 20)
          : "Matches your travel style",
      scoreExplanation:
        typeof parsed.score_explanation === "string"
          ? trimToTwoSentences(parsed.score_explanation)
          : "",
      scoreBreakdown,
      whatWorked: whatWorked.slice(0, 3),
      whatHeldItBack: whatHeldItBack.slice(0, 3),
      userTags: travelStyles,
      // New: real Google data for the UI to display + AVOID warning
      googleRating: place?.rating ?? null,
      googleReviewCount: place?.userRatingsTotal ?? null,
      googleAddress: place?.formattedAddress ?? null,
      avoidWarning: avoid,
      styleMismatch,
      styleMismatchReason,
      dataSource: place ? "google_reviews" : "ai_only",
    });
  } catch (err) {
    console.error("Quick match failed:", err);
    res.status(500).json({ error: "Failed to generate match" });
  }
});

export default router;
