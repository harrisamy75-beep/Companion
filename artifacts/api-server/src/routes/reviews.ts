import { Router, type IRouter } from "express";
import { createHash } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, reviewScoresTable, preferencesTable } from "@workspace/db";
import { ScoreReviewsBody, MatchReviewsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// In-memory rate limiter: max 50 Claude calls per hour per user_id
// ---------------------------------------------------------------------------
const RATE_LIMIT = 50;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

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
  "one_line_summary": string
}

Tags must come only from this list: luxury_value, overpriced, tourist_trap, foodie, adventurous_menu, kids_menu_only, eco_certified, vegetarian_friendly, hiking_nearby, family_friendly, romantic, business, pretentious, worth_every_penny, hidden_gem.

Scoring guidelines:
- luxury_value_score (1-10): High = excellent quality for price (think Rosewood, Palm House). Low = overpriced or budget.
- foodie_score (1-10): High = locally sourced, creative, chef-driven, not a kids menu. Low = generic.
- eco_score (1-10): High = sustainability practices, nature access, eco certifications. Low = no eco focus.
- adventurous_menu_score (1-10): High = unusual ingredients, global cuisine, not safe options. Low = plain/predictable.
- sentiment: overall tone of the review.
- one_line_summary: max 12 words, plain English, no quotes.

Return only the JSON object. No explanation, no markdown.`;

interface ScoredResult {
  tags: string[];
  luxuryValueScore: number;
  foodieScore: number;
  ecoScore: number;
  adventurousMenuScore: number;
  sentiment: string;
  oneLineSummary: string;
  raw: object;
}

async function scoreWithClaude(reviewText: string, log: any): Promise<ScoredResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    log.warn("ANTHROPIC_API_KEY not set — returning neutral scores");
    return neutral();
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: reviewText }],
      }),
    });

    if (!response.ok) {
      log.error({ status: response.status }, "Anthropic API error");
      return neutral();
    }

    const data = (await response.json()) as any;
    const text: string = data?.content?.[0]?.text ?? "{}";
    const parsed = JSON.parse(text);

    return {
      luxuryValueScore: clamp(parsed.luxury_value_score),
      foodieScore: clamp(parsed.foodie_score),
      ecoScore: clamp(parsed.eco_score),
      adventurousMenuScore: clamp(parsed.adventurous_menu_score),
      sentiment: ["positive", "neutral", "negative"].includes(parsed.sentiment)
        ? parsed.sentiment
        : "neutral",
      oneLineSummary: typeof parsed.one_line_summary === "string"
        ? parsed.one_line_summary.slice(0, 120)
        : "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      raw: parsed,
    };
  } catch (err) {
    log.error({ err }, "Failed to score review with Claude");
    return neutral();
  }
}

function neutral(): ScoredResult {
  return {
    luxuryValueScore: 5,
    foodieScore: 5,
    ecoScore: 5,
    adventurousMenuScore: 5,
    sentiment: "neutral",
    oneLineSummary: "",
    tags: [],
    raw: {},
  };
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
  const userId = (req.query.user_id as string) ?? "anonymous";

  const results = [];

  for (const reviewText of reviews) {
    const reviewHash = hashText(reviewText);

    // Check cache first
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

    // Rate limit applies only to actual Claude calls
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      res.status(429).json({
        error: "Rate limit exceeded: max 50 AI scoring calls per hour",
        retryAfter: "1 hour",
      });
      return;
    }

    req.log.info({ propertyId, source, remaining: rateCheck.remaining }, "Calling Claude");
    const scores = await scoreWithClaude(reviewText, req.log);

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
router.get("/reviews/match", async (req, res): Promise<void> => {
  const params = MatchReviewsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { property_id: propertyId } = params.data;

  // Fetch cached review scores for this property
  const reviews = await db
    .select()
    .from(reviewScoresTable)
    .where(eq(reviewScoresTable.propertyId, propertyId));

  if (reviews.length === 0) {
    res.json({ matchScore: 0, topReviews: [], tagSummary: [] });
    return;
  }

  // Fetch user preferences (single-user for now)
  const prefRows = await db.select().from(preferencesTable).limit(1);
  const prefs = prefRows[0] ?? null;

  const styleTags: string[] = Array.isArray(prefs?.travelStyleTags)
    ? (prefs.travelStyleTags as string[])
    : [];
  const priceValueWeight = prefs?.priceValueWeight ?? 8;

  // Tag weights: 1.0 if user has the tag, else 0.2
  const foodieWeight = styleTags.includes("foodie") ? 1.0 : 0.2;
  const ecoWeight = styleTags.includes("eco") ? 1.0 : 0.2;
  const adventurousWeight = styleTags.includes("adventurous_menu") ? 1.0 : 0.2;

  // Max possible raw score (all weights 1.0, all scores 10, priceValueWeight 10):
  // 10*(10/10) + 10*1.0 + 10*1.0 + 10*1.0 = 40
  const MAX_RAW = 40;

  // Score each review and take the average
  const rawScores = reviews.map((r) => {
    const lux = (r.luxuryValueScore ?? 5) * (priceValueWeight / 10);
    const food = (r.foodieScore ?? 5) * foodieWeight;
    const eco = (r.ecoScore ?? 5) * ecoWeight;
    const adv = (r.adventurousMenuScore ?? 5) * adventurousWeight;
    return lux + food + eco + adv;
  });

  const avgRaw = rawScores.reduce((a, b) => a + b, 0) / rawScores.length;
  const matchScore = Math.round((avgRaw / MAX_RAW) * 100);

  // Top reviews sorted by their individual match score (descending)
  const scored = reviews
    .map((r, i) => ({ review: r, score: rawScores[i] }))
    .sort((a, b) => b.score - a.score);

  const topReviews = scored.slice(0, 5).map((s) => s.review);

  // Aggregate tags across all reviews
  const tagCounts = new Map<string, number>();
  for (const r of reviews) {
    for (const tag of (r.tags as string[] | null) ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const tagSummary = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  res.json({ matchScore, topReviews, tagSummary });
});

export default router;
