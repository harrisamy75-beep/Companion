import { Router, type IRouter } from "express";
import { createHash } from "crypto";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db, reviewScoresTable, preferencesTable } from "@workspace/db";
import { ScoreReviewsBody, MatchReviewsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// In-memory rate limiter: max 50 Claude calls per hour per user_id
// ---------------------------------------------------------------------------
const RATE_LIMIT = 50;
const RATE_WINDOW_MS = 60 * 60 * 1000;

interface RateEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateEntry>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: RATE_LIMIT - entry.count };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function clamp(v: unknown): number {
  const n = Number(v);
  if (isNaN(n)) return 5;
  return Math.min(10, Math.max(1, Math.round(n)));
}

const SYSTEM_PROMPT = `You are a travel review classifier. Given a hotel or restaurant review, return only valid JSON with these fields:
{
  "tags": string[],
  "luxury_value_score": number,
  "foodie_score": number,
  "eco_score": number,
  "adventurous_menu_score": number,
  "sentiment": "positive" | "neutral" | "negative",
  "one_line_summary": string,
  "score_explanation": string,
  "score_breakdown": {
    "luxury_value": { "score": number, "reason": string },
    "foodie":       { "score": number, "reason": string },
    "eco":          { "score": number, "reason": string },
    "adventurous_menu": { "score": number, "reason": string }
  }
}

Tags must come only from this list: luxury_value, overpriced, tourist_trap, foodie, adventurous_menu, kids_menu_only, eco_certified, vegetarian_friendly, hiking_nearby, family_friendly, romantic, business, pretentious, worth_every_penny, hidden_gem, stunning_pool, beach_access, private_beach, infinity_pool, ocean_view, mountain_view, garden_grounds, historic_building.

Scoring guidelines:
- luxury_value_score (1-10): High = excellent quality for price (think Rosewood, Palm House). Low = overpriced or budget.
- foodie_score (1-10): High = locally sourced, creative, chef-driven, not a kids menu. Low = generic.
- eco_score (1-10): High = sustainability practices, nature access, eco certifications. Low = no eco focus.
- adventurous_menu_score (1-10): High = unusual ingredients, global cuisine, not safe options. Low = plain/predictable.
- sentiment: overall tone of the review.
- one_line_summary: max 12 words, plain English, no quotes.
- score_explanation: 1-2 sentences explaining the overall pattern. Be specific about what drove scores up and what held them back. e.g. "Strong marks for exceptional food and local sourcing, but pulled back by mentions of inconsistent service and limited beach access." Never mention missing amenities that are irrelevant to the property type or destination (e.g. don't fault a ski lodge for lacking a beach, or a city hotel for lacking a garden).

Amenity preferences like pools, beaches, and views are bonus signals — score higher when reviews mention them matching the user's preferences, but do not reduce scores for their absence. A ski resort without a beach should not be penalized for lacking beach access if the user selected "Sandy Beach" as a preference — context matters. Only reduce scores for amenities when their absence is contextually relevant (e.g. a beach resort with no pool when the user selected "Stunning Pool").

Hotel classification guide for luxury_value_score (use the property name and any review signals):
- 5-star luxury brand (Aman, Rosewood, Four Seasons, Ritz-Carlton, St. Regis, Park Hyatt, Bvlgari, Mandarin Oriental, Belmond, Cheval Blanc, Capella): score 9-10
- 5-star upscale (Waldorf Astoria, Conrad, JW Marriott, Grand Hyatt, W Hotels, Andaz, EDITION, 1 Hotels, Soho House): score 7-8
- 4-star full service (Marriott, Hilton, Hyatt Regency, Westin, Sheraton, Renaissance, Le Méridien, Kimpton): score 5-6
- 3-star select service (Courtyard, Hampton Inn, Hyatt Place, Aloft, Hilton Garden Inn, Fairfield Inn): score 3-4
- 2-star / budget chains (Holiday Inn Express, Comfort Inn, Motel 6, Days Inn, Super 8, Howard Johnson, Rodeway, Econo Lodge, budget Hollywood / Vegas Strip / Times Square hotels): score 1-2
- Boutique independents: judge on review quality signals (design language, service mentions, materials, food program, price-per-night signals).

Review-score signals (when an average guest score is mentioned in the review or known from metadata):
- 9.0–10.0: boost luxury_value_score by +1
- 8.0–8.9: neutral
- 7.0–7.9: reduce luxury_value_score by -1
- below 7.0: reduce luxury_value_score by -2

Location signals:
- Hollywood Blvd budget corridor, airport hotels, highway motels, generic strip-mall locations: reduce score by -2
- Premium city locations (Beverly Hills, Malibu, Palm Beach, Aspen, the Hamptons, Mayfair, St-Germain): boost +1
- Beach / mountain / destination resort locations: neutral to +1

Budget and value context: when the user has indicated a typical nightly budget range or a value philosophy (e.g. "Value Hunter", "Selective Splurger", "Luxury on a Budget", "Considered Spender", "Special Occasion", "No Budget"), use it to interpret the luxury_value_score. Reviews praising "great value", "worth every penny", or "exceptional for the price" should boost luxury_value_score for value-conscious philosophies. Reviews complaining about being "overpriced" or "not worth it" should reduce luxury_value_score, especially harshly for "Value Hunter" / "Luxury on a Budget" users. For "No Budget" or "Special Occasion" users, weight quality and experience signals higher than price-sensitivity signals — do not penalize properties for being expensive if reviews still rave about the experience. Never assume a property is out of budget without explicit price signals in the review.
- score_breakdown: For each of the four categories, mirror the score above and add a short reason (max 8 words). e.g. "Chef-driven menu, locally sourced ingredients noted" or "Generic buffet, no mention of local cuisine".

Return only the JSON object. No explanation, no markdown.`;

