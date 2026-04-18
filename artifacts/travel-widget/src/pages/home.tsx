import { useState } from "react";
import { Layout } from "@/components/layout";
import { useGetTravelSummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Heart } from "lucide-react";
import { TRAVEL_STYLE_GROUPS } from "@/lib/travel-styles";
import ReviewSorter from "@/components/review-sorter";

/* ─── Helpers ─── */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getStyleLabel(id: string): string {
  for (const g of TRAVEL_STYLE_GROUPS) {
    const s = g.styles.find((s) => s.id === id);
    if (s) return s.label;
  }
  return id;
}

function maskNumber(num: string | null): string | null {
  if (!num) return null;
  const clean = num.replace(/\s/g, "");
  return clean.length <= 4 ? clean : "•••• " + clean.slice(-4);
}

function buildSubtitle(
  travelers: any[],
  loyalty: any[],
  lovedProperties: any[],
  topStyleId: string | null
): string {
  const topStyle = topStyleId ? getStyleLabel(topStyleId) : null;
  if (travelers.length > 0 && (loyalty.length > 0 || lovedProperties.length > 0)) {
    const parts: string[] = [];
    if (topStyle) parts.push(`${topStyle} traveler`);
    if (loyalty.length > 0) parts.push(`${loyalty.length} loyalty ${loyalty.length === 1 ? "program" : "programs"}`);
    if (lovedProperties.length > 0) parts.push(`${lovedProperties.length} loved ${lovedProperties.length === 1 ? "property" : "properties"}`);
    return parts.join(" · ") + ".";
  }
  if (travelers.length > 0) {
    const total = travelers.length;
    return `Your party of ${total} is ready for the next adventure.`;
  }
  if (topStyle) return `${topStyle} traveler, ready to explore.`;
  return "Your travel portfolio is waiting to be built.";
}

/* ─── Avatar chip ─── */
function TravelerChip({ name, ageYears, travelerType }: { name: string; ageYears?: number | null; travelerType: string }) {
  const isChild = travelerType === "child";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: isChild ? "#B8963E" : "#1C1C1C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: "14px", color: "white" }}>{name.charAt(0).toUpperCase()}</span>
      </div>
      <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "13px", color: "#1C1C1C" }}>
        {name}{isChild && ageYears ? `, ${ageYears}` : ""}
      </span>
    </div>
  );
}

/* ─── Auto-fill Preview demo ─── */
function AutoFillPreview({
  adults,
  children,
  childAges,
  partyDescription,
}: {
  adults: number;
  children: number;
  childAges: number[];
  partyDescription: string;
}) {
  const [copied, setCopied] = useState(false);

  const payload = {
    adults,
    children,
    childAges,
    partyDescription,
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  };

  /* Mock booking-form styling — deliberately a bit grey to look "external" */
  const mockBg = "#FBFBF9";
  const mockBorder = "#D9D5CC";
  const mockLabel = { fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#6B6358", marginBottom: "4px", display: "block" };
  const mockSelect: React.CSSProperties = {
    width: "100%",
    background: "white",
    border: `1px solid ${mockBorder}`,
    fontFamily: "'Raleway', sans-serif",
    fontWeight: 400,
    fontSize: "13px",
    color: "#2C2820",
    padding: "8px 10px",
    appearance: "none",
    cursor: "default",
  };

  return (
    <div style={{ background: "white", border: "1px solid #E5E0D8", padding: "26px 28px" }}>
      <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#A07840", marginBottom: "10px" }}>
        Auto-fill Preview
      </p>
      <h3 style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 400, fontSize: "22px", color: "#1C1C1C", marginBottom: "6px", lineHeight: 1.3 }}>
        Here's exactly what gets filled in.
      </h3>
      <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontStyle: "italic", fontSize: "13px", color: "#5C5248", marginBottom: "20px" }}>
        A peek at how a typical booking form will look once the extension fires.
      </p>

      {adults === 0 && children === 0 ? (
        <p style={{ fontFamily: "'Raleway', sans-serif", fontStyle: "italic", fontSize: "14px", color: "#5C5248" }}>
          Add travelers to see the preview.
        </p>
      ) : (
        <>
          {/* Mock form */}
          <div style={{ background: mockBg, border: `1px solid ${mockBorder}`, padding: "20px 22px", marginBottom: "18px" }}>
            <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 700, fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#3A352C", marginBottom: "16px" }}>
              Guests
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: childAges.length > 0 ? "14px" : "0" }}>
              <div>
                <label style={mockLabel}>Adults</label>
                <select value={adults} onChange={() => {}} style={mockSelect} disabled>
                  <option>{adults}</option>
                </select>
              </div>
              <div>
                <label style={mockLabel}>Children</label>
                <select value={children} onChange={() => {}} style={mockSelect} disabled>
                  <option>{children}</option>
                </select>
              </div>
            </div>

            {childAges.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "14px" }}>
                {childAges.map((age, i) => (
                  <div key={i}>
                    <label style={mockLabel}>Child {i + 1} age</label>
                    <select value={age} onChange={() => {}} style={mockSelect} disabled>
                      <option>{age}</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Copy button + helper */}
          <button
            onClick={handleCopy}
            style={{
              background: copied ? "#3A2028" : "#6B2737",
              border: "none",
              color: "white",
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 600,
              fontSize: "10px",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              padding: "11px 20px",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            {copied ? "Copied ✓" : "Copy auto-fill data"}
          </button>

          <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontStyle: "italic", fontSize: "12px", color: "#5C5248", marginTop: "14px", lineHeight: 1.55 }}>
            The browser extension fills this automatically on Expedia, Booking.com, Google Hotels and more.
          </p>
        </>
      )}
    </div>
  );
}

