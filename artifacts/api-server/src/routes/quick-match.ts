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
      max_tokens: 150,
      system: `You are a luxury travel concierge. Given a hotel or destination and a traveler's preferences, return ONLY valid JSON with no other text:
{"score": number (0-100 match), "tags": string[] (2-3 short descriptive words), "headline": string (max 12 words, specific and evocative)}
Score 80+ only for strong matches. Be honest — a poor match should score 30-50.`,
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

    res.json({
      score: Math.min(100, Math.max(0, Math.round(Number(parsed.score) || 72))),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : [],
      headline: typeof parsed.headline === "string" ? parsed.headline : "Matches your travel style",
    });
  } catch (err) {
    console.error("Quick match failed:", err);
    res.status(500).json({ error: "Failed to generate match" });
  }
});

export default router;
