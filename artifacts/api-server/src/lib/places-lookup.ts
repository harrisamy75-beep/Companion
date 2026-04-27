/**
 * Google Places lookup helper.
 *
 * Used by the AI Review Match endpoint to ground Claude's scoring in REAL
 * Google data (rating, review count, recent guest reviews) instead of
 * letting Claude guess from training data.
 *
 * Strategy:
 *   1. Text Search → resolve query to a place_id and best-match property name
 *   2. Place Details → fetch rating, user_ratings_total, price_level,
 *      editorial_summary, and up to 5 review snippets
 *
 * Results are cached in-memory for 1 hour to avoid burning API quota when
 * the same hotel is matched repeatedly.
 */

const REFERER = "https://travelcompaniontool.replit.app";
const CACHE_TTL_MS = 60 * 60 * 1000;

export type PlaceReview = {
  rating: number;
  text: string;
  relativeTime?: string;
};

export type PlaceLookup = {
  placeId: string;
  name: string;
  formattedAddress: string;
  rating: number | null;
  userRatingsTotal: number | null;
  priceLevel: number | null;
  types: string[];
  editorialSummary: string | null;
  reviews: PlaceReview[];
};

const cache = new Map<string, { at: number; value: PlaceLookup | null }>();

function cacheKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

async function textSearch(query: string, key: string): Promise<{
  placeId: string;
  name: string;
  formattedAddress: string;
} | null> {
  const url =
    `https://maps.googleapis.com/maps/api/place/textsearch/json` +
    `?query=${encodeURIComponent(query)}&type=lodging&key=${key}`;
  const res = await fetch(url, {
    headers: { Referer: REFERER, Origin: REFERER },
  });
  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    results?: Array<{
      place_id: string;
      name: string;
      formatted_address: string;
    }>;
  };
  if (data.status && data.status !== "OK") {
    if (data.status !== "ZERO_RESULTS") {
      console.error("Places textsearch error:", data.status, data.error_message);
    }
    return null;
  }
  const first = data.results?.[0];
  if (!first) return null;
  return {
    placeId: first.place_id,
    name: first.name,
    formattedAddress: first.formatted_address,
  };
}

async function placeDetails(placeId: string, key: string): Promise<{
  rating: number | null;
  userRatingsTotal: number | null;
  priceLevel: number | null;
  types: string[];
  editorialSummary: string | null;
  reviews: PlaceReview[];
} | null> {
  const fields = [
    "rating",
    "user_ratings_total",
    "price_level",
    "type",
    "editorial_summary",
    "reviews",
  ].join(",");
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${placeId}&fields=${fields}&reviews_no_translations=false&key=${key}`;
  const res = await fetch(url, {
    headers: { Referer: REFERER, Origin: REFERER },
  });
  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    result?: {
      rating?: number;
      user_ratings_total?: number;
      price_level?: number;
      types?: string[];
      editorial_summary?: { overview?: string };
      reviews?: Array<{
        rating?: number;
        text?: string;
        relative_time_description?: string;
      }>;
    };
  };
  if (data.status && data.status !== "OK") {
    console.error("Places details error:", data.status, data.error_message);
    return null;
  }
  const r = data.result;
  if (!r) return null;
  return {
    rating: typeof r.rating === "number" ? r.rating : null,
    userRatingsTotal: typeof r.user_ratings_total === "number" ? r.user_ratings_total : null,
    priceLevel: typeof r.price_level === "number" ? r.price_level : null,
    types: Array.isArray(r.types) ? r.types : [],
    editorialSummary: r.editorial_summary?.overview ?? null,
    reviews: (r.reviews ?? [])
      .filter((rv) => typeof rv.text === "string" && rv.text.trim().length > 0)
      .slice(0, 5)
      .map((rv) => ({
        rating: typeof rv.rating === "number" ? rv.rating : 0,
        text: (rv.text ?? "").slice(0, 600),
        relativeTime: rv.relative_time_description,
      })),
  };
}

/**
 * Resolve a query (hotel name, possibly with city, or a URL) to real Google
 * data. Returns null if no API key, no match, or any API error.
 */
export async function lookupPlace(query: string): Promise<PlaceLookup | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;

  const trimmed = query.trim();
  if (!trimmed) return null;

  const ck = cacheKey(trimmed);
  const cached = cache.get(ck);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const search = await textSearch(trimmed, key);
    if (!search) {
      cache.set(ck, { at: Date.now(), value: null });
      return null;
    }
    const details = await placeDetails(search.placeId, key);
    const value: PlaceLookup = {
      placeId: search.placeId,
      name: search.name,
      formattedAddress: search.formattedAddress,
      rating: details?.rating ?? null,
      userRatingsTotal: details?.userRatingsTotal ?? null,
      priceLevel: details?.priceLevel ?? null,
      types: details?.types ?? [],
      editorialSummary: details?.editorialSummary ?? null,
      reviews: details?.reviews ?? [],
    };
    cache.set(ck, { at: Date.now(), value });
    return value;
  } catch (err) {
    console.error("lookupPlace failed:", err);
    return null;
  }
}
