import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db, preferencesTable } from "@workspace/db";

const router = Router();

function buildClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) return new Anthropic({ apiKey: key });
  const baseURL = process.env.ANTHROPIC_BASE_URL;
  const proxyKey = process.env.REPLIT_AI_ANTHROPIC_API_KEY;
  if (proxyKey) return new Anthropic({ apiKey: proxyKey, ...(baseURL ? { baseURL } : {}) });
  return null;
}

router.post("/reviews/quick-match", async (req, res): Promise<void> => {
  const userId: string = (req as any).userId;
  const { query } = req.body as { query?: string };

  if (!query?.trim()) {
    res.status(400).json({ error: "query required" });
    return;
  }

  const prefRows = await db
    .select()
    .from(preferencesTable)
    .where(eq(preferencesTable.userId, userId))
    .limit(1);

  const travelStyles: string[] =
    (prefRows[0]?.travelStyles as string[] | null) ?? [];

  const styleDesc =
    travelStyles.length > 0
      ? travelStyles.slice(0, 10).join(", ")
      : "no travel style preferences set";

  const personality: string | null =
    (req as any).session?.personality ?? null;

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
  "headline": string (max 12 words, specific and evocative),
  "score_explanation": string (1-2 sentences explaining what drove the score up and what held it back, specific to this traveler's profile),
  "score_breakdown": {
    "luxury_value":     { "score": number 1-10, "reason": string (max 8 words) },
    "foodie":           { "score": number 1-10, "reason": string (max 8 words) },
    "eco":              { "score": number 1-10, "reason": string (max 8 words) },
    "adventurous_menu": { "score": number 1-10, "reason": string (max 8 words) }
  }
}
Score 80+ only for strong matches. Be honest — a poor match should score 30-50. The score_explanation should reference what works and what doesn't given the traveler's style.`,
      messages: [
        {
          role: "user",
          content: `Hotel or destination: ${query.trim()}\nTraveler's style: ${styleDesc}${personality ? `\nPersonality: ${personality}` : ""}`,
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

    res.json({
      score: Math.min(100, Math.max(0, Math.round(Number(parsed.score) || 72))),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : [],
      headline: typeof parsed.headline === "string" ? parsed.headline : "Matches your travel style",
      scoreExplanation: typeof parsed.score_explanation === "string" ? parsed.score_explanation.slice(0, 280) : "",
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
