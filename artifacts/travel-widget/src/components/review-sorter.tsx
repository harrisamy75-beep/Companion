import { useState } from "react";
import { apiFetch } from "@/lib/api";

type CategoryDetail = { score: number; reason: string };
type ScoreBreakdown = {
  luxury_value: CategoryDetail;
  foodie: CategoryDetail;
  eco: CategoryDetail;
  adventurous_menu: CategoryDetail;
};

type ScoredReview = {
  reviewHash: string;
  reviewText: string;
  tags: string[] | null;
  luxuryValueScore: number | null;
  foodieScore: number | null;
  ecoScore: number | null;
  adventurousMenuScore: number | null;
  sentiment: string | null;
  oneLineSummary: string | null;
  scoreExplanation: string | null;
  scoreBreakdown: ScoreBreakdown | null;
};

const COLORS = {
  bg: "white",
  border: "#E5E0D8",
  text: "#1C1C1C",
  muted: "#5C5248",
  eyebrow: "#A07840",
  wine: "#6B2737",
  cream: "#F5F0E6",
};

function scoreColor(s: number): string {
  if (s >= 7) return "#A07840";
  if (s >= 5) return "#5C5248";
  return "#9B5050";
}

function MiniBreakdown({ breakdown }: { breakdown: ScoreBreakdown }) {
  const items: { label: string; key: keyof ScoreBreakdown }[] = [
    { label: "LUXURY", key: "luxury_value" },
    { label: "FOODIE", key: "foodie" },
    { label: "ECO", key: "eco" },
    { label: "MENU", key: "adventurous_menu" },
  ];
  return (
    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "10px" }}>
      {items.map((it) => {
        const s = breakdown[it.key].score;
        return (
          <span
            key={it.key}
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 600,
              fontSize: "10px",
              letterSpacing: "0.12em",
              color: scoreColor(s),
            }}
          >
            {it.label} {s}
          </span>
        );
      })}
    </div>
  );
}

