import { Router } from "express";

const router = Router();

const KNOWN_BRANDS = [
  "Rosewood", "Aman", "Four Seasons", "Ritz-Carlton", "St. Regis",
  "Park Hyatt", "Andaz", "Auberge", "Belmond", "Six Senses",
  "1 Hotels", "Soho House", "Firmdale", "Montage", "Pendry",
  "Thompson", "Kimpton", "Ace Hotel", "Graduate", "Virgin Hotels",
  "W Hotels", "Edition", "Bulgari", "Waldorf Astoria", "Conrad",
  "Canopy", "Curio", "Tribute Portfolio", "Autograph Collection",
  "JW Marriott", "Le Méridien", "Westin", "Sheraton", "Marriott",
  "Hilton", "Hyatt Regency", "Grand Hyatt", "Alila",
  "Nobu Hotels", "citizenM", "Mama Shelter", "25hours",
];

function extractBrand(name: string): string | null {
  for (const brand of KNOWN_BRANDS) {
    if (name.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }
  return null;
}

router.get("/places/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q || q.length < 2) {
    return res.json([]);
  }

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return res.status(503).json({ error: "Google Places API key not configured" });
  }

  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/textsearch/json` +
      `?query=${encodeURIComponent(q)}&type=lodging&key=${key}`;

    const response = await fetch(url, {
      headers: {
        Referer: "https://travelcompaniontool.replit.app",
        Origin: "https://travelcompaniontool.replit.app",
      },
    });
    const data = (await response.json()) as {
      status?: string;
      error_message?: string;
      results: Array<{
        place_id: string;
        name: string;
        formatted_address: string;
        rating?: number;
        price_level?: number;
      }>;
    };

    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("Places API error:", data.status, data.error_message);
    }

    const results = (data.results ?? []).slice(0, 6).map((r) => ({
      placeId: r.place_id,
      name: r.name,
      location: r.formatted_address,
      brand: extractBrand(r.name),
      rating: r.rating ?? null,
      priceLevel: r.price_level ?? null,
    }));

    return res.json(results);
  } catch {
    return res.status(500).json({ error: "Places search failed" });
  }
});

export default router;