type CategoryDetail = { score: number; reason: string };
interface ScoreBreakdown {
  luxury_value: CategoryDetail;
  foodie: CategoryDetail;
  eco: CategoryDetail;
  adventurous_menu: CategoryDetail;
}

interface ScoredResult {
  tags: string[];
  luxuryValueScore: number;
  foodieScore: number;
  ecoScore: number;
  adventurousMenuScore: number;
  sentiment: string;
  oneLineSummary: string;
  scoreExplanation: string;
  scoreBreakdown: ScoreBreakdown;
  raw: object;
}

function neutralBreakdown(): ScoreBreakdown {
  return {
    luxury_value: { score: 5, reason: "" },
    foodie: { score: 5, reason: "" },
    eco: { score: 5, reason: "" },
    adventurous_menu: { score: 5, reason: "" },
  };
}

function neutral(): ScoredResult {
  return {
    luxuryValueScore: 5,
    foodieScore: 5,
    ecoScore: 5,
    adventurousMenuScore: 5,
    sentiment: "neutral",
    oneLineSummary: "",
    scoreExplanation: "",
    scoreBreakdown: neutralBreakdown(),
    tags: [],
    raw: {},
  };
}

function parseBreakdown(raw: any): ScoreBreakdown {
  const b = neutralBreakdown();
  if (!raw || typeof raw !== "object") return b;
  for (const key of ["luxury_value", "foodie", "eco", "adventurous_menu"] as const) {
    const entry = raw[key];
    if (entry && typeof entry === "object") {
      b[key] = {
        score: clamp(entry.score),
        reason: typeof entry.reason === "string" ? entry.reason.slice(0, 80) : "",
      };
    }
  }
  return b;
}