/* ─── Review Match Card (dark, self-contained) ─── */
type CategoryDetail = { score: number; reason: string; weight: number; contribution: number };
type QuickMatchResult = {
  score: number;
  tags: string[];
  headline: string;
  scoreExplanation?: string;
  scoreBreakdown?: {
    luxuryValue: CategoryDetail;
    foodie: CategoryDetail;
    eco: CategoryDetail;
    adventurousMenu: CategoryDetail;
  };
  whatWorked?: string[];
  whatHeldItBack?: string[];
  userTags?: string[];
};

const CATEGORY_LABELS: { key: keyof NonNullable<QuickMatchResult["scoreBreakdown"]>; label: string }[] = [
  { key: "luxuryValue", label: "Luxury Value" },
  { key: "foodie", label: "Foodie" },
  { key: "eco", label: "Eco" },
  { key: "adventurousMenu", label: "Adventurous Menu" },
];

function BreakdownBar({ label, score, weight }: { label: string; score: number; weight: number }) {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
        <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>
          {label}
        </span>
        <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 500, fontSize: "11px", color: "white" }}>
          {score}/10
        </span>
      </div>
      <div style={{ width: "100%", height: "3px", background: "rgba(255,255,255,0.15)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#6B2737", transition: "width 0.4s ease" }} />
      </div>
      <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "9.5px", color: "rgba(255,255,255,0.4)", marginTop: "3px", letterSpacing: "0.04em" }}>
        weighted {weight.toFixed(1)}×
      </p>
    </div>
  );
}

