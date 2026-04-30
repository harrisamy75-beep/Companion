import { useState, useRef, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Heart, Minus, Star } from "lucide-react";

/* ─── Types ─── */
interface FavoriteProperty {
  id: number;
  userId: string;
  propertyName: string;
  brand: string | null;
  location: string | null;
  category: string | null;
  tier: string | null;
  tags: string[];
  notes: string | null;
  visitedAt: string | null;
  starRating: number | null;
  guestScore: string | null;
  pricePerNight: number | null;
  createdAt: string;
}

interface PlaceResult {
  placeId: string;
  name: string;
  location: string;
  brand: string | null;
  rating: number | null;
  priceLevel: number | null;
}

/* ─── Constants ─── */
const LUXURY_BRANDS = [
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

const WHAT_YOU_LOVED_OPTIONS = [
  "Service", "Food", "Design", "Value", "Location",
  "Spa", "Beach", "Kids", "Vibe", "Rooms",
];

const TIER_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  loved: { label: "Loved", icon: <Heart size={13} fill="currentColor" />, color: "#6B2737" },
  liked: { label: "Liked", icon: <Star size={13} />, color: "#B8963E" },
  avoid: { label: "Avoid", icon: <Minus size={13} />, color: "#5C5248" },
};

/* ─── Hooks ─── */
function useProperties() {
  const qc = useQueryClient();
  const KEY = ["properties"];
  const query = useQuery<FavoriteProperty[]>({
    queryKey: KEY,
    queryFn: async () => {
      const r = await apiFetch("/api/properties");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const inv = () => qc.invalidateQueries({ queryKey: KEY });
  const create = useMutation({
    mutationFn: async (d: Partial<FavoriteProperty>) => {
      const r = await apiFetch("/api/properties", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
      if (!r.ok) throw new Error("Failed"); return r.json();
    }, onSuccess: inv,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...d }: Partial<FavoriteProperty> & { id: number }) => {
      const r = await apiFetch(`/api/properties/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
      if (!r.ok) throw new Error("Failed"); return r.json();
    }, onSuccess: inv,
  });
  const remove = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiFetch(`/api/properties/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed");
    }, onSuccess: inv,
  });
  return { query, create, update, remove };
}

/* ─── Inline text field ─── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span className="eyebrow">{label}</span>
      {children}
    </div>
  );
}

/* ─── Property Card ─── */
function PropertyCard({ property, onEdit, onDelete }: {
  property: FavoriteProperty; onEdit: () => void; onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const tierMeta = TIER_LABELS[property.tier ?? "liked"] ?? TIER_LABELS.liked;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "22px 0",
        borderBottom: "1px solid #E5E0D8",
        borderLeft: hovered ? "3px solid #6B2737" : "3px solid transparent",
        paddingLeft: hovered ? "18px" : "0",
        transition: "border-color 0.2s, padding-left 0.2s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span
              className="font-playfair"
              style={{ fontWeight: 700, fontSize: "20px", color: "#1C1C1C" }}
            >
              {property.propertyName}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: tierMeta.color, fontSize: "11px", fontFamily: "'Raleway', sans-serif", fontWeight: 500 }}>
              {tierMeta.icon} {tierMeta.label}
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px", alignItems: "baseline" }}>
            {property.starRating && (
              <span style={{ color: "#6B2737", fontSize: "13px", letterSpacing: "0.04em" }}>
                {"★".repeat(property.starRating)}
              </span>
            )}
            {property.brand && (
              <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", color: "#5C5248" }}>
                {property.brand}
              </span>
            )}
            {property.location && (
              <span className="font-playfair" style={{ fontStyle: "italic", fontSize: "13px", color: "#5C5248" }}>
                {property.brand ? "· " : ""}{property.location}
              </span>
            )}
            {property.pricePerNight && (
              <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", color: "#5C5248" }}>
                · ~${property.pricePerNight}/night
              </span>
            )}
            {property.visitedAt && (
              <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", color: "#B8963E" }}>
                {property.visitedAt}
              </span>
            )}
          </div>

          {property.tags && property.tags.length > 0 && (
            <p className="font-playfair" style={{ fontStyle: "italic", fontWeight: 400, fontSize: "14px", color: "#5C5248", marginTop: "8px" }}>
              {property.tags.join(", ")}
            </p>
          )}
          {property.notes && (
            <p style={{ fontFamily: "'Raleway', sans-serif", fontStyle: "italic", fontSize: "13px", color: "#5C5248", marginTop: "4px" }}>
              {property.notes}
            </p>
          )}
        </div>

        {(hovered) && (
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            <button onClick={onEdit} style={{ fontFamily: "'Raleway', sans-serif", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B2737", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
            <button onClick={onDelete} style={{ fontFamily: "'Raleway', sans-serif", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#5C5248", background: "none", border: "none", cursor: "pointer" }}>Remove</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Places Autocomplete ─── */
function priceDots(level: number | null) {
  if (!level) return null;
  return "·".repeat(level);
}

function trimLocation(raw: string): string {
  const parts = raw.split(",").map(s => s.trim()).filter(Boolean);
  return parts.slice(-2).join(", ");
}

interface PlacesAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  onSelect: (result: PlaceResult) => void;
  placeholder?: string;
}

function PlacesAutocomplete({ value, onChange, onSelect, placeholder }: PlacesAutocompleteProps) {
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const r = await apiFetch(`/api/places/search?q=${encodeURIComponent(q)}`);
      if (r.ok) {
        const data: PlaceResult[] = await r.json();
        setResults(data);
        setUnavailable(false);
        setOpen(true);
        setActiveIdx(-1);
      } else if (r.status === 503) {
        setResults([]);
        setUnavailable(true);
        setOpen(q.length >= 3);
      } else {
        setResults([]);
        setUnavailable(false);
        setOpen(q.length >= 3);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 300);
  };

  const handleSelect = (result: PlaceResult | null) => {
    if (result) {
      onSelect(result);
    } else {
      onChange(value);
    }
    setOpen(false);
    setResults([]);
    setActiveIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const total = results.length > 0 ? results.length : (value.length >= 3 ? 1 : 0);
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, total - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < results.length) handleSelect(results[activeIdx]);
      else if (results.length === 0 && value.length >= 3) handleSelect(null);
      else setOpen(false);
    } else if (e.key === "Escape") { setOpen(false); setActiveIdx(-1); }
  };

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const showCustomOption = open && results.length === 0 && value.length >= 3 && !loading && !unavailable;
  const showUnavailable = open && unavailable && value.length >= 3 && !loading;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        className="input-underline"
        required
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Rosewood Miramar Beach"}
        autoComplete="off"
      />
      {open && (results.length > 0 || showCustomOption || showUnavailable) && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "white",
            border: "1px solid #E5E0D8",
            borderRadius: "2px",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          {results.map((r, i) => (
            <div
              key={r.placeId}
              onMouseDown={() => handleSelect(r)}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                padding: "14px 16px",
                cursor: "pointer",
                background: activeIdx === i ? "#F5F0E6" : "white",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "12px",
                borderBottom: i < results.length - 1 ? "1px solid #F0EBE3" : "none",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="font-playfair"
                  style={{ fontSize: "15px", color: "#1C1C1C", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {r.name}
                </div>
                <div
                  style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", color: "#5C5248", fontStyle: "italic", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {trimLocation(r.location)}
                </div>
              </div>
              {r.priceLevel && (
                <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", color: "#B8963E", flexShrink: 0, marginTop: "2px" }}>
                  {priceDots(r.priceLevel)}
                </span>
              )}
            </div>
          ))}
          {showCustomOption && (
            <div
              onMouseDown={() => handleSelect(null)}
              style={{ padding: "14px 16px", cursor: "pointer", background: activeIdx === 0 ? "#F5F0E6" : "white" }}
            >
              <span
                className="font-playfair"
                style={{ fontStyle: "italic", fontSize: "14px", color: "#5C5248" }}
              >
                Add "{value}" as a custom property
              </span>
            </div>
          )}
          {showUnavailable && (
            <div style={{ padding: "14px 16px", borderTop: results.length > 0 ? "1px solid #F0EBE3" : "none" }}>
              <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", color: "#6B2737", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "4px" }}>
                Hotel search unavailable
              </div>
              <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: "13px", color: "#5C5248", lineHeight: 1.5, marginBottom: "8px" }}>
                We can't reach the hotel directory right now. You can still add this property by hand.
              </div>
              <div
                onMouseDown={() => handleSelect(null)}
                style={{ cursor: "pointer", display: "inline-block" }}
              >
                <span className="font-playfair" style={{ fontStyle: "italic", fontSize: "14px", color: "#1C1C1C", borderBottom: "1px solid #1C1C1C" }}>
                  Add "{value}" manually
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Property form ─── */
type PropForm = {
  propertyName: string; brand: string; location: string; category: string;
  tier: string; tags: string[]; notes: string; visitedAt: string; placeId: string;
  starRating: number | null; pricePerNight: string;
};

const EMPTY_PROP: PropForm = { propertyName: "", brand: "", location: "", category: "hotel", tier: "liked", tags: [], notes: "", visitedAt: "", placeId: "", starRating: null, pricePerNight: "" };

function normalizePropForm(f: PropForm): Partial<FavoriteProperty> {
  const price = f.pricePerNight.trim();
  return {
    ...f,
    pricePerNight: price ? Number(price) : null,
  };
}

function PropertyForm({ initial, onSubmit, onCancel, loading }: {
  initial?: PropForm; onSubmit: (f: PropForm) => void; onCancel: () => void; loading: boolean;
}) {
  const [form, setForm] = useState<PropForm>(initial ?? EMPTY_PROP);
  const set = <K extends keyof PropForm>(k: K, v: PropForm[K]) => setForm(f => ({ ...f, [k]: v }));
  const toggleTag = (t: string) => setForm(f => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t] }));

  const handlePlaceSelect = (result: PlaceResult) => {
    setForm(f => ({
      ...f,
      propertyName: result.name,
      location: trimLocation(result.location),
      brand: result.brand ?? f.brand,
      placeId: result.placeId,
    }));
  };

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(form); }}
      style={{ display: "flex", flexDirection: "column", gap: "18px" }}
    >
      <Field label="Property name">
        <PlacesAutocomplete
          value={form.propertyName}
          onChange={v => set("propertyName", v)}
          onSelect={handlePlaceSelect}
          placeholder="Rosewood Miramar Beach"
        />
      </Field>

      <Field label="Brand">
        <input className="input-underline" value={form.brand} onChange={e => set("brand", e.target.value)} placeholder="Rosewood" list="brand-list" />
        <datalist id="brand-list">
          {LUXURY_BRANDS.map(b => <option key={b} value={b} />)}
        </datalist>
      </Field>

      <Field label="Location">
        <input className="input-underline" value={form.location} onChange={e => set("location", e.target.value)} placeholder="Montecito, CA" />
      </Field>

      <Field label="Visited">
        <input className="input-underline" value={form.visitedAt} onChange={e => set("visitedAt", e.target.value)} placeholder="Summer 2023" />
      </Field>

      <Field label="Star rating">
        <div style={{ display: "flex", gap: "4px", paddingTop: "4px" }}>
          {[1, 2, 3, 4, 5].map(n => {
            const active = form.starRating !== null && n <= form.starRating;
            return (
              <button
                key={n}
                type="button"
                onClick={() => set("starRating", form.starRating === n ? null : n)}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: active ? "#6B2737" : "#DDD8CE", fontSize: "22px", lineHeight: 1 }}
              >
                ★
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Typical price per night">
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontSize: "14px", color: "#5C5248" }}>$</span>
          <input
            className="input-underline"
            type="number"
            min={0}
            value={form.pricePerNight}
            onChange={e => set("pricePerNight", e.target.value)}
            placeholder="500"
            style={{ width: "100px" }}
          />
          <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontSize: "13px", color: "#5C5248" }}>/ night</span>
        </div>
      </Field>

      {/* Category */}
      <Field label="Category">
        <div style={{ display: "flex", gap: "20px" }}>
          {["hotel", "resort", "villa", "restaurant"].map(c => (
            <button key={c} type="button" onClick={() => set("category", c)} style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase" as const, color: form.category === c ? "#6B2737" : "#5C5248", background: "none", border: "none", borderBottom: form.category === c ? "2px solid #6B2737" : "2px solid transparent", paddingBottom: "3px", cursor: "pointer" }}>
              {c}
            </button>
          ))}
        </div>
      </Field>

      {/* Tier */}
      <Field label="Rating">
        <div style={{ display: "flex", gap: "20px" }}>
          {["loved", "liked", "avoid"].map(t => {
            const m = TIER_LABELS[t];
            return (
              <button key={t} type="button" onClick={() => set("tier", t)} style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase" as const, color: form.tier === t ? m.color : "#5C5248", background: "none", border: "none", borderBottom: form.tier === t ? `2px solid ${m.color}` : "2px solid transparent", paddingBottom: "3px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                {m.icon} {m.label}
              </button>
            );
          })}
        </div>
      </Field>

      {/* Tags */}
      <Field label="What you loved">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", paddingTop: "4px" }}>
          {WHAT_YOU_LOVED_OPTIONS.map(tag => (
            <button key={tag} type="button" onClick={() => toggleTag(tag)} style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "13px", color: form.tags.includes(tag) ? "#6B2737" : "#5C5248", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: form.tags.includes(tag) ? "underline" : "none", textDecorationColor: "#6B2737" }}>
              {tag}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Notes">
        <textarea className="input-underline" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Ask for ocean suite, kids loved the beach…" rows={2} style={{ resize: "none" }} />
      </Field>

      <div style={{ display: "flex", gap: "12px" }}>
        <button type="button" onClick={onCancel} style={{ flex: 1, height: "44px", background: "transparent", border: "1px solid #E5E0D8", cursor: "pointer", fontFamily: "'Raleway', sans-serif", fontWeight: 500, fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#5C5248" }}>
          Cancel
        </button>
        <button type="submit" disabled={loading} className="btn-wine" style={{ flex: 1, height: "44px" }}>
          {loading ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}


/* ─── Page ─── */
const TIER_FILTERS = ["all", "loved", "liked", "avoid"];

export default function StaysPage() {
  const { toast } = useToast();
  const { query: propQ, create: createProp, update: updateProp, remove: removeProp } = useProperties();

  const [tierFilter, setTierFilter] = useState("all");
  const [showPropForm, setShowPropForm] = useState(false);
  const [editingProp, setEditingProp] = useState<FavoriteProperty | null>(null);

  const allProperties = propQ.data ?? [];
  const filteredProperties = tierFilter === "all" ? allProperties : allProperties.filter(p => p.tier === tierFilter);

  /* Handlers — Properties */
  const handleSaveProp = (f: PropForm) => {
    const payload = normalizePropForm(f);
    if (editingProp) {
      updateProp.mutate({ id: editingProp.id, ...payload }, {
        onSuccess: () => { setEditingProp(null); toast({ title: "Property updated" }); },
        onError: () => toast({ title: "Failed", variant: "destructive" }),
      });
    } else {
      createProp.mutate(payload, {
        onSuccess: () => { setShowPropForm(false); toast({ title: "Property added" }); },
        onError: () => toast({ title: "Failed", variant: "destructive" }),
      });
    }
  };

  const handleDeleteProp = (id: number) => {
    if (!confirm("Remove this property?")) return;
    removeProp.mutate(id, {
      onSuccess: () => toast({ title: "Removed" }),
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    });
  };

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: "56px" }}>

        {/* Page Header */}
        <div>
          <h1 className="font-playfair" style={{ fontWeight: 700, fontSize: "48px", color: "#1C1C1C", letterSpacing: "-0.01em" }}>
            Stays
          </h1>
          <p className="font-playfair" style={{ fontStyle: "italic", fontSize: "17px", color: "#5C5248", marginTop: "6px" }}>
            Your favourite properties, in one place.
          </p>
          <span className="section-rule" style={{ marginTop: "24px", display: "block" }} />
        </div>

        {/* ── Section A: Favourite Properties ── */}
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "16px" }}>
            <h2 className="font-playfair" style={{ fontWeight: 400, fontSize: "28px", color: "#1C1C1C" }}>
              Favourite Properties
            </h2>
            {!showPropForm && !editingProp && (
              <button onClick={() => setShowPropForm(true)}
                style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 500, fontSize: "13px", color: "#6B2737", background: "none", border: "none", cursor: "pointer" }}>
                + Add property
              </button>
            )}
          </div>

          {/* Tier filter — slash breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "24px", flexWrap: "wrap" }}>
            {TIER_FILTERS.map((f, i) => (
              <span key={f} style={{ display: "inline-flex", alignItems: "center" }}>
                {i > 0 && <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "14px", color: "#E5E0D8", margin: "0 10px" }}>/</span>}
                <button onClick={() => setTierFilter(f)}
                  style={{ fontFamily: tierFilter === f ? "'Playfair Display', serif" : "'Raleway', sans-serif", fontStyle: tierFilter === f ? "italic" : "normal", fontWeight: 400, fontSize: tierFilter === f ? "17px" : "14px", color: tierFilter === f ? "#6B2737" : "#5C5248", background: "none", border: "none", cursor: "pointer", padding: 0, textTransform: "capitalize" as const }}>
                  {f}
                </button>
              </span>
            ))}
          </div>

          {/* Add / Edit form */}
          {(showPropForm || editingProp) && (
            <div style={{ borderLeft: "3px solid #6B2737", paddingLeft: "20px", marginBottom: "32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 className="font-playfair" style={{ fontWeight: 400, fontSize: "20px", color: "#1C1C1C" }}>
                  {editingProp ? "Edit property" : "Add property"}
                </h3>
                <button onClick={() => { setShowPropForm(false); setEditingProp(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#5C5248" }}><X size={16} /></button>
              </div>
              <PropertyForm
                initial={editingProp ? { propertyName: editingProp.propertyName, brand: editingProp.brand ?? "", location: editingProp.location ?? "", category: editingProp.category ?? "hotel", tier: editingProp.tier ?? "liked", tags: editingProp.tags ?? [], notes: editingProp.notes ?? "", visitedAt: editingProp.visitedAt ?? "", placeId: "", starRating: editingProp.starRating, pricePerNight: editingProp.pricePerNight ? String(editingProp.pricePerNight) : "" } : undefined}
                onSubmit={handleSaveProp}
                onCancel={() => { setShowPropForm(false); setEditingProp(null); }}
                loading={createProp.isPending || updateProp.isPending}
              />
            </div>
          )}

          {propQ.isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3].map(i => <Skeleton key={i} style={{ height: "70px", borderRadius: "2px" }} />)}
            </div>
          ) : filteredProperties.length > 0 ? (
            filteredProperties.map(p => (
              <PropertyCard key={p.id} property={p}
                onEdit={() => { setShowPropForm(false); setEditingProp(p); }}
                onDelete={() => handleDeleteProp(p.id)}
              />
            ))
          ) : (
            <p className="font-playfair" style={{ fontStyle: "italic", fontSize: "17px", color: "#5C5248", paddingTop: "16px" }}>
              {tierFilter === "all" ? "No properties saved yet." : `No ${tierFilter} properties.`}
            </p>
          )}
        </section>

      </div>
    </Layout>
  );
}