function buildClient(): Anthropic | null {
  // Prefer the user's own direct key (hits api.anthropic.com directly)
  if (process.env.ANTHROPIC_API_KEY) {
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  // Fall back to Replit AI integration proxy
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  if (!apiKey) return null;

  return new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

async function scoreWithClaude(reviewText: string, log: any): Promise<ScoredResult> {
  const client = buildClient();

  if (!client) {
    log.warn("No Anthropic credentials available — returning neutral scores");
    return neutral();
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: reviewText }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "{}";
    const parsed = JSON.parse(text);

    return {
      luxuryValueScore: clamp(parsed.luxury_value_score),
      foodieScore: clamp(parsed.foodie_score),
      ecoScore: clamp(parsed.eco_score),
      adventurousMenuScore: clamp(parsed.adventurous_menu_score),
      sentiment: ["positive", "neutral", "negative"].includes(parsed.sentiment)
        ? parsed.sentiment
        : "neutral",
      oneLineSummary:
        typeof parsed.one_line_summary === "string"
          ? parsed.one_line_summary.slice(0, 120)
          : "",
      scoreExplanation:
        typeof parsed.score_explanation === "string"
          ? parsed.score_explanation.slice(0, 280)
          : "",
      scoreBreakdown: parseBreakdown(parsed.score_breakdown),
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      raw: parsed,
    };
  } catch (err) {
    log.error({ err }, "Failed to score review with Claude");
    return neutral();
  }
}

// ---------------------------------------------------------------------------
// POST /reviews/score
// ---------------------------------------------------------------------------
router.post("/reviews/score", async (req, res): Promise<void> => {
  const parsed = ScoreReviewsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { propertyId, source, reviews } = parsed.data;
  const userId: string = (req as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Respect user's AI scoring preference and consent state.
  // AI is enabled only if the user has given consent AND has the toggle on.
  const userPrefs = await db
    .select({
      enabled: preferencesTable.aiReviewScoringEnabled,
      consentGivenAt: preferencesTable.consentGivenAt,
    })
    .from(preferencesTable)
    .where(eq(preferencesTable.userId, userId))
    .limit(1);
  const aiEnabled =
    userPrefs.length > 0 &&
    userPrefs[0].enabled !== false &&
    userPrefs[0].consentGivenAt != null;

  const results = [];

  for (const reviewText of reviews) {
    const reviewHash = hashText(reviewText);

    // When AI is disabled by the user, skip the shared cache entirely
    // and return synthetic neutral output so that no AI-derived data is shown.
    if (!aiEnabled) {
      req.log.info({ propertyId, source }, "AI scoring disabled — neutral");
      const n = neutral();
      results.push({
        propertyId,
        source,
        reviewHash,
        reviewText,
        tags: n.tags,
        luxuryValueScore: n.luxuryValueScore,
        foodieScore: n.foodieScore,
        ecoScore: n.ecoScore,
        adventurousMenuScore: n.adventurousMenuScore,
        sentiment: n.sentiment,
        oneLineSummary: n.oneLineSummary,
        scoreExplanation: n.scoreExplanation,
        scoreBreakdown: n.scoreBreakdown,
        rawClaudeResponse: {},
        cachedAt: new Date(),
      });
      continue;
    }

    const cached = await db
      .select()
      .from(reviewScoresTable)
      .where(
        and(
          eq(reviewScoresTable.propertyId, propertyId),
          eq(reviewScoresTable.source, source),
          eq(reviewScoresTable.reviewHash, reviewHash)
        )
      )
      .limit(1);

    if (cached.length > 0) {
      req.log.info({ propertyId, source, reviewHash }, "Cache hit");
      results.push(cached[0]);
      continue;
    }

    let scores: ScoredResult;
    {
      const rateCheck = checkRateLimit(userId);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: "Rate limit exceeded: max 50 AI scoring calls per hour",
          retryAfter: "1 hour",
        });
        return;
      }

      req.log.info(
        { propertyId, source, remaining: rateCheck.remaining },
        "Calling Claude"
      );
      scores = await scoreWithClaude(reviewText, req.log);
    }

    const [inserted] = await db
      .insert(reviewScoresTable)
      .values({
        propertyId,
        source,
        reviewHash,
        reviewText,
        tags: scores.tags,
        luxuryValueScore: scores.luxuryValueScore,
        foodieScore: scores.foodieScore,
        ecoScore: scores.ecoScore,
        adventurousMenuScore: scores.adventurousMenuScore,
        sentiment: scores.sentiment,
        oneLineSummary: scores.oneLineSummary,
        scoreExplanation: scores.scoreExplanation,
        scoreBreakdown: scores.scoreBreakdown,
        rawClaudeResponse: scores.raw,
      })
      .returning();

    results.push(inserted);
  }

  res.json(results);
});

// ---------------------------------------------------------------------------
// GET /reviews/match?property_id=X&user_id=Y
// ---------------------------------------------------------------------------
function buildMatchExplanation(
  breakdown: {
    luxuryValue: { avgScore: number };
    foodie: { avgScore: number };
    eco: { avgScore: number };
    adventurousMenu: { avgScore: number };
  },
  userTags: string[]
): { explanation: string; whatWorked: string[]; whatHeldItBack: string[] } {
  const whatWorked: string[] = [];
  const whatHeldItBack: string[] = [];

  if (breakdown.luxuryValue.avgScore >= 7)
    whatWorked.push("Strong luxury-value ratio");
  else if (breakdown.luxuryValue.avgScore <= 4)
    whatHeldItBack.push("Luxury-value doesn't match your tier");

  if (userTags.includes("foodie")) {
    if (breakdown.foodie.avgScore >= 7) whatWorked.push("Excellent food credentials");
    else if (breakdown.foodie.avgScore <= 4)
      whatHeldItBack.push("Food didn't impress reviewers");
  }

  if (userTags.includes("eco")) {
    if (breakdown.eco.avgScore >= 7) whatWorked.push("Strong eco practices");
    else if (breakdown.eco.avgScore <= 4)
      whatHeldItBack.push("Limited eco credentials");
  }

  if (userTags.includes("adventurous_menu")) {
    if (breakdown.adventurousMenu.avgScore >= 7)
      whatWorked.push("Adventurous, creative menu");
    else if (breakdown.adventurousMenu.avgScore <= 4)
      whatHeldItBack.push("Menu plays it safe");
  }

  let explanation = "";
  if (whatWorked.length > 0)
    explanation += `Scores well for ${whatWorked.map((s) => s.toLowerCase()).join(" and ")}. `;
  if (whatHeldItBack.length > 0)
    explanation += `Held back by ${whatHeldItBack.map((s) => s.toLowerCase()).join(" and ")}.`;
  if (explanation === "")
    explanation = "Solid mid-range match across your key criteria.";

  return {
    explanation: explanation.trim(),
    whatWorked: whatWorked.slice(0, 3),
    whatHeldItBack: whatHeldItBack.slice(0, 3),
  };
}