function ReviewMatchCard() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuickMatchResult | null>(null);

  const handleMatch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/reviews/quick-match", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      if (res.ok) setResult(await res.json());
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "#1C1C1C", padding: "28px 28px 32px", display: "flex", flexDirection: "column", flex: 1 }}>
      <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#B8963E", marginBottom: "18px" }}>
        Review Intelligence
      </p>
      <h3 style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 400, fontSize: "18px", color: "white", marginBottom: "24px", lineHeight: 1.4 }}>
        Paste a hotel URL or name
      </h3>

      {/* Input + button */}
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", marginBottom: "28px" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleMatch()}
          placeholder="Try: Rosewood Miramar"
          style={{ flex: 1, background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.25)", color: "white", fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "14px", padding: "8px 0", outline: "none", caretColor: "#B8963E" }}
        />
        <button
          onClick={handleMatch}
          disabled={loading || !query.trim()}
          style={{ background: loading || !query.trim() ? "#3A2028" : "#6B2737", border: "none", color: "white", fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", padding: "10px 18px", cursor: loading || !query.trim() ? "default" : "pointer", transition: "background 0.15s", whiteSpace: "nowrap" }}
        >
          {loading ? "…" : "Match"}
        </button>
      </div>

      {/* Result */}
      {loading && (
        <div style={{ textAlign: "center", paddingTop: "16px" }}>
          <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontStyle: "italic", fontSize: "14px", color: "rgba(255,255,255,0.4)", animation: "pulse 1.5s ease-in-out infinite" }}>Matching against your profile…</p>
        </div>
      )}

      {result && !loading && (
        <div>
          {/* Score */}
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "72px", color: "white", lineHeight: 1 }}>
              {result.score}
            </span>
            <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "12px", color: "rgba(255,255,255,0.5)", marginTop: "6px", letterSpacing: "0.04em" }}>
              / 100 match for your travel style
            </p>
          </div>

          {/* Headline */}
          {result.headline && (
            <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: "15px", color: "rgba(255,255,255,0.75)", textAlign: "center", marginTop: "12px", marginBottom: "8px", lineHeight: 1.5 }}>
              {result.headline}
            </p>
          )}

          {/* Score explanation */}
          {result.scoreExplanation && (
            <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: "14px", color: "rgba(255,255,255,0.85)", textAlign: "center", marginTop: "10px", marginBottom: "20px", lineHeight: 1.55 }}>
              {result.scoreExplanation}
            </p>
          )}

          {/* Tags */}
          {result.tags.length > 0 && (
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "12px", marginBottom: "22px", flexWrap: "wrap" }}>
              {result.tags.map((tag) => (
                <span key={tag} style={{ fontFamily: "'Raleway', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#B8963E", background: "rgba(184,150,62,0.15)", padding: "5px 10px" }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Breakdown bars */}
          {result.scoreBreakdown && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "20px", marginTop: "12px" }}>
              {CATEGORY_LABELS.map((c) => (
                <BreakdownBar
                  key={c.key}
                  label={c.label}
                  score={result.scoreBreakdown![c.key].score}
                  weight={result.scoreBreakdown![c.key].weight}
                />
              ))}
            </div>
          )}

          {/* What worked / held back */}
          {((result.whatWorked?.length ?? 0) > 0 || (result.whatHeldItBack?.length ?? 0) > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "20px", paddingTop: "18px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <div>
                <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "9.5px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: "10px" }}>
                  What worked
                </p>
                {(result.whatWorked ?? []).length > 0 ? (
                  (result.whatWorked ?? []).map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#7CB67C", marginTop: "6px", flexShrink: 0 }} />
                      <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontSize: "12px", color: "rgba(255,255,255,0.75)", lineHeight: 1.45 }}>
                        {s}
                      </span>
                    </div>
                  ))
                ) : (
                  <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontStyle: "italic", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>—</span>
                )}
              </div>
              <div>
                <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "9.5px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: "10px" }}>
                  What held it back
                </p>
                {(result.whatHeldItBack ?? []).length > 0 ? (
                  (result.whatHeldItBack ?? []).map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#D4A85C", marginTop: "6px", flexShrink: 0 }} />
                      <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontSize: "12px", color: "rgba(255,255,255,0.75)", lineHeight: 1.45 }}>
                        {s}
                      </span>
                    </div>
                  ))
                ) : (
                  <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontStyle: "italic", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>—</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!result && !loading && (
        <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontStyle: "italic", fontSize: "13px", color: "rgba(255,255,255,0.3)" }}>
          Enter any hotel, resort, or destination above.
        </p>
      )}
    </div>
  );
}

/* ─── Card shell ─── */
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "white", border: "1px solid #E5E0D8", padding: "24px 26px", ...style }}>
      {children}
    </div>
  );
}

function CardEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#B8963E", marginBottom: "16px" }}>
      {children}
    </p>
  );
}

