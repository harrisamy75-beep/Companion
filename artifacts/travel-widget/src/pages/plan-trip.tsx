import { useState } from "react";
import { Layout } from "@/components/layout";
import { apiFetch } from "@/lib/api";

interface RecommendedHotel {
  name: string;
  location: string;
  whyMatches: string;
  nightlyRate: string;
  matchScore: number;
}

interface PlanTripResponse {
  hotels: RecommendedHotel[];
  profileSummary?: {
    adults: number;
    children: number;
    travelStyles: string[];
    loyaltyCount: number;
    lovedCount: number;
  };
}

const FIELD_LABEL: React.CSSProperties = {
  fontFamily: "'Raleway', sans-serif",
  fontWeight: 600,
  fontSize: "10px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#A07840",
  display: "block",
  marginBottom: "8px",
};

const FIELD_INPUT: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid #DDD8CE",
  fontFamily: "'Raleway', sans-serif",
  fontWeight: 400,
  fontSize: "15px",
  color: "#1C1C1C",
  padding: "8px 0",
  outline: "none",
  caretColor: "#6B2737",
};

function scoreColor(score: number): string {
  if (score >= 9) return "#B8963E";
  if (score >= 7) return "#7CB67C";
  if (score >= 5) return "#D9A24A";
  return "#A8324A";
}

function ScoreCircle({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: "50%",
        border: `2px solid ${color}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        background: "white",
      }}
    >
      <span
        className="font-playfair"
        style={{
          fontWeight: 700,
          fontSize: "22px",
          lineHeight: 1,
          color: color,
        }}
      >
        {score}
      </span>
      <span
        style={{
          fontFamily: "'Raleway', sans-serif",
          fontWeight: 500,
          fontSize: "8px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#5C5248",
          marginTop: 2,
        }}
      >
        / 10
      </span>
    </div>
  );
}

function HotelCard({ hotel }: { hotel: RecommendedHotel }) {
  return (
    <div
      className="card-editorial"
      style={{
        padding: "24px 28px",
        background: "white",
        border: "1px solid #E5E0D8",
        display: "flex",
        gap: "24px",
        alignItems: "flex-start",
      }}
    >
      <ScoreCircle score={hotel.matchScore} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3
          className="font-playfair"
          style={{
            fontWeight: 700,
            fontSize: "22px",
            color: "#1C1C1C",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {hotel.name}
        </h3>
        <p
          style={{
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 400,
            fontSize: "13px",
            color: "#5C5248",
            marginTop: "4px",
            letterSpacing: "0.04em",
          }}
        >
          {hotel.location}
        </p>
        {hotel.whyMatches && (
          <p
            className="font-playfair"
            style={{
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: "15px",
              color: "#1C1C1C",
              marginTop: "14px",
              lineHeight: 1.55,
            }}
          >
            {hotel.whyMatches}
          </p>
        )}
        {hotel.nightlyRate && (
          <p
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 500,
              fontSize: "13px",
              color: "#6B2737",
              marginTop: "14px",
              letterSpacing: "0.04em",
            }}
          >
            Estimated nightly rate: <strong style={{ fontWeight: 700 }}>{hotel.nightlyRate}</strong>
          </p>
        )}
        <a
          href={`https://www.google.com/travel/hotels?q=${encodeURIComponent(`${hotel.name} ${hotel.location}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 600,
            fontSize: "12px",
            color: "#6B2737",
            marginTop: "10px",
            letterSpacing: "0.06em",
            textDecoration: "none",
            borderBottom: "1px solid rgba(107, 39, 55, 0.4)",
            paddingBottom: "1px",
          }}
        >
          Search hotels →
        </a>
      </div>
    </div>
  );
}

