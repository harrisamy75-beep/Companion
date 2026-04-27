import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { Heart, Minus, Star } from "lucide-react";
import { TRAVEL_STYLE_GROUPS } from "@/lib/travel-styles";

/* ─── Types ─── */
interface TravelerEntry {
  name: string;
  type: "adult" | "child";
  relationship?: string;
  birthDate?: string;
}

interface PropertyEntry {
  propertyName: string;
  brand: string;
  location: string;
  tier: "loved" | "liked" | "avoid";
  placeId: string;
}

interface PlaceResult {
  placeId: string;
  name: string;
  location: string;
  brand: string | null;
  priceLevel: number | null;
}

const TIER_META = {
  loved: { label: "Loved", icon: <Heart size={12} fill="currentColor" />, color: "#6B2737" },
  liked: { label: "Liked", icon: <Star size={12} />, color: "#B8963E" },
  avoid: { label: "Avoid", icon: <Minus size={12} />, color: "#5C5248" },
};

/* ─── eyebrow label helper ─── */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#A07840", display: "block", marginBottom: "8px" }}>
      {children}
    </span>
  );
}

/* ─── Mini Places Search (used in Step 3) ─── */
function MiniPlacesSearch({ value, onChange, onSelect }: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (r: PlaceResult) => void;
}) {
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [unavailable, setUnavailable] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); setUnavailable(false); return; }
    try {
      const r = await apiFetch(`/api/places/search?q=${encodeURIComponent(q)}`);
      if (r.ok) {
        const d: PlaceResult[] = await r.json();
        setResults(d);
        setUnavailable(false);
        setOpen(d.length > 0);
      } else if (r.status === 503) {
        setResults([]);
        setUnavailable(true);
        setOpen(true);
      } else {
        setResults([]);
        setUnavailable(false);
      }
    } catch { setResults([]); }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(e.target.value), 300);
  };

  const pick = (r: PlaceResult) => { onSelect(r); setOpen(false); setResults([]); };

  const trimLoc = (raw: string | undefined | null) => {
    if (!raw) return "";
    return raw.split(",").map(s => s.trim()).filter(Boolean).slice(-2).join(", ");
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        className="input-underline"
        value={value}
        onChange={handleChange}
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
          else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); pick(results[activeIdx]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        placeholder="e.g. Rosewood Miramar Beach"
        autoComplete="off"
      />
      {open && (results.length > 0 || unavailable) && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "white", border: "1px solid #E5E0D8", borderRadius: "2px", zIndex: 50 }}>
          {results.filter(r => r && r.name).map((r: any, i) => (
            <div key={r.placeId} onMouseDown={() => pick(r)} onMouseEnter={() => setActiveIdx(i)}
              style={{ padding: "12px 16px", cursor: "pointer", background: activeIdx === i ? "#F5F0E6" : "white", borderBottom: i < results.length - 1 ? "1px solid #F0EBE3" : "none" }}>
              <div className="font-playfair" style={{ fontSize: "14px", color: "#1C1C1C", fontWeight: 500 }}>{r.name}</div>
              <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: "11px", color: "#5C5248", fontStyle: "italic", marginTop: "2px" }}>{trimLoc(r.location ?? r.formatted_address ?? "")}</div>
            </div>
          ))}
          {unavailable && (
            <div style={{ padding: "12px 16px" }}>
              <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: "11px", color: "#6B2737", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "4px" }}>
                Hotel search unavailable
              </div>
              <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", color: "#5C5248", lineHeight: 1.5 }}>
                The directory is offline right now — type the name and continue to add it manually.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────
   STEP 1 — Travel party
