import { useState } from "react";
import { Layout } from "@/components/layout";
import { useGetTravelSummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Heart } from "lucide-react";
import { TRAVEL_STYLE_GROUPS } from "@/lib/travel-styles";

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

/* ─── Review Match Card (dark, self-contained) ─── */
function ReviewMatchCard() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ score: number; tags: string[]; headline: string } | null>(null);

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
          style={{ flex: 1, background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.25)", color: "white", fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontSize: "14px", padding: "8px 0", outline: "none", caretColor: "#B8963E" }}
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
          <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontStyle: "italic", fontSize: "14px", color: "rgba(255,255,255,0.4)", animation: "pulse 1.5s ease-in-out infinite" }}>Matching against your profile…</p>
        </div>
      )}

      {result && !loading && (
        <div style={{ textAlign: "center" }}>
          <div style={{ lineHeight: 1 }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "72px", color: "white" }}>{result.score}</span>
          </div>
          <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontSize: "12px", color: "rgba(255,255,255,0.5)", marginTop: "6px", letterSpacing: "0.04em" }}>
            / 100 match for your travel style
          </p>
          {result.headline && (
            <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: "15px", color: "rgba(255,255,255,0.75)", marginTop: "14px", lineHeight: 1.5 }}>
              {result.headline}
            </p>
          )}
          {result.tags.length > 0 && (
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "16px", flexWrap: "wrap" }}>
              {result.tags.map((tag) => (
                <span key={tag} style={{ fontFamily: "'Raleway', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#B8963E", background: "rgba(184,150,62,0.15)", padding: "5px 10px" }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {!result && !loading && (
        <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontStyle: "italic", fontSize: "13px", color: "rgba(255,255,255,0.3)" }}>
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
  const [matchQuery, setMatchQuery] = useState("");

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
          <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 300, fontSize: "18px", color: "#8C8279", marginTop: "10px", lineHeight: 1.5 }}>
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
                style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: "17px", color: activeProfileId === null ? "#1C1C1C" : "#8C8279", background: "none", border: "none", cursor: "pointer", padding: 0, borderBottom: activeProfileId === null ? "1px solid #1C1C1C" : "1px solid transparent" }}>
                All travelers
              </button>
              {tripProfiles.map((p) => (
                <>
                  <span key={`sep-${p.id}`} style={{ color: "#DDD8CE", fontFamily: "'Raleway', sans-serif" }}>/</span>
                  <button key={p.id} onClick={() => setActiveProfileId(p.id)}
                    style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: "17px", color: activeProfileId === p.id ? "#1C1C1C" : "#8C8279", background: "none", border: "none", cursor: "pointer", padding: 0, borderBottom: activeProfileId === p.id ? "1px solid #1C1C1C" : "1px solid transparent" }}>
                    {p.name}
                  </button>
                </>
              ))}
              <span style={{ color: "#DDD8CE", fontFamily: "'Raleway', sans-serif" }}>/</span>
              <Link href="/travelers" style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontSize: "13px", color: "#8C8279", textDecoration: "none" }}>+ New</Link>
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
                <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontStyle: "italic", fontSize: "13px", color: "#8C8279" }}>
                  {autofillLine}
                </p>
              )}
            </>
          ) : (
            <div>
              <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: "14px", color: "#8C8279", marginBottom: "14px" }}>
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
                <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontStyle: "italic", fontSize: "14px", color: "#8C8279", marginBottom: "18px" }}>
                  {travelStyles.length === 0 ? "No travel styles set yet." : "Complete onboarding to generate your personality."}
                </p>
              )}
              {topStyles.length > 0 && (
                <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: "14px", color: "#8C8279", lineHeight: 1.8, marginBottom: "18px" }}>
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
                            <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontStyle: "italic", fontSize: "12px", color: "#B8963E", marginLeft: "8px" }}>
                              {lp.tier}
                            </span>
                          )}
                        </div>
                        {lp.membershipNumber && (
                          <span style={{ fontFamily: "'Courier New', monospace", fontSize: "12px", color: "#8C8279" }}>
                            {maskNumber(lp.membershipNumber)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {extraLoyalty > 0 && (
                    <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", color: "#8C8279", marginBottom: "12px" }}>+ {extraLoyalty} more</p>
                  )}
                  <Link href="/stays" className="link-wine" style={{ fontSize: "13px" }}>
                    Manage programs →
                  </Link>
                </>
              ) : (
                <>
                  <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontStyle: "italic", fontSize: "14px", color: "#8C8279", marginBottom: "16px" }}>
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
                            <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontStyle: "italic", fontSize: "12px", color: "#8C8279" }}>
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
                  <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontStyle: "italic", fontSize: "14px", color: "#8C8279", marginBottom: "16px" }}>
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
                  <div style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontStyle: "italic", fontSize: "12px", color: "#8C8279" }}>
                    {partyDesc || "No travelers assigned"}
                  </div>
                </button>
              );
            })}
            <Link href="/travelers">
              <div style={{ width: "200px", minWidth: "200px", height: "100px", border: "1px dashed #DDD8CE", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontSize: "13px", color: "#8C8279" }}>+ Create a profile</span>
              </div>
            </Link>
          </div>
        </div>

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
                style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 500, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#8C8279", textDecoration: "none", transition: "color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#6B2737")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#8C8279")}
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