export default function PlanTripPage() {
  const [destination, setDestination] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [perNight, setPerNight] = useState("");
  const [total, setTotal] = useState("");
  const [rooms, setRooms] = useState("1");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<RecommendedHotel[] | null>(null);

  const canSubmit = destination.trim().length > 0 && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const r = await apiFetch("/api/plan-trip", {
        method: "POST",
        body: JSON.stringify({
          destination: destination.trim(),
          checkIn: checkIn || undefined,
          checkOut: checkOut || undefined,
          perNightBudget: perNight ? Number(perNight) : null,
          totalBudget: total ? Number(total) : null,
          rooms: rooms ? Number(rooms) : 1,
        }),
      });
      const body = (await r.json()) as PlanTripResponse | { error?: string };
      if (!r.ok || !("hotels" in body)) {
        setError("error" in body && body.error ? body.error : "Could not generate recommendations.");
        return;
      }
      setResults(body.hotels);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: "48px", maxWidth: "880px" }}>
        {/* Header */}
        <div>
          <h1
            className="font-playfair"
            style={{
              fontWeight: 700,
              fontSize: "48px",
              color: "#1C1C1C",
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            Plan a Trip
          </h1>
          <p
            className="font-playfair"
            style={{
              fontStyle: "italic",
              fontSize: "17px",
              color: "#5C5248",
              marginTop: "6px",
            }}
          >
            A personalised hotel shortlist, tuned to your travel style and party.
          </p>
          <span className="section-rule" style={{ marginTop: "24px", display: "block" }} />
        </div>

        {/* Form */}
        <section
          className="card-editorial"
          style={{ padding: "32px 36px", background: "white", border: "1px solid #E5E0D8" }}
        >
          <div style={{ display: "grid", gap: "28px 32px", gridTemplateColumns: "1fr" }}>
            <div>
              <label style={FIELD_LABEL}>Destination</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="e.g. Sicily, Italy"
                style={FIELD_INPUT}
              />
            </div>

            <div style={{ display: "grid", gap: "28px 32px", gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <label style={FIELD_LABEL}>Check-in</label>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  style={FIELD_INPUT}
                />
              </div>
              <div>
                <label style={FIELD_LABEL}>Check-out</label>
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  style={FIELD_INPUT}
                />
              </div>
            </div>

            <div style={{ display: "grid", gap: "28px 32px", gridTemplateColumns: "1fr 1fr 1fr" }}>
              <div>
                <label style={FIELD_LABEL}>Per-night budget</label>
                <div style={{ display: "flex", alignItems: "baseline", borderBottom: "1px solid #DDD8CE" }}>
                  <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 500, fontSize: "15px", color: "#5C5248", marginRight: 6 }}>$</span>
                  <input
                    type="number"
                    min={0}
                    value={perNight}
                    onChange={(e) => setPerNight(e.target.value)}
                    placeholder="800"
                    style={{ ...FIELD_INPUT, borderBottom: "none", flex: 1 }}
                  />
                </div>
              </div>
              <div>
                <label style={FIELD_LABEL}>Total trip budget</label>
                <div style={{ display: "flex", alignItems: "baseline", borderBottom: "1px solid #DDD8CE" }}>
                  <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 500, fontSize: "15px", color: "#5C5248", marginRight: 6 }}>$</span>
                  <input
                    type="number"
                    min={0}
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    placeholder="6,000"
                    style={{ ...FIELD_INPUT, borderBottom: "none", flex: 1 }}
                  />
                </div>
              </div>
              <div>
                <label style={FIELD_LABEL}>Rooms</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={rooms}
                  onChange={(e) => setRooms(e.target.value)}
                  style={FIELD_INPUT}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={canSubmit ? "btn-wine" : ""}
                style={{
                  padding: "14px 32px",
                  fontFamily: "'Raleway', sans-serif",
                  fontWeight: 600,
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  background: canSubmit ? "#6B2737" : "#C9C2B6",
                  color: "white",
                  border: "none",
                  cursor: canSubmit ? "pointer" : "default",
                  transition: "background 0.15s",
                }}
              >
                {loading ? "Finding hotels…" : "Find Hotels"}
              </button>
            </div>
          </div>
        </section>

        {/* Status */}
        {error && (
          <p
            className="font-playfair"
            style={{
              fontStyle: "italic",
              fontSize: "15px",
              color: "#A8324A",
              margin: 0,
            }}
          >
            {error}
          </p>
        )}

        {loading && !results && (
          <p
            className="font-playfair"
            style={{
              fontStyle: "italic",
              fontSize: "16px",
              color: "#5C5248",
              margin: 0,
            }}
          >
            Curating your shortlist against your profile, loved properties, and loyalty programs…
          </p>
        )}

        {/* Results */}
        {results && results.length > 0 && (
          <section style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            <div>
              <span
                style={{
                  fontFamily: "'Raleway', sans-serif",
                  fontWeight: 600,
                  fontSize: "10px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#A07840",
                }}
              >
                Your shortlist
              </span>
              <h2
                className="font-playfair"
                style={{ fontWeight: 400, fontSize: "28px", color: "#1C1C1C", marginTop: 8 }}
              >
                {results.length} hotels matched to your profile
              </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {results.map((h, i) => (
                <HotelCard key={`${h.name}-${i}`} hotel={h} />
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
