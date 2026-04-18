import { useState, useRef, useEffect, useCallback } from "react";
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
  createdAt: string;
}

interface LoyaltyProgram {
  id: number;
  userId: string;
  programName: string;
  brand: string;
  membershipNumber: string | null;
  tier: string | null;
  notes: string | null;
  createdAt: string;
}

interface SuggestedProgram {
  brand: string;
  program: string;
  tiers?: string[];
}

interface SuggestedProgramGroup {
  tier_type: string;
  label: string;
  programs: SuggestedProgram[];
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
      const r = await fetch("/api/properties", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const inv = () => qc.invalidateQueries({ queryKey: KEY });
  const create = useMutation({
    mutationFn: async (d: Partial<FavoriteProperty>) => {
      const r = await fetch("/api/properties", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
      if (!r.ok) throw new Error("Failed"); return r.json();
    }, onSuccess: inv,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...d }: Partial<FavoriteProperty> & { id: number }) => {
      const r = await fetch(`/api/properties/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
      if (!r.ok) throw new Error("Failed"); return r.json();
    }, onSuccess: inv,
  });
  const remove = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/properties/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed");
    }, onSuccess: inv,
  });
  return { query, create, update, remove };
}

function useLoyalty() {
  const qc = useQueryClient();
  const KEY = ["loyalty"];
  const query = useQuery<LoyaltyProgram[]>({
    queryKey: KEY,
    queryFn: async () => {
      const r = await fetch("/api/loyalty", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const suggestedQuery = useQuery<SuggestedProgramGroup[]>({
    queryKey: ["loyalty-programs-suggested"],
    queryFn: async () => {
      const r = await fetch("/api/loyalty/programs", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const inv = () => qc.invalidateQueries({ queryKey: KEY });
  const create = useMutation({
    mutationFn: async (d: Partial<LoyaltyProgram>) => {
      const r = await fetch("/api/loyalty", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
      if (!r.ok) throw new Error("Failed"); return r.json();
    }, onSuccess: inv,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...d }: Partial<LoyaltyProgram> & { id: number }) => {
      const r = await fetch(`/api/loyalty/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
      if (!r.ok) throw new Error("Failed"); return r.json();
    }, onSuccess: inv,
  });
  const remove = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/loyalty/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed");
    }, onSuccess: inv,
  });
  return { query, suggestedQuery, create, update, remove };
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

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
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
      const r = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
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
};

const EMPTY_PROP: PropForm = { propertyName: "", brand: "", location: "", category: "hotel", tier: "liked", tags: [], notes: "", visitedAt: "", placeId: "" };

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

