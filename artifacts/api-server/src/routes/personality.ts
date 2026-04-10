import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

function buildClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) return new Anthropic({ apiKey: key });
  const baseURL = process.env.ANTHROPIC_BASE_URL;
  const proxyKey = process.env.REPLIT_AI_ANTHROPIC_API_KEY;
  if (proxyKey) return new Anthropic({ apiKey: proxyKey, ...(baseURL ? { baseURL } : {}) });
  return null;
}

router.post("/personality", async (req, res): Promise<void> => {
  const session = (req as any).session;

  if (session.personality) {
    res.json({ personality: session.personality });
    return;
  }

  const {
    name = "Traveler",
    travelers = [],
    travelStyles = [],
    favoriteProperties = [],
  } = req.body as {
    name?: string;
    travelers?: Array<{ name: string; type: "adult" | "child"; relationship?: string; birthDate?: string }>;
    travelStyles?: string[];
    favoriteProperties?: Array<{ propertyName: string; brand?: string }>;
  };

  const partyDesc =
    travelers.length > 0
      ? travelers
          .map((t) => {
            if (t.type === "child") {
              const age = t.birthDate
                ? new Date().getFullYear() - new Date(t.birthDate).getFullYear()
                : null;
              return age !== null ? `${t.name} (${age})` : `${t.name} (child)`;
            }
            return `${t.name} (${t.relationship || "adult"})`;
          })
          .join(", ")
      : "Travels solo";

  const stylesDesc =
    travelStyles.length > 0 ? travelStyles.join(", ") : "no styles selected yet";

  const propertiesDesc =
    favoriteProperties.length > 0
      ? favoriteProperties
          .map((p) => `${p.propertyName}${p.brand ? ` by ${p.brand}` : ""}`)
          .join(", ")
      : "none listed";

  const client = buildClient();
  if (!client) {
    res.status(503).json({ error: "AI service not configured" });
    return;
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      system: `You are a luxury travel editor. Write exactly 2 sentences describing this traveler's style. Be specific, evocative, and warm — like a Condé Nast Traveler editor describing a reader. Reference their actual preferences. Never use the word "luxury" alone — be more specific. Return only the 2 sentences, no quotes, no preamble.`,
      messages: [
        {
          role: "user",
          content: `Traveler: ${name}\nParty: ${partyDesc}\nTravel styles: ${stylesDesc}\nFavourite properties: ${propertiesDesc}`,
        },
      ],
    });

    const personality = (message.content[0] as { type: string; text: string }).text.trim();
    session.personality = personality;
    res.json({ personality });
  } catch (err) {
    console.error("Personality generation failed:", err);
    res.status(500).json({ error: "Failed to generate personality" });
  }
});

export default router;