router.get("/reviews/match", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const params = MatchReviewsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { property_id: propertyId } = params.data;

  const reviews = await db
    .select()
    .from(reviewScoresTable)
    .where(eq(reviewScoresTable.propertyId, propertyId));

  if (reviews.length === 0) {
    res.json({
      matchScore: 0,
      matchExplanation: "No reviews analysed yet.",
      scoreBreakdown: null,
      whatWorked: [],
      whatHeldItBack: [],
      topReviews: [],
      tagSummary: [],
    });
    return;
  }

  const prefRows = await db
    .select()
    .from(preferencesTable)
    .where(eq(preferencesTable.userId, userId))
    .limit(1);
  const prefs = prefRows[0] ?? null;

  const styleTags: string[] = Array.from(new Set([
    ...(Array.isArray(prefs?.travelStyleTags) ? (prefs!.travelStyleTags as string[]) : []),
    ...(Array.isArray(prefs?.travelStyles) ? (prefs!.travelStyles as string[]) : []),
  ])).filter(Boolean);
  const priceValueWeight = prefs?.priceValueWeight ?? 8;

  const luxWeight = priceValueWeight / 10;
  const foodieWeight = styleTags.includes("foodie") ? 1.0 : 0.2;
  const ecoWeight = styleTags.includes("eco") ? 1.0 : 0.2;
  const adventurousWeight = styleTags.includes("adventurous_menu") ? 1.0 : 0.2;

  const MAX_RAW =
    10 * luxWeight + 10 * foodieWeight + 10 * ecoWeight + 10 * adventurousWeight;

  const rawScores = reviews.map((r) => {
    const lux = (r.luxuryValueScore ?? 5) * luxWeight;
    const food = (r.foodieScore ?? 5) * foodieWeight;
    const eco = (r.ecoScore ?? 5) * ecoWeight;
    const adv = (r.adventurousMenuScore ?? 5) * adventurousWeight;
    return lux + food + eco + adv;
  });

  const avgRaw = rawScores.reduce((a, b) => a + b, 0) / rawScores.length;
  const matchScore = Math.round((avgRaw / MAX_RAW) * 100);

  const avg = (key: "luxuryValueScore" | "foodieScore" | "ecoScore" | "adventurousMenuScore") =>
    reviews.reduce((s, r) => s + ((r as any)[key] ?? 5), 0) / reviews.length;

  const scoreBreakdown = {
    luxuryValue: {
      avgScore: Number(avg("luxuryValueScore").toFixed(1)),
      weight: Number(luxWeight.toFixed(1)),
      contribution: Number((avg("luxuryValueScore") * luxWeight).toFixed(1)),
    },
    foodie: {
      avgScore: Number(avg("foodieScore").toFixed(1)),
      weight: foodieWeight,
      contribution: Number((avg("foodieScore") * foodieWeight).toFixed(1)),
    },
    eco: {
      avgScore: Number(avg("ecoScore").toFixed(1)),
      weight: ecoWeight,
      contribution: Number((avg("ecoScore") * ecoWeight).toFixed(1)),
    },
    adventurousMenu: {
      avgScore: Number(avg("adventurousMenuScore").toFixed(1)),
      weight: adventurousWeight,
      contribution: Number((avg("adventurousMenuScore") * adventurousWeight).toFixed(1)),
    },
  };

  const { explanation, whatWorked, whatHeldItBack } = buildMatchExplanation(
    scoreBreakdown,
    styleTags
  );

  const scored = reviews
    .map((r, i) => ({ review: r, score: rawScores[i] }))
    .sort((a, b) => b.score - a.score);

  const topReviews = scored.slice(0, 5).map((s) => s.review);

  const tagCounts = new Map<string, number>();
  for (const r of reviews) {
    for (const tag of (r.tags as string[] | null) ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const tagSummary = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  res.json({
    matchScore,
    matchExplanation: explanation,
    scoreBreakdown,
    whatWorked,
    whatHeldItBack,
    topReviews,
    tagSummary,
  });
});

export default router;