/* ─── Loyalty Program row ─── */
function LoyaltyRow({ program, onEdit, onDelete }: {
  program: LoyaltyProgram; onEdit: () => void; onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", alignItems: "baseline", gap: "20px", padding: "14px 0", borderBottom: "1px solid #E5E0D8" }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "15px", color: "#1C1C1C" }}>{program.brand}</span>
          <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "13px", color: "#5C5248" }}>{program.programName}</span>
          {program.tier && <span className="eyebrow">{program.tier}</span>}
        </div>
        {program.membershipNumber && (
          <span style={{ fontFamily: "Menlo, monospace", fontSize: "12px", color: "#5C5248", display: "block", marginTop: "2px" }}>
            {program.membershipNumber}
          </span>
        )}
      </div>
      {hovered && (
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <button onClick={onEdit} style={{ fontFamily: "'Raleway', sans-serif", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B2737", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
          <button onClick={onDelete} style={{ fontFamily: "'Raleway', sans-serif", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#5C5248", background: "none", border: "none", cursor: "pointer" }}>Remove</button>
        </div>
      )}
    </div>
  );
}

/* ─── Loyalty Form ─── */
type LoyForm = { programName: string; brand: string; membershipNumber: string; tier: string; notes: string };
const EMPTY_LOY: LoyForm = { programName: "", brand: "", membershipNumber: "", tier: "", notes: "" };

function LoyaltyForm({ initial, onSubmit, onBulkAdd, onCancel, loading, suggested }: {
  initial?: LoyForm; onSubmit: (f: LoyForm) => void; onBulkAdd?: (programs: SuggestedProgram[]) => Promise<void> | void; onCancel: () => void; loading: boolean; suggested: SuggestedProgramGroup[];
}) {
  const [form, setForm] = useState<LoyForm>(initial ?? EMPTY_LOY);
  const [selectedBrands, setSelectedBrands] = useState<SuggestedProgram[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  // Re-sync local form when `initial` changes (e.g. user clicks "Add it →" on a smart suggestion
  // while the form is already mounted, or switches between editing different programs).
  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);
  const set = <K extends keyof LoyForm>(k: K, v: LoyForm[K]) => setForm(f => ({ ...f, [k]: v }));

  const keyOf = (s: SuggestedProgram) => `${s.brand}|${s.program}`;
  const isSelected = (s: SuggestedProgram) => selectedBrands.some(x => keyOf(x) === keyOf(s));
  const toggleBrand = (s: SuggestedProgram) => {
    setSelectedBrands(prev =>
      prev.some(x => keyOf(x) === keyOf(s))
        ? prev.filter(x => keyOf(x) !== keyOf(s))
        : [...prev, s]
    );
  };

  const handleBulkAdd = async () => {
    if (!onBulkAdd || selectedBrands.length === 0) return;
    setBulkSaving(true);
    try {
      await onBulkAdd(selectedBrands);
      setSelectedBrands([]);
    } finally {
      setBulkSaving(false);
    }
  };

  const inBulkMode = !initial && selectedBrands.length > 0;

  // Look up the currently-selected program's tier list (from the grouped data)
  const selectedTiers: string[] | undefined = (() => {
    for (const g of suggested) {
      const match = g.programs.find(p => p.brand === form.brand && p.program === form.programName);
      if (match) return match.tiers;
    }
    return undefined;
  })();

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {!initial && suggested.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {suggested.map(group => (
            <div key={group.tier_type}>
              <p className="eyebrow" style={{ marginBottom: "8px" }}>{group.label}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {group.programs.map(s => {
                  const selected = isSelected(s);
                  return (
                    <button
                      key={s.brand + s.program}
                      type="button"
                      onClick={() => toggleBrand(s)}
                      aria-pressed={selected}
                      style={{
                        fontFamily: "'Raleway', sans-serif",
                        fontWeight: 400,
                        fontSize: "13px",
                        color: selected ? "#fff" : "#5C5248",
                        background: selected ? "#6B2737" : "transparent",
                        border: `1px solid ${selected ? "#6B2737" : "#E5E0D8"}`,
                        borderRadius: "2px",
                        padding: "6px 14px",
                        cursor: "pointer",
                        transition: "all 150ms ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected(s)) (e.currentTarget as HTMLButtonElement).style.background = "#F5F0E6";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected(s)) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      }}
                    >
                      {s.brand}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!inBulkMode && (
      <>
      <Field label="Brand">
        <input className="input-underline" required value={form.brand} onChange={e => set("brand", e.target.value)} placeholder="Hyatt" />
      </Field>
      <Field label="Program name">
        <input className="input-underline" required value={form.programName} onChange={e => set("programName", e.target.value)} placeholder="World of Hyatt" />
      </Field>
      <Field label="Membership number">
        <input className="input-underline" value={form.membershipNumber} onChange={e => set("membershipNumber", e.target.value)} placeholder="123456789" />
      </Field>
      <Field label="Status tier">
        {selectedTiers && selectedTiers.length > 0 ? (
          <select
            className="input-underline"
            value={form.tier}
            onChange={e => set("tier", e.target.value)}
            style={{ background: "transparent", appearance: "none", cursor: "pointer" }}
          >
            <option value="">— Select tier —</option>
            {selectedTiers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        ) : (
          <input className="input-underline" value={form.tier} onChange={e => set("tier", e.target.value)} placeholder="Globalist" />
        )}
      </Field>

      <div style={{ display: "flex", gap: "12px" }}>
        <button type="button" onClick={onCancel} style={{ flex: 1, height: "44px", background: "transparent", border: "1px solid #E5E0D8", cursor: "pointer", fontFamily: "'Raleway', sans-serif", fontWeight: 500, fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#5C5248" }}>
          Cancel
        </button>
        <button type="submit" disabled={loading} className="btn-wine" style={{ flex: 1, height: "44px" }}>
          {loading ? "Saving…" : "Save"}
        </button>
      </div>
      </>
      )}

      {inBulkMode && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            background: "white",
            borderTop: "1px solid #E5E0D8",
            padding: "16px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            marginTop: "8px",
            marginLeft: "-20px",
            marginRight: "-20px",
            marginBottom: "-20px",
            zIndex: 5,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: "'Raleway', sans-serif",
                fontWeight: 300,
                fontStyle: "italic",
                fontSize: "13px",
                color: "#5C5248",
                marginBottom: "2px",
              }}
            >
              {selectedBrands.length} program{selectedBrands.length === 1 ? "" : "s"} selected
            </p>
            <p
              style={{
                fontFamily: "'Raleway', sans-serif",
                fontWeight: 300,
                fontStyle: "italic",
                fontSize: "12px",
                color: "#94A39B",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={selectedBrands.map(s => s.brand).join(", ")}
            >
              {selectedBrands.map(s => s.brand).join(", ")}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setSelectedBrands([])}
              style={{
                background: "transparent",
                border: "1px solid #E5E0D8",
                padding: "10px 16px",
                cursor: "pointer",
                fontFamily: "'Raleway', sans-serif",
                fontWeight: 500,
                fontSize: "11px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#5C5248",
              }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleBulkAdd}
              disabled={bulkSaving}
              className="btn-wine"
              style={{
                padding: "10px 20px",
                fontFamily: "'Raleway', sans-serif",
                fontWeight: 600,
                fontSize: "11px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              {bulkSaving ? "Adding…" : `Add Selected`}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

/* ─── Page ─── */
const TIER_FILTERS = ["all", "loved", "liked", "avoid"];

type ProgramMatch = SuggestedProgram & { tier_type: string; tier_type_label: string };

function findProgramByBrand(brand: string, groups: SuggestedProgramGroup[]): ProgramMatch | null {
  if (!brand) return null;
  const b = brand.trim().toLowerCase();
  for (const g of groups) {
    for (const p of g.programs) {
      const lb = p.brand.toLowerCase();
      // Match if equal, or property brand contains the loyalty brand (e.g. "Park Hyatt" → "Hyatt"),
      // or vice versa for shorter property brands.
      if (b === lb || b.includes(lb) || lb.includes(b)) {
        return { ...p, tier_type: g.tier_type, tier_type_label: g.label };
      }
    }
  }
  return null;
}

function getTierTypeForBrand(brand: string, groups: SuggestedProgramGroup[]): { tier_type: string; label: string } {
  const m = findProgramByBrand(brand, groups);
  return m ? { tier_type: m.tier_type, label: m.tier_type_label } : { tier_type: "other", label: "Other" };
}

export default function StaysPage() {
  const { toast } = useToast();
  const { query: propQ, create: createProp, update: updateProp, remove: removeProp } = useProperties();
  const { query: loyQ, suggestedQuery, create: createLoy, update: updateLoy, remove: removeLoy } = useLoyalty();

  const [tierFilter, setTierFilter] = useState("all");
  const [showPropForm, setShowPropForm] = useState(false);
  const [editingProp, setEditingProp] = useState<FavoriteProperty | null>(null);
  const [showLoyForm, setShowLoyForm] = useState(false);
  const [editingLoy, setEditingLoy] = useState<LoyaltyProgram | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<{ propertyBrand: string; match: ProgramMatch } | null>(null);
  const [prefilledLoy, setPrefilledLoy] = useState<LoyForm | null>(null);

  const allProperties = propQ.data ?? [];
  const filteredProperties = tierFilter === "all" ? allProperties : allProperties.filter(p => p.tier === tierFilter);
  const loyaltyPrograms = loyQ.data ?? [];
  const suggested = suggestedQuery.data ?? [];

  // Group user's saved loyalty programs by tier_type, preserving suggested-group order.
  const groupedLoyalty: { tier_type: string; label: string; programs: LoyaltyProgram[] }[] = (() => {
    const map = new Map<string, { label: string; programs: LoyaltyProgram[] }>();
    for (const p of loyaltyPrograms) {
      const { tier_type, label } = getTierTypeForBrand(p.brand, suggested);
      if (!map.has(tier_type)) map.set(tier_type, { label, programs: [] });
      map.get(tier_type)!.programs.push(p);
    }
    const order = suggested.map(g => g.tier_type).concat("other");
    return order
      .filter(tt => map.has(tt))
      .map(tt => ({ tier_type: tt, label: map.get(tt)!.label, programs: map.get(tt)!.programs }));
  })();

  /* Handlers — Properties */
  const handleSaveProp = (f: PropForm) => {
    const checkSuggestion = () => {
      if (!f.brand) return;
      const match = findProgramByBrand(f.brand, suggested);
      if (!match) return;
      // Skip if user already has any loyalty for this brand.
      const already = loyaltyPrograms.some(lp => {
        const lb = lp.brand.toLowerCase();
        const mb = match.brand.toLowerCase();
        return lb === mb || lb.includes(mb) || mb.includes(lb);
      });
      if (!already) setPendingSuggestion({ propertyBrand: f.brand, match });
    };

    if (editingProp) {
      updateProp.mutate({ id: editingProp.id, ...f, tags: f.tags }, {
        onSuccess: () => { setEditingProp(null); toast({ title: "Property updated" }); checkSuggestion(); },
        onError: () => toast({ title: "Failed", variant: "destructive" }),
      });
    } else {
      createProp.mutate({ ...f, tags: f.tags }, {
        onSuccess: () => { setShowPropForm(false); toast({ title: "Property added" }); checkSuggestion(); },
        onError: () => toast({ title: "Failed", variant: "destructive" }),
      });
    }
  };

  const acceptSuggestion = () => {
    if (!pendingSuggestion) return;
    const m = pendingSuggestion.match;
    setPrefilledLoy({ brand: m.brand, programName: m.program, membershipNumber: "", tier: "", notes: "" });
    setShowLoyForm(true);
    setEditingLoy(null);
    setPendingSuggestion(null);
    // Smooth scroll to loyalty section
    setTimeout(() => {
      document.getElementById("loyalty-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleDeleteProp = (id: number) => {
    if (!confirm("Remove this property?")) return;
    removeProp.mutate(id, {
      onSuccess: () => toast({ title: "Removed" }),
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    });
  };

  /* Handlers — Loyalty */
  const handleSaveLoy = (f: LoyForm) => {
    if (editingLoy) {
      updateLoy.mutate({ id: editingLoy.id, ...f }, {
        onSuccess: () => { setEditingLoy(null); toast({ title: "Program updated" }); },
        onError: () => toast({ title: "Failed", variant: "destructive" }),
      });
    } else {
      createLoy.mutate(f, {
        onSuccess: () => { setShowLoyForm(false); toast({ title: "Program added" }); },
        onError: () => toast({ title: "Failed", variant: "destructive" }),
      });
    }
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
            Favourite properties and loyalty programs, in one place.
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
                initial={editingProp ? { propertyName: editingProp.propertyName, brand: editingProp.brand ?? "", location: editingProp.location ?? "", category: editingProp.category ?? "hotel", tier: editingProp.tier ?? "liked", tags: editingProp.tags ?? [], notes: editingProp.notes ?? "", visitedAt: editingProp.visitedAt ?? "" } : undefined}
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

        {/* Smart suggestion banner — appears after a property save matches an unowned loyalty program */}
        {pendingSuggestion && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              padding: "12px 16px",
              borderLeft: "2px solid #6B2737",
              background: "rgba(107, 39, 55, 0.05)",
              marginTop: "-32px",
            }}
          >
            <p
              className="font-playfair"
              style={{ fontStyle: "italic", fontSize: "14px", color: "#1C1C1C", margin: 0, flex: 1 }}
            >
              You saved a {pendingSuggestion.propertyBrand} property — add{" "}
              <span style={{ fontWeight: 600 }}>{pendingSuggestion.match.program}</span>{" "}
              to your loyalty programs?
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
              <button
                onClick={acceptSuggestion}
                style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 500, fontSize: "13px", color: "#6B2737", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Add it →
              </button>
              <button
                onClick={() => setPendingSuggestion(null)}
                aria-label="Dismiss suggestion"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#5C5248", padding: 0, display: "flex" }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        <span className="section-rule" />

        {/* ── Section B: Loyalty Programs ── */}
        <section id="loyalty-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "24px" }}>
            <h2 className="font-playfair" style={{ fontWeight: 400, fontSize: "28px", color: "#1C1C1C" }}>
              Loyalty Programs
            </h2>
            {!showLoyForm && !editingLoy && (
              <button onClick={() => { setPrefilledLoy(null); setShowLoyForm(true); }}
                style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 500, fontSize: "13px", color: "#6B2737", background: "none", border: "none", cursor: "pointer" }}>
                + Add program
              </button>
            )}
          </div>

          {/* Add / Edit form */}
          {(showLoyForm || editingLoy) && (
            <div style={{ borderLeft: "3px solid #6B2737", paddingLeft: "20px", marginBottom: "32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 className="font-playfair" style={{ fontWeight: 400, fontSize: "20px", color: "#1C1C1C" }}>
                  {editingLoy ? "Edit program" : "Add program"}
                </h3>
                <button onClick={() => { setShowLoyForm(false); setEditingLoy(null); setPrefilledLoy(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#5C5248" }}><X size={16} /></button>
              </div>
              <LoyaltyForm
                initial={
                  editingLoy
                    ? { programName: editingLoy.programName, brand: editingLoy.brand, membershipNumber: editingLoy.membershipNumber ?? "", tier: editingLoy.tier ?? "", notes: editingLoy.notes ?? "" }
                    : prefilledLoy ?? undefined
                }
                onSubmit={(f) => { handleSaveLoy(f); setPrefilledLoy(null); }}
                onBulkAdd={async (programs) => {
                  try {
                    await Promise.all(
                      programs.map((p) =>
                        createLoy.mutateAsync({
                          brand: p.brand,
                          programName: p.program,
                          membershipNumber: "",
                          tier: "",
                          notes: "",
                        })
                      )
                    );
                    toast({ title: `Added ${programs.length} program${programs.length === 1 ? "" : "s"}` });
                    setShowLoyForm(false);
                    setPrefilledLoy(null);
                  } catch {
                    toast({ title: "Some programs failed to add", variant: "destructive" });
                  }
                }}
                onCancel={() => { setShowLoyForm(false); setEditingLoy(null); setPrefilledLoy(null); }}
                loading={createLoy.isPending || updateLoy.isPending}
                suggested={suggested}
              />
            </div>
          )}

          {loyQ.isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[1, 2, 3].map(i => <Skeleton key={i} style={{ height: "50px", borderRadius: "2px" }} />)}
            </div>
          ) : groupedLoyalty.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
              {groupedLoyalty.map(group => (
                <div key={group.tier_type}>
                  <p className="eyebrow" style={{ marginBottom: "8px" }}>{group.label}</p>
                  {group.programs.map(p => (
                    <LoyaltyRow key={p.id} program={p}
                      onEdit={() => { setShowLoyForm(false); setPrefilledLoy(null); setEditingLoy(p); }}
                      onDelete={() => { if (!confirm("Remove this program?")) return; removeLoy.mutate(p.id, { onSuccess: () => toast({ title: "Removed" }), onError: () => toast({ title: "Failed", variant: "destructive" }) }); }}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="font-playfair" style={{ fontStyle: "italic", fontSize: "17px", color: "#5C5248" }}>
              No programs added yet.
            </p>
          )}
        </section>

      </div>
    </Layout>
  );
}
