import { Router, type IRouter } from "express";
import { createHash } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, reviewScoresTable } from "@workspace/db";
import { ScoreReviewBody } from "@workspace/api-zod";

const router: IRouter = Router();

function hashReviewText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

router.post("/reviews/score", async (req, res): Promise<void> => {
  const parsed = ScoreReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { propertyId, source, reviewText } = parsed.data;
  const reviewHash = hashReviewText(reviewText);

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
    req.log.info({ propertyId, source }, "Review score cache hit");
    res.json(cached[0]);
    return;
  }

  const scores = await scoreWithAI(reviewText, req.log);

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
      rawClaudeResponse: scores.raw,
    })
    .returning();

  req.log.info({ propertyId, source }, "Review scored and cached");
  res.json(inserted);
});

async function scoreWithAI(reviewText: string, log: any): Promise<{
  tags: string[];
  luxuryValueScore: number;
  foodieScore: number;
  ecoScore: number;
  adventurousMenuScore: number;
  raw: object;
}> {
  const prompt = `You are a travel review analyst. Score the following property review on these dimensions, each from 1-10:
- luxury_value_score: Quality and luxury relative to price paid (10 = exceptional value, 1 = very poor)
- foodie_score: Quality, creativity, and variety of food/dining (10 = world-class dining, 1 = very basic)
- eco_score: Environmental sustainability and eco-consciousness (10 = fully eco-certified, 1 = no eco focus)
- adventurous_menu_score: How adventurous, local, or unique the menu/activities are (10 = very unique, 1 = very generic)

Also extract an array of relevant tags from: ["luxury_value","foodie","eco","vegetarian_friendly","hiking","adventurous_menu","no_kids_menu_required","family_friendly","romantic","business"].

Review:
"""
${reviewText}
"""

Respond with ONLY valid JSON in this exact format:
{
  "luxury_value_score": <1-10>,
  "foodie_score": <1-10>,
  "eco_score": <1-10>,
  "adventurous_menu_score": <1-10>,
  "tags": ["tag1", "tag2"]
}`;

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      log.warn("ANTHROPIC_API_KEY not set — returning neutral scores");
      return neutralScores();
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      log.error({ status: response.status }, "Anthropic API error");
      return neutralScores();
    }

    const data = (await response.json()) as any;
    const text = data?.content?.[0]?.text ?? "{}";
    const parsed = JSON.parse(text);

    return {
      luxuryValueScore: clamp(parsed.luxury_value_score),
      foodieScore: clamp(parsed.foodie_score),
      ecoScore: clamp(parsed.eco_score),
      adventurousMenuScore: clamp(parsed.adventurous_menu_score),
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      raw: parsed,
    };
  } catch (err) {
    log.error({ err }, "Failed to score review with AI");
    return neutralScores();
  }
}

function clamp(v: unknown): number {
  const n = Number(v);
  if (isNaN(n)) return 5;
  return Math.min(10, Math.max(1, Math.round(n)));
}

function neutralScores() {
  return {
    luxuryValueScore: 5,
    foodieScore: 5,
    ecoScore: 5,
    adventurousMenuScore: 5,
    tags: [] as string[],
    raw: {},
  };
}

export default router;
