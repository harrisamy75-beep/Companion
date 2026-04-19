import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db, preferencesTable, favoritePropertiesTable } from "@workspace/db";

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
function tierFromScore(score: number): { tier: "strong" | "good" | "weak"; label: string } {
  if (score >= 80) return { tier: "strong", label: "Strong match for your travel style" };
  if (score >= 60) return { tier: "good", label: "Good match with some gaps" };
  return { tier: "weak", label: "May not suit your style" };
}

router.post("/reviews/quick-match", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const { query } = req.body as { query?: string };

  if (!query?.trim()) {
    res.status(400).json({ error: "query required" });
    return;
  }

  // Fetch preferences and favourites in parallel.
  const [prefRows, favorites] = await Promise.all([
    db.select().from(preferencesTable).where(eq(preferencesTable.userId, userId)).limit(1),
    db.select().from(favoritePropertiesTable).where(eq(favoritePropertiesTable.userId, userId)),
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
  const displayName = extractDisplayName(query);
  const lovedPropertyMatch = isLovedPropertyMatch(query, favorites);

  const client = buildClient();
  if (!client) {
    res.status(503).json({ error: "AI service not configured" });
    return;
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: `You are a luxury travel concierge. Given a hotel or destination and a traveler's preferences, return ONLY valid JSON with no other text:
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
Score 80+ only for strong matches. Be honest — a poor match should score 30-50. Weight your reasoning toward the traveller's PRIMARY styles (listed first), not every tag equally.`,
      messages: [
        {
          role: "user",
          content: `Hotel or destination: ${displayName}\nTraveler's style: ${styleDesc}${personality ? `\nPersonality: ${personality}` : ""}`,
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
    const finalScore = lovedPropertyMatch ? Math.min(100, baseScore + 15) : baseScore;
    const tier = tierFromScore(finalScore);

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
    });
  } catch (err) {
    console.error("Quick match failed:", err);
    res.status(500).json({ error: "Failed to generate match" });
  }
});

export default router;