/* ─── Dashboard ─── */
export default function Home() {
  const { data: rawSummary, isLoading } = useGetTravelSummary();
  const summary = rawSummary as any;

  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <Layout>
        <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <Skeleton style={{ height: "58px", width: "320px", borderRadius: "2px" }} />
            <Skeleton style={{ height: "22px", width: "260px", borderRadius: "2px" }} />
          </div>
          <Skeleton style={{ height: "140px", borderRadius: "2px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <Skeleton style={{ height: "360px", borderRadius: "2px" }} />
            <Skeleton style={{ height: "360px", borderRadius: "2px" }} />
          </div>
        </div>
      </Layout>
    );
  }

  const userName: string = summary?.userName ?? "Traveller";
  const allTravelers: any[] = summary?.travelers ?? [];
  const preferences: any = summary?.preferences ?? {};
  const loyaltyPrograms: any[] = summary?.loyaltyPrograms ?? [];
  const favoriteProperties: any[] = summary?.favoriteProperties ?? [];
  const tripProfiles: any[] = summary?.tripProfiles ?? [];
  const personality: string | null = summary?.personality ?? null;
  const travelStyles: string[] = (preferences.travelStyles as string[] | null) ?? [];

  /* Traveler filtering based on active profile */
  const activeProfile = activeProfileId != null ? tripProfiles.find((p) => p.id === activeProfileId) : null;
  const displayedTravelers = activeProfile
    ? allTravelers.filter((t) => (activeProfile.travelerIds as number[]).includes(t.id))
    : allTravelers;

  const adultTravelers = displayedTravelers.filter((t) => t.travelerType === "adult");
  const childTravelers = displayedTravelers.filter((t) => t.travelerType === "child");
  const childAges = childTravelers.filter((c) => c.ageYears != null).map((c) => c.ageYears as number);

  let autofillLine = "";
  if (displayedTravelers.length > 0) {
    autofillLine = `Ready to fill: ${adultTravelers.length} ${adultTravelers.length === 1 ? "adult" : "adults"}`;
    if (childTravelers.length > 0)
      autofillLine += `, ${childTravelers.length} ${childTravelers.length === 1 ? "child" : "children"}${childAges.length > 0 ? ` (ages ${childAges.join(", ")})` : ""}`;
  }

  /* Style & property derived data */
  const lovedProperties = favoriteProperties.filter((p) => p.tier === "loved");
  const topStyles = travelStyles.slice(0, 6);
  const topStyleId = travelStyles[0] ?? null;
  const subtitle = buildSubtitle(allTravelers, loyaltyPrograms, lovedProperties, topStyleId);
  const shownLoyalty = loyaltyPrograms.slice(0, 4);
  const extraLoyalty = Math.max(0, loyaltyPrograms.length - 4);

  return (
    <Layout>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.4 } 50% { opacity: 1 } }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>

        {/* ── Page header ── */}
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: "48px", color: "#1C1C1C", letterSpacing: "-0.01em", lineHeight: 1.1 }}>
            {getGreeting()}, {userName}.
          </h1>
          <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 400, fontSize: "18px", color: "#5C5248", marginTop: "10px", lineHeight: 1.5 }}>
            {subtitle}
          </p>
          <div style={{ height: "1px", background: "#E5E0D8", marginTop: "28px" }} />
        </div>

        {/* ── Section 1: Travel party (full width) ── */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <CardEyebrow>Travel Party</CardEyebrow>
            <Link href="/travelers" style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", color: "#6B2737", textDecoration: "none" }}>
              Manage →
            </Link>
          </div>

          {/* Profile switcher */}
          {tripProfiles.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 10px", marginBottom: "20px" }}>
              <button onClick={() => setActiveProfileId(null)}
                style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: "17px", color: activeProfileId === null ? "#1C1C1C" : "#5C5248", background: "none", border: "none", cursor: "pointer", padding: 0, borderBottom: activeProfileId === null ? "1px solid #1C1C1C" : "1px solid transparent" }}>
                All travelers
              </button>
              {tripProfiles.map((p) => (
                <>
                  <span key={`sep-${p.id}`} style={{ color: "#DDD8CE", fontFamily: "'Raleway', sans-serif" }}>/</span>
                  <button key={p.id} onClick={() => setActiveProfileId(p.id)}
                    style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: "17px", color: activeProfileId === p.id ? "#1C1C1C" : "#5C5248", background: "none", border: "none", cursor: "pointer", padding: 0, borderBottom: activeProfileId === p.id ? "1px solid #1C1C1C" : "1px solid transparent" }}>
                    {p.name}
                  </button>
                </>
              ))}
              <span style={{ color: "#DDD8CE", fontFamily: "'Raleway', sans-serif" }}>/</span>
              <Link href="/travelers" style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "13px", color: "#5C5248", textDecoration: "none" }}>+ New</Link>
            </div>
          )}

          {/* Traveler chips */}
          {displayedTravelers.length > 0 ? (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 24px", marginBottom: "20px" }}>
                {displayedTravelers.map((t: any) => (
                  <TravelerChip key={t.id} name={t.name} ageYears={t.ageYears} travelerType={t.travelerType} />
                ))}
              </div>
              {autofillLine && (
                <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontStyle: "italic", fontSize: "13px", color: "#5C5248" }}>
                  {autofillLine}
                </p>
              )}
            </>
          ) : (
            <div>
              <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: "14px", color: "#5C5248", marginBottom: "14px" }}>
                No travelers added yet.
              </p>
              <Link href="/travelers" className="link-wine" style={{ fontSize: "13px" }}>
                Add your travel party →
              </Link>
            </div>
          )}
        </Card>

        {/* ── Section 2: Two-column cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>

          {/* LEFT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Card A: Travel Style */}
            <Card>
              <CardEyebrow>Your Style</CardEyebrow>
              {personality ? (
                <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 400, fontSize: "17px", color: "#6B2737", lineHeight: 1.6, marginBottom: "18px" }}>
                  {personality}
                </p>
              ) : (
                <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontStyle: "italic", fontSize: "14px", color: "#5C5248", marginBottom: "18px" }}>
                  {travelStyles.length === 0 ? "No travel styles set yet." : "Complete onboarding to generate your personality."}
                </p>
              )}
              {topStyles.length > 0 && (
                <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: "14px", color: "#5C5248", lineHeight: 1.8, marginBottom: "18px" }}>
                  {topStyles.map(getStyleLabel).join(", ")}
                </p>
              )}
              <Link href="/preferences" className="link-wine" style={{ fontSize: "13px" }}>
                Edit preferences →
              </Link>
            </Card>

            {/* Card B: Loyalty Programs */}
            <Card>
              <CardEyebrow>Loyalty</CardEyebrow>
              {shownLoyalty.length > 0 ? (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "16px" }}>
                    {shownLoyalty.map((lp: any) => (
                      <div key={lp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: "12px", borderBottom: "1px solid #F0EBE3" }}>
                        <div>
                          <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 500, fontSize: "14px", color: "#1C1C1C" }}>
                            {lp.programName || lp.brand}
                          </span>
                          {lp.tier && (
                            <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontStyle: "italic", fontSize: "12px", color: "#B8963E", marginLeft: "8px" }}>
                              {lp.tier}
                            </span>
                          )}
                        </div>
                        {lp.membershipNumber && (
                          <span style={{ fontFamily: "'Courier New', monospace", fontSize: "12px", color: "#5C5248" }}>
                            {maskNumber(lp.membershipNumber)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {extraLoyalty > 0 && (
                    <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", color: "#5C5248", marginBottom: "12px" }}>+ {extraLoyalty} more</p>
                  )}
                  <Link href="/stays" className="link-wine" style={{ fontSize: "13px" }}>
                    Manage programs →
                  </Link>
                </>
              ) : (
                <>
                  <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontStyle: "italic", fontSize: "14px", color: "#5C5248", marginBottom: "16px" }}>
                    No programs saved yet.
                  </p>
                  <Link href="/stays" className="link-wine" style={{ fontSize: "13px" }}>
                    Add loyalty programs →
                  </Link>
                </>
              )}
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Card C: Loved Properties */}
            <Card>
              <CardEyebrow>Favourite Stays</CardEyebrow>
              {lovedProperties.length > 0 ? (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "18px" }}>
                    {lovedProperties.slice(0, 4).map((p: any) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px", paddingBottom: "12px", borderBottom: "1px solid #F0EBE3" }}>
                        <Heart size={14} fill="#6B2737" color="#6B2737" style={{ marginTop: "3px", flexShrink: 0 }} />
                        <div>
                          <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 500, fontSize: "16px", color: "#1C1C1C", display: "block" }}>
                            {p.propertyName}
                          </span>
                          {(p.location || p.brand) && (
                            <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontStyle: "italic", fontSize: "12px", color: "#5C5248" }}>
                              {[p.brand, p.location].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link href="/stays" className="link-wine" style={{ fontSize: "13px" }}>
                    View all stays →
                  </Link>
                </>
              ) : (
                <>
                  <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontStyle: "italic", fontSize: "14px", color: "#5C5248", marginBottom: "16px" }}>
                    No properties saved yet.
                  </p>
                  <Link href="/stays" className="link-wine" style={{ fontSize: "13px" }}>
                    Add a property →
                  </Link>
                </>
              )}
            </Card>

            {/* Card D: Review Intelligence */}
            <ReviewMatchCard />
          </div>
        </div>

        {/* ── Section 3: Trip Profiles ── */}
        <div>
          <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#B8963E", marginBottom: "18px" }}>
            Trip Profiles
          </p>
          <div style={{ display: "flex", gap: "14px", overflowX: "auto", paddingBottom: "4px" }}>
            {tripProfiles.map((p: any) => {
              const isActive = activeProfileId === p.id;
              const profileTravelers = allTravelers.filter((t) => (p.travelerIds as number[]).includes(t.id));
              const partyDesc = [
                profileTravelers.filter((t) => t.travelerType === "adult").length + " adult" + (profileTravelers.filter((t) => t.travelerType === "adult").length !== 1 ? "s" : ""),
                profileTravelers.filter((t) => t.travelerType === "child").length > 0
                  ? profileTravelers.filter((t) => t.travelerType === "child").length + " child" + (profileTravelers.filter((t) => t.travelerType === "child").length !== 1 ? "ren" : "")
                  : null,
              ].filter(Boolean).join(", ");

              return (
                <button key={p.id} onClick={() => setActiveProfileId(isActive ? null : p.id)}
                  style={{ width: "200px", minWidth: "200px", height: "100px", border: isActive ? "2px solid #6B2737" : "1px dashed #DDD8CE", background: "white", cursor: "pointer", padding: "16px", textAlign: "left", flexShrink: 0, transition: "border 0.15s" }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: isActive ? 700 : 400, fontSize: "18px", color: isActive ? "#6B2737" : "#1C1C1C", marginBottom: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.emoji} {p.name}
                  </div>
                  <div style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontStyle: "italic", fontSize: "12px", color: "#5C5248" }}>
                    {partyDesc || "No travelers assigned"}
                  </div>
                </button>
              );
            })}
            <Link href="/travelers">
              <div style={{ width: "200px", minWidth: "200px", height: "100px", border: "1px dashed #DDD8CE", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "13px", color: "#5C5248" }}>+ Create a profile</span>
              </div>
            </Link>
          </div>
        </div>

        {/* ── Section 3.5: Auto-fill Preview ── */}
        <AutoFillPreview
          adults={adultTravelers.length}
          children={childTravelers.length}
          childAges={childAges}
          partyDescription={`${userName} Family — ${adultTravelers.length} adult${adultTravelers.length === 1 ? "" : "s"}${childTravelers.length > 0 ? `, ${childTravelers.length} kid${childTravelers.length === 1 ? "" : "s"}` : ""}`}
        />

        {/* ── Section 3.75: Review Sorter ── */}
        <ReviewSorter userTags={travelStyles} />

        {/* ── Section 4: Quick actions ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "0", paddingTop: "8px", borderTop: "1px solid #E5E0D8" }}>
          {[
            { label: "Add a traveler", href: "/travelers" },
            { label: "Add a property", href: "/stays" },
            { label: "Edit preferences", href: "/preferences" },
          ].map((action, i) => (
            <div key={action.href} style={{ display: "flex", alignItems: "center" }}>
              {i > 0 && <div style={{ width: "1px", height: "14px", background: "#DDD8CE", margin: "0 20px" }} />}
              <Link href={action.href}
                style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 500, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#5C5248", textDecoration: "none", transition: "color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#6B2737")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#5C5248")}
              >
                {action.label}
              </Link>
            </div>
          ))}
        </div>

      </div>
    </Layout>
  );
}