function ReviewCard({
  review,
  matchScore,
  userTags,
}: {
  review: ScoredReview;
  matchScore: number;
  userTags: string[];
}) {
  const [open, setOpen] = useState(false);
  void userTags;

  return (
    <div style={{ border: `1px solid ${COLORS.border}`, padding: "20px 22px", background: COLORS.bg }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
        <div style={{ flex: 1 }}>
          {review.oneLineSummary && (
            <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: "16px", color: COLORS.text, marginBottom: "8px", lineHeight: 1.4 }}>
              "{review.oneLineSummary}"
            </p>
          )}
          <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "13px", color: COLORS.muted, lineHeight: 1.55 }}>
            {review.reviewText.length > 220 ? review.reviewText.slice(0, 220) + "…" : review.reviewText}
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "32px", color: COLORS.wine, lineHeight: 1 }}>
            {matchScore}
          </div>
          <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: COLORS.muted, marginTop: "4px" }}>
            Match
          </p>
        </div>
      </div>

      {/* Tags */}
      {review.tags && review.tags.length > 0 && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "12px" }}>
          {review.tags.slice(0, 5).map((t) => (
            <span
              key={t}
              style={{
                fontFamily: "'Raleway', sans-serif",
                fontSize: "9px",
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: COLORS.eyebrow,
                background: COLORS.cream,
                padding: "4px 8px",
              }}
            >
              {t.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      {/* Why this score? */}
      <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: `1px solid ${COLORS.cream}` }}>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 500,
            fontSize: "11px",
            color: COLORS.wine,
            letterSpacing: "0.04em",
          }}
        >
          {open ? "Hide details ↑" : `Why ${matchScore}? ↓`}
        </button>
        <div
          style={{
            maxHeight: open ? "400px" : "0",
            overflow: "hidden",
            transition: "max-height 0.3s ease",
          }}
        >
          <div style={{ paddingTop: "10px" }}>
            {review.scoreExplanation && (
              <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: "13px", color: COLORS.muted, lineHeight: 1.5 }}>
                {review.scoreExplanation}
              </p>
            )}
            {review.scoreBreakdown && <MiniBreakdown breakdown={review.scoreBreakdown} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReviewSorter({ userTags }: { userTags: string[] }) {
  const [propertyName, setPropertyName] = useState("");
  const [reviewsText, setReviewsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScoredReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reviewCount = reviewsText
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20).length;

  const computeMatch = (r: ScoredReview): number => {
    const luxWeight = 0.8;
    const foodieWeight = userTags.includes("foodie") ? 1.0 : 0.2;
    const ecoWeight = userTags.includes("eco") ? 1.0 : 0.2;
    const advWeight = userTags.includes("adventurous_menu") ? 1.0 : 0.2;
    const max = 10 * (luxWeight + foodieWeight + ecoWeight + advWeight);
    const raw =
      (r.luxuryValueScore ?? 5) * luxWeight +
      (r.foodieScore ?? 5) * foodieWeight +
      (r.ecoScore ?? 5) * ecoWeight +
      (r.adventurousMenuScore ?? 5) * advWeight;
    return Math.round((raw / max) * 100);
  };

  const handleAnalyse = async () => {
    const reviews = reviewsText
      .split(/\n\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);
    if (reviews.length === 0) {
      setError("Paste at least one review (separate multiple with blank lines).");
      return;
    }
    if (!propertyName.trim()) {
      setError("Add the property name first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await apiFetch("/api/reviews/score", {
        method: "POST",
        
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: propertyName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
          source: "google",
          reviews,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      const scored: ScoredReview[] = await res.json();
      const sorted = [...scored].sort((a, b) => computeMatch(b) - computeMatch(a));
      setResults(sorted);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const aggregate = results
    ? Math.round(results.reduce((s, r) => s + computeMatch(r), 0) / results.length)
    : 0;

  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, padding: "26px 28px" }}>
      <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: COLORS.eyebrow, marginBottom: "10px" }}>
        Review Sorter
      </p>
      <h3 style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 400, fontSize: "22px", color: COLORS.text, marginBottom: "6px", lineHeight: 1.3 }}>
        Paste reviews. We rank them for you.
      </h3>
      <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontStyle: "italic", fontSize: "13px", color: COLORS.muted, marginBottom: "18px" }}>
        Drop in a few reviews from any source — separate them with blank lines.
      </p>

      <input
        value={propertyName}
        onChange={(e) => setPropertyName(e.target.value)}
        placeholder="Property name (e.g. Rosewood Miramar)"
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          borderBottom: `1px solid ${COLORS.border}`,
          fontFamily: "'Raleway', sans-serif",
          fontWeight: 400,
          fontSize: "14px",
          color: COLORS.text,
          padding: "8px 0",
          outline: "none",
          marginBottom: "16px",
        }}
      />

      <textarea
        value={reviewsText}
        onChange={(e) => setReviewsText(e.target.value)}
        placeholder={"Paste one review here.\n\nLeave a blank line, then paste the next one.\n\nAnd so on…"}
        rows={8}
        style={{
          width: "100%",
          background: COLORS.cream,
          border: `1px solid ${COLORS.border}`,
          fontFamily: "'Raleway', sans-serif",
          fontWeight: 400,
          fontSize: "13px",
          color: COLORS.text,
          padding: "12px 14px",
          outline: "none",
          resize: "vertical",
          lineHeight: 1.5,
          marginBottom: "14px",
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontStyle: "italic", fontSize: "12px", color: COLORS.muted }}>
          {reviewCount} review{reviewCount === 1 ? "" : "s"} detected
        </span>
        <button
          onClick={handleAnalyse}
          disabled={loading || reviewCount === 0 || !propertyName.trim()}
          style={{
            background: loading || reviewCount === 0 || !propertyName.trim() ? "#3A2028" : COLORS.wine,
            border: "none",
            color: "white",
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 600,
            fontSize: "10px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            padding: "11px 20px",
            cursor: loading || reviewCount === 0 || !propertyName.trim() ? "default" : "pointer",
          }}
        >
          {loading ? "Analysing…" : "Analyse & Sort"}
        </button>
      </div>

      {error && (
        <p style={{ fontFamily: "'Raleway', sans-serif", fontStyle: "italic", fontSize: "12px", color: COLORS.wine, marginTop: "10px" }}>
          {error}
        </p>
      )}

      {results && results.length > 0 && (
        <div style={{ marginTop: "26px", paddingTop: "22px", borderTop: `1px solid ${COLORS.border}` }}>
          {/* Aggregate header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "18px" }}>
            <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontStyle: "italic", fontSize: "13px", color: COLORS.muted }}>
              {results.length} review{results.length === 1 ? "" : "s"} analysed · sorted by match for your style
            </p>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "28px", color: COLORS.wine, lineHeight: 1 }}>
                {aggregate}
              </span>
              <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "11px", color: COLORS.muted, marginLeft: "6px" }}>
                avg match
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {results.map((r) => (
              <ReviewCard key={r.reviewHash} review={r} matchScore={computeMatch(r)} userTags={userTags} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