───────────────────────────────────────────────── */
function Step1({ userId, travelers, setTravelers }: {
  userId: string;
  travelers: TravelerEntry[];
  setTravelers: React.Dispatch<React.SetStateAction<TravelerEntry[]>>;
}) {
  const { user } = useUser();
  const displayName = user?.firstName ?? user?.fullName ?? "You";
  const [addForm, setAddForm] = useState<"adult" | "child" | null>(null);
  const [formName, setFormName] = useState("");
  const [formRelationship, setFormRelationship] = useState("partner");
  const [formBirthDate, setFormBirthDate] = useState("");

  const handleAdd = () => {
    const name = formName.trim();
    if (!name) return;
    if (addForm === "adult") {
      setTravelers(t => [...t, { name, type: "adult", relationship: formRelationship }]);
    } else {
      setTravelers(t => [...t, { name, type: "child", birthDate: formBirthDate || undefined }]);
    }
    setFormName(""); setFormRelationship("partner"); setFormBirthDate(""); setAddForm(null);
  };

  const removeAt = (i: number) => setTravelers(t => t.filter((_, idx) => idx !== i));

  const ageFrom = (bd?: string) => {
    if (!bd) return null;
    return new Date().getFullYear() - new Date(bd).getFullYear();
  };

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: "36px", color: "#1C1C1C", letterSpacing: "-0.01em", marginBottom: "10px" }}>
        First, tell us about your travel party.
      </h2>
      <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "16px", color: "#5C5248", marginBottom: "32px", lineHeight: 1.6 }}>
        Add everyone you typically travel with — you, your partner, kids, whoever.
      </p>

      {/* Self card (pre-populated) */}
      <div style={{ padding: "14px 18px", background: "white", border: "1px solid #E5E0D8", marginBottom: "12px", display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{ width: "36px", height: "36px", background: "#6B2737", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span className="font-playfair" style={{ fontStyle: "italic", fontWeight: 700, fontSize: "16px", color: "white" }}>{displayName.charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "14px", color: "#1C1C1C" }}>{displayName}</span>
          <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", color: "#5C5248", marginLeft: "10px" }}>Adult · Self</span>
        </div>
      </div>

      {/* Added travelers */}
      {travelers.map((t, i) => (
        <div key={i} style={{ padding: "14px 18px", background: "white", border: "1px solid #E5E0D8", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "36px", height: "36px", background: t.type === "child" ? "#B8963E" : "#1C1C1C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span className="font-playfair" style={{ fontStyle: "italic", fontWeight: 700, fontSize: "16px", color: "white" }}>{t.name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "14px", color: "#1C1C1C" }}>{t.name}</span>
              <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", color: "#5C5248", marginLeft: "10px" }}>
                {t.type === "adult" ? `Adult · ${t.relationship}` : `Child${ageFrom(t.birthDate) ? ` · ${ageFrom(t.birthDate)}` : ""}`}
              </span>
            </div>
          </div>
          <button onClick={() => removeAt(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#5C5248", fontSize: "18px", lineHeight: 1 }}>×</button>
        </div>
      ))}

      {/* Tap targets */}
      {!addForm && (
        <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
          {(["adult", "child"] as const).map(type => (
            <button key={type} onClick={() => setAddForm(type)}
              style={{ flex: 1, height: "120px", border: "1px dashed #DDD8CE", background: "white", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px", transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#F5F0E6")}
              onMouseLeave={e => (e.currentTarget.style.background = "white")}
            >
              <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 500, fontSize: "14px", color: "#5C5248" }}>
                {type === "adult" ? "+ Add an adult" : "+ Add a child"}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Inline add form */}
      {addForm && (
        <div style={{ marginTop: "16px", padding: "22px 20px", background: "white", border: "1px solid #E5E0D8" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div>
              <Eyebrow>Name</Eyebrow>
              <input autoFocus className="input-underline" value={formName} onChange={e => setFormName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()} placeholder={addForm === "adult" ? "e.g. Greg" : "e.g. Ella"} />
            </div>
            {addForm === "adult" && (
              <div>
                <Eyebrow>Relationship</Eyebrow>
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                  {["partner", "friend", "parent", "other"].map(r => (
                    <button key={r} type="button" onClick={() => setFormRelationship(r)}
                      style={{ fontFamily: "'Raleway', sans-serif", fontSize: "14px", fontWeight: 400, color: formRelationship === r ? "#6B2737" : "#5C5248", background: "none", border: "none", borderBottom: formRelationship === r ? "2px solid #6B2737" : "2px solid transparent", paddingBottom: "3px", cursor: "pointer", textTransform: "capitalize" }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {addForm === "child" && (
              <div>
                <Eyebrow>Birth date</Eyebrow>
                <input className="input-underline" type="date" value={formBirthDate} onChange={e => setFormBirthDate(e.target.value)} max={new Date().toISOString().split("T")[0]} style={{ width: "180px" }} />
              </div>
            )}
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="button" onClick={handleAdd} disabled={!formName.trim()} className="btn-wine" style={{ height: "40px", width: "100px" }}>Add</button>
              <button type="button" onClick={() => { setAddForm(null); setFormName(""); }} style={{ height: "40px", padding: "0 16px", background: "transparent", border: "1px solid #E5E0D8", cursor: "pointer", fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "13px", color: "#5C5248" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!addForm && (
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button onClick={() => setTravelers([])} style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "13px", color: "#5C5248", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textDecorationColor: "#DDD8CE" }}>
            {travelers.length === 0 ? "Just me for now" : "Clear all"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────
   STEP 2 — Travel style
───────────────────────────────────────────────── */
function Step2({ styles, setStyles }: { styles: string[]; setStyles: React.Dispatch<React.SetStateAction<string[]>> }) {
  const toggle = (id: string) =>
    setStyles(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const uniqueSelected = Array.from(new Set(styles));

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: "36px", color: "#1C1C1C", letterSpacing: "-0.01em", marginBottom: "10px" }}>
        Your travel style.
      </h2>
      <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "16px", color: "#5C5248", marginBottom: "32px", lineHeight: 1.6 }}>
        Select everything that feels like you. You can always change this.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
        {TRAVEL_STYLE_GROUPS.map(group => (
          <div key={group.label}>
            <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#A07840", marginBottom: "14px" }}>
              {group.label}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 24px" }}>
              {group.styles.map(style => {
                const on = styles.includes(style.id);
                return (
                  <button key={`${group.label}-${style.id}`} type="button" onClick={() => toggle(style.id)}
                    style={{ fontFamily: "'Playfair Display', serif", fontWeight: 400, fontSize: "15px", color: on ? "#6B2737" : "#5C5248", background: "none", border: "none", borderBottom: on ? "2px solid #6B2737" : "2px solid transparent", paddingBottom: "3px", cursor: "pointer", transition: "color 0.15s, border-color 0.15s", lineHeight: 2.2 }}>
                    {style.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Live counter */}
      <div style={{ textAlign: "right", marginTop: "24px" }}>
        <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontStyle: "italic", fontSize: "13px", color: "#5C5248" }}>
          {uniqueSelected.length > 0 ? `${uniqueSelected.length} selected` : "Select anything that resonates"}
        </span>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────
   STEP 3 — Favourite properties
───────────────────────────────────────────────── */
function Step3({ properties, setProperties }: {
  properties: PropertyEntry[];
  setProperties: React.Dispatch<React.SetStateAction<PropertyEntry[]>>;
}) {
  const EMPTY = { propertyName: "", brand: "", location: "", tier: "liked" as const, placeId: "" };
  const [form, setForm] = useState({ ...EMPTY });
  const [showForm, setShowForm] = useState(true);

  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }));

  const handlePlaceSelect = (r: PlaceResult) => {
    const parts = r.location.split(",").map(s => s.trim()).filter(Boolean);
    const loc = parts.slice(-2).join(", ");
    setForm(f => ({ ...f, propertyName: r.name, brand: r.brand ?? f.brand, location: loc, placeId: r.placeId }));
  };

  const handleAdd = () => {
    if (!form.propertyName.trim()) return;
    setProperties(p => [...p, { ...form, propertyName: form.propertyName.trim() }]);
    setForm({ ...EMPTY });
    setShowForm(false);
  };

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: "36px", color: "#1C1C1C", letterSpacing: "-0.01em", marginBottom: "10px" }}>
        Places you've loved.
      </h2>
      <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "16px", color: "#5C5248", marginBottom: "32px", lineHeight: 1.6 }}>
        Hotels, resorts, restaurants — anywhere that set the standard for you.
      </p>

      {/* Added property cards */}
      {properties.length > 0 && (
        <div style={{ marginBottom: "24px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {properties.map((p, i) => {
            const tm = TIER_META[p.tier];
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "white", border: "1px solid #E5E0D8" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: tm.color, display: "flex", alignItems: "center" }}>{tm.icon}</span>
                  <span className="font-playfair" style={{ fontWeight: 500, fontSize: "15px", color: "#1C1C1C" }}>{p.propertyName}</span>
                  {p.location && <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", color: "#5C5248", fontStyle: "italic" }}>{p.location}</span>}
                </div>
                <button onClick={() => setProperties(ps => ps.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#5C5248", fontSize: "16px" }}>×</button>
              </div>
            );
          })}

          {/* Encouraging message */}
          <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontStyle: "italic", fontSize: "13px", color: "#5C5248", marginTop: "4px", animation: "obFadeIn 0.4s ease both" }}>
            Great — we'll use this to calibrate your review matches.
          </p>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <Eyebrow>Property name</Eyebrow>
            <MiniPlacesSearch
              value={form.propertyName}
              onChange={v => setF("propertyName", v)}
              onSelect={handlePlaceSelect}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <Eyebrow>Brand (optional)</Eyebrow>
              <input className="input-underline" value={form.brand} onChange={e => setF("brand", e.target.value)} placeholder="Rosewood" />
            </div>
            <div>
              <Eyebrow>Location</Eyebrow>
              <input className="input-underline" value={form.location} onChange={e => setF("location", e.target.value)} placeholder="Montecito, CA" />
            </div>
          </div>

          <div>
            <Eyebrow>Your rating</Eyebrow>
            <div style={{ display: "flex", gap: "20px" }}>
              {(["loved", "liked", "avoid"] as const).map(t => {
                const tm = TIER_META[t];
                return (
                  <button key={t} type="button" onClick={() => setF("tier", t)}
                    style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: form.tier === t ? tm.color : "#5C5248", background: "none", border: "none", borderBottom: form.tier === t ? `2px solid ${tm.color}` : "2px solid transparent", paddingBottom: "3px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    {tm.icon} {tm.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button type="button" onClick={handleAdd} disabled={!form.propertyName.trim()} className="btn-wine" style={{ height: "40px", width: "120px", alignSelf: "flex-start" }}>
            Add property
          </button>
        </div>
      )}

      {!showForm && (
        <button onClick={() => { setShowForm(true); setForm({ ...EMPTY }); }}
          style={{ fontFamily: "'Raleway', sans-serif", fontSize: "13px", color: "#6B2737", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          + Add another
        </button>
      )}

      <div style={{ marginTop: showForm ? "16px" : "12px" }}>
        <button onClick={() => { setProperties([]); setShowForm(true); }}
          style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "13px", color: "#5C5248", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textDecorationColor: "#DDD8CE" }}>
          Skip for now
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────
   STEP 4 — Summary + personality
───────────────────────────────────────────────── */
function Step4({ userId, travelers, travelStyles, properties }: {
  userId: string;
  travelers: TravelerEntry[];
  travelStyles: string[];
  properties: PropertyEntry[];
}) {
  const { user } = useUser();
  const displayName = user?.firstName ?? user?.fullName ?? "You";
  const [personality, setPersonality] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch("/api/personality", {
          method: "POST",
          
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: displayName, travelers, travelStyles, favoriteProperties: properties }),
        });
        if (res.ok) {
          const d = await res.json();
          setPersonality(d.personality);
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const ageFrom = (bd?: string) => bd ? new Date().getFullYear() - new Date(bd).getFullYear() : null;

  const partyDesc = travelers.length > 0
    ? travelers.map(t => {
        if (t.type === "child") { const a = ageFrom(t.birthDate); return `${t.name}${a ? ` (${a})` : ""}`; }
        return `${t.name} (${t.relationship})`;
      }).join(", ")
    : "Just you for now";

  const topStyles = Array.from(new Set(travelStyles)).slice(0, 5);

  const SummaryRow = ({ label, value }: { label: string; value: string }) => (
    <div style={{ paddingTop: "16px" }}>
      <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#A07840", display: "block", marginBottom: "6px" }}>{label}</span>
      <span className="font-playfair" style={{ fontStyle: "italic", fontSize: "15px", color: "#5C5248" }}>{value}</span>
    </div>
  );

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: "36px", color: "#1C1C1C", letterSpacing: "-0.01em", marginBottom: "10px" }}>
        Your profile is ready.
      </h2>
      <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "16px", color: "#5C5248", marginBottom: "32px", lineHeight: 1.6 }}>
        Here's what we know about you so far.
      </p>

      {/* Summary card */}
      <div style={{ background: "white", border: "1px solid #E5E0D8", padding: "28px 32px", marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
          <div style={{ width: "44px", height: "44px", background: "#6B2737", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span className="font-playfair" style={{ fontStyle: "italic", fontWeight: 700, fontSize: "20px", color: "white" }}>{displayName.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <span className="font-playfair" style={{ fontWeight: 700, fontSize: "20px", color: "#1C1C1C" }}>{displayName}</span>
            <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", color: "#5C5248", marginLeft: "10px" }}>Adult · Self</span>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #E5E0D8" }}>
          <SummaryRow label="Travel Party" value={partyDesc} />
          <div style={{ height: "1px", background: "#F0EBE3", marginTop: "16px" }} />
          <SummaryRow label="Travel Style" value={topStyles.length > 0 ? topStyles.map(id => {
            for (const g of TRAVEL_STYLE_GROUPS) { const s = g.styles.find(s => s.id === id); if (s) return s.label; }
            return id;
          }).join(", ") : "Not set yet"} />
          <div style={{ height: "1px", background: "#F0EBE3", marginTop: "16px" }} />
          <SummaryRow label="Favourite Properties" value={properties.length > 0 ? properties.map(p => p.propertyName).join(", ") : "None added yet"} />
        </div>
      </div>

      {/* Personality block */}
      <div style={{ textAlign: "center", minHeight: "80px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {loading ? (
          <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontStyle: "italic", fontSize: "15px", color: "#5C5248", animation: "obPulse 1.5s ease-in-out infinite" }}>
            Crafting your travel profile…
          </p>
        ) : personality ? (
          <p className="font-playfair" style={{ fontStyle: "italic", fontWeight: 400, fontSize: "18px", color: "#6B2737", lineHeight: 1.6, animation: "obFadeIn 0.6s ease both" }}>
            {personality}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────
   MAIN WIZARD SHELL
───────────────────────────────────────────────── */
export interface OnboardingWizardProps {
  userId: string;
  onComplete: () => void;
}

function ConsentStep({
  consent,
  setConsent,
}: {
  consent: boolean;
  setConsent: (v: boolean) => void;
}) {
  return (
    <div>
      <h2
        style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: "36px",
          color: "#1C1C1C",
          letterSpacing: "-0.01em",
          marginBottom: "10px",
        }}
      >
        Before we begin.
      </h2>
      <p
        style={{
          fontFamily: "'Raleway', sans-serif",
          fontWeight: 400,
          fontSize: "16px",
          color: "#5C5248",
          marginBottom: "32px",
          lineHeight: 1.6,
        }}
      >
        A quick word about your data.
      </p>

      <div
        style={{
          background: "white",
          border: "1px solid #E5E0D8",
          padding: "26px 28px",
          marginBottom: "20px",
        }}
      >
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {[
            "Your party, preferences and stays are saved to your account.",
            "Anthropic's Claude AI scores reviews and your travel style.",
            "We never sell your data or use it to train AI models.",
            "Export or delete your account anytime from Settings.",
          ].map((line) => (
            <li
              key={line}
              style={{
                fontFamily: "'Raleway', sans-serif",
                fontWeight: 300,
                fontSize: "14px",
                color: "#2A2A2A",
                lineHeight: 1.6,
                paddingLeft: "20px",
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  color: "#A07840",
                  fontWeight: 600,
                }}
              >
                ·
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          padding: "14px 16px",
          background: consent ? "#F5F0E6" : "white",
          border: `1px solid ${consent ? "#A07840" : "#E5E0D8"}`,
          cursor: "pointer",
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          style={{
            marginTop: "3px",
            accentColor: "#6B2737",
            cursor: "pointer",
          }}
        />
        <span
          style={{
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 400,
            fontSize: "13px",
            color: "#1C1C1C",
            lineHeight: 1.6,
          }}
        >
          I agree to the{" "}
          <a
            href={`${import.meta.env.BASE_URL}terms`}
            target="_blank"
            rel="noreferrer"
            style={{ color: "#6B2737", textDecoration: "underline" }}
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href={`${import.meta.env.BASE_URL}privacy`}
            target="_blank"
            rel="noreferrer"
            style={{ color: "#6B2737", textDecoration: "underline" }}
          >
            Privacy Policy
          </a>
          , and consent to AI-assisted review scoring and personality generation.
        </span>
      </label>
    </div>
  );
}

export function OnboardingWizard({ userId, onComplete }: OnboardingWizardProps) {
  const TOTAL = 5;
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [saving, setSaving] = useState(false);

  const [consent, setConsent] = useState(false);
  const [travelers, setTravelers] = useState<TravelerEntry[]>([]);
  const [travelStyles, setTravelStyles] = useState<string[]>([]);
  const [properties, setProperties] = useState<PropertyEntry[]>([]);

  const handleSkip = () => {
    if (!consent) return;
    localStorage.setItem("onboardingComplete", "true");
    apiFetch("/api/account/consent", {
      method: "POST",
      body: JSON.stringify({ version: "1.0" }),
    }).catch(() => {});
    onComplete();
  };

  const handleBack = () => {
    setDirection("back");
    setStep(s => s - 1);
  };

  const handleNext = async () => {
    if (step < TOTAL) {
      setDirection("forward");
      setStep(s => s + 1);
      return;
    }

    setSaving(true);
    try {
      const saves: Promise<unknown>[] = [];

      saves.push(apiFetch("/api/account/consent", {
        method: "POST",
        body: JSON.stringify({ version: "1.0" }),
      }));

      travelers.forEach(t => {
        saves.push(apiFetch("/api/travelers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: t.name, travelerType: t.type, relationship: t.relationship, birthDate: t.birthDate }),
        }));
      });

      properties.forEach(p => {
        saves.push(apiFetch("/api/properties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyName: p.propertyName, brand: p.brand || null, location: p.location || null, tier: p.tier }),
        }));
      });

      saves.push(apiFetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ travelStyles: Array.from(new Set(travelStyles)) }),
      }));

      await Promise.allSettled(saves);
    } finally {
      setSaving(false);
      localStorage.setItem("onboardingComplete", "true");
      onComplete();
    }
  };

  const wordmarkClick = () => {
    if (step === 1) return;
    if (window.confirm("Go back to the beginning? Entries on the current step won't be saved.")) {
      setDirection("back");
      setStep(1);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F5F0E6", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes slideFromRight { from { transform: translateX(48px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideFromLeft  { from { transform: translateX(-48px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes obFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes obPulse   { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        .ob-slide-forward { animation: slideFromRight 0.28s cubic-bezier(.22,.68,0,1.2) both; }
        .ob-slide-back    { animation: slideFromLeft  0.28s cubic-bezier(.22,.68,0,1.2) both; }
      `}</style>

      {/* Top chrome */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "28px 36px", flexShrink: 0 }}>
        <button onClick={wordmarkClick} style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: "18px", color: "#1C1C1C", background: "none", border: "none", cursor: step > 1 ? "pointer" : "default", padding: 0 }}>
          Companion
        </button>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: i + 1 === step ? "#6B2737" : "#DDD8CE", transition: "background 0.3s" }} />
          ))}
        </div>

        {step > 1 ? (
          <button onClick={handleSkip} style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "11px", color: "#5C5248", background: "none", border: "none", cursor: "pointer", letterSpacing: "0.03em" }}>
            Skip setup
          </button>
        ) : <div style={{ width: 60 }} />}
      </div>

      {/* Step content */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 24px 0" }}>
        <div
          key={step}
          className={direction === "forward" ? "ob-slide-forward" : "ob-slide-back"}
          style={{ width: "100%", maxWidth: "520px", paddingBottom: "56px" }}
        >
          {step === 1 && <ConsentStep consent={consent} setConsent={setConsent} />}
          {step === 2 && <Step1 userId={userId} travelers={travelers} setTravelers={setTravelers} />}
          {step === 3 && <Step2 styles={travelStyles} setStyles={setTravelStyles} />}
          {step === 4 && <Step3 properties={properties} setProperties={setProperties} />}
          {step === 5 && <Step4 userId={userId} travelers={travelers} travelStyles={travelStyles} properties={properties} />}
        </div>
      </div>

      {/* Bottom navigation */}
      <div style={{ flexShrink: 0, padding: "20px 36px 36px", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "592px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {step > 1 ? (
          <button onClick={handleBack} style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "14px", color: "#5C5248", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Back
          </button>
        ) : <div />}

        <button
          onClick={handleNext}
          disabled={saving || (step === 1 && !consent)}
          style={{
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 600,
            fontSize: "11px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            background: saving || (step === 1 && !consent) ? "#B6A89B" : "#6B2737",
            color: "white",
            border: "none",
            borderRadius: 0,
            cursor: saving || (step === 1 && !consent) ? "default" : "pointer",
            height: "44px",
            width: step === TOTAL ? "220px" : step === 1 ? "180px" : "180px",
            transition: "width 0.2s, background 0.15s",
          }}
        >
          {saving
            ? "Saving…"
            : step === 1
            ? "I agree, continue →"
            : step === TOTAL
            ? "Open my dashboard →"
            : "Next"}
        </button>
      </div>
    </div>
  );
}
