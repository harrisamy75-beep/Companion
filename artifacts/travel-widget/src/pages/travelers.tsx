import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import {
  useListTravelers,
  useCreateTraveler,
  useUpdateTraveler,
  useDeleteTraveler,
  getListTravelersQueryKey,
  getGetTravelSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

type TravelerType = "adult" | "child";

interface FormState {
  name: string;
  birthDate: string;
  travelerType: TravelerType;
  relationship: string;
  foodPreferences: string;
  activityPreferences: string;
  accessibilityNeeds: string;
  notes: string;
}

interface TripProfile {
  id: number;
  userId: string;
  name: string;
  travelerIds: number[];
  emoji: string;
  isDefault: string;
  createdAt: string;
  updatedAt: string;
}

interface ProfileFormState {
  name: string;
  emoji: string;
  travelerIds: number[];
  duplicateFromId: number | null;
}

const EMPTY_FORM: FormState = {
  name: "", birthDate: "", travelerType: "adult",
  relationship: "", foodPreferences: "", activityPreferences: "",
  accessibilityNeeds: "", notes: "",
};

const EMPTY_PROFILE_FORM: ProfileFormState = { name: "", emoji: "✈️", travelerIds: [], duplicateFromId: null };
const ACTIVE_PROFILE_KEY = "activeProfileId";

function parseTags(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/* ─── Trip profiles API hook ─── */
function useTripProfiles() {
  const qc = useQueryClient();
  const KEY = ["trip-profiles"];
  const query = useQuery<TripProfile[]>({
    queryKey: KEY,
    queryFn: async () => {
      const res = await fetch("/api/trip-profiles", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const inv = () => qc.invalidateQueries({ queryKey: KEY });
  const create = useMutation({
    mutationFn: async (d: Omit<ProfileFormState, "duplicateFromId">) => {
      const r = await fetch("/api/trip-profiles", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
      if (!r.ok) throw new Error("Failed"); return r.json() as Promise<TripProfile>;
    }, onSuccess: inv,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...d }: Partial<ProfileFormState> & { id: number }) => {
      const r = await fetch(`/api/trip-profiles/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
      if (!r.ok) throw new Error("Failed"); return r.json() as Promise<TripProfile>;
    }, onSuccess: inv,
  });
  const remove = useMutation({
    mutationFn: async (id: number) => { const r = await fetch(`/api/trip-profiles/${id}`, { method: "DELETE", credentials: "include" }); if (!r.ok) throw new Error("Failed"); },
    onSuccess: inv,
  });
  const duplicate = useMutation({
    mutationFn: async (id: number) => { const r = await fetch(`/api/trip-profiles/${id}/duplicate`, { method: "POST", credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json() as Promise<TripProfile>; },
    onSuccess: inv,
  });
  return { query, create, update, remove, duplicate };
}

/* ─── Profile modal ─── */
function ProfileModal({ profiles, travelers, editingProfile, onClose, onCreate, onUpdate }: {
  profiles: TripProfile[]; travelers: any[];
  editingProfile: TripProfile | null;
  onClose: () => void;
  onCreate: (f: Omit<ProfileFormState, "duplicateFromId">) => void;
  onUpdate: (id: number, f: Partial<ProfileFormState>) => void;
}) {
  const [form, setForm] = useState<ProfileFormState>(() =>
    editingProfile
      ? { name: editingProfile.name, emoji: editingProfile.emoji ?? "✈️", travelerIds: (editingProfile.travelerIds as number[]) ?? [], duplicateFromId: null }
      : EMPTY_PROFILE_FORM
  );
  const set = <K extends keyof ProfileFormState>(k: K, v: ProfileFormState[K]) => setForm(f => ({ ...f, [k]: v }));
  const toggle = (id: number) => setForm(f => ({ ...f, travelerIds: f.travelerIds.includes(id) ? f.travelerIds.filter(x => x !== id) : [...f.travelerIds, id] }));
  const handleDupFrom = (pid: number) => { const src = profiles.find(p => p.id === pid); if (src) setForm(f => ({ ...f, travelerIds: (src.travelerIds as number[]) ?? [], duplicateFromId: pid })); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const p = { name: form.name.trim(), emoji: form.emoji, travelerIds: form.travelerIds };
    if (editingProfile) onUpdate(editingProfile.id, p); else onCreate(p);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", border: "1px solid #E5E0D8", borderRadius: "2px", width: "100%", maxWidth: "420px", padding: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
          <h2 className="font-playfair" style={{ fontSize: "22px", fontWeight: 400, color: "#1C1C1C" }}>
            {editingProfile ? "Edit profile" : "New trip profile"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#5C5248" }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", gap: "16px" }}>
            <div style={{ flex: "0 0 60px" }}>
              <p className="eyebrow" style={{ marginBottom: "6px" }}>Emoji</p>
              <input className="input-underline" value={form.emoji} onChange={e => set("emoji", e.target.value)} maxLength={4} style={{ textAlign: "center" }} />
            </div>
            <div style={{ flex: 1 }}>
              <p className="eyebrow" style={{ marginBottom: "6px" }}>Profile name</p>
              <input autoFocus className="input-underline" placeholder="e.g. Harris Family" value={form.name} onChange={e => set("name", e.target.value)} required />
            </div>
          </div>

          {!editingProfile && profiles.length > 0 && (
            <div>
              <p className="eyebrow" style={{ marginBottom: "6px" }}>Start from existing</p>
              <select value={form.duplicateFromId ?? ""} onChange={e => { const v = e.target.value; if (v) handleDupFrom(parseInt(v, 10)); else set("duplicateFromId", null); }}
                className="input-underline" style={{ cursor: "pointer" }}>
                <option value="">— start fresh —</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
              </select>
            </div>
          )}

          {travelers.length > 0 && (
            <div>
              <p className="eyebrow" style={{ marginBottom: "8px" }}>Travelers to include</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "180px", overflowY: "auto" }}>
                {travelers.map(t => {
                  const checked = form.travelerIds.includes(t.id);
                  return (
                    <label key={t.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", borderBottom: "1px solid #E5E0D8", cursor: "pointer" }}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(t.id)} style={{ accentColor: "#6B2737" }} />
                      <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "14px", color: "#1C1C1C", flex: 1 }}>{t.name}</span>
                      <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "11px", color: "#5C5248", textTransform: "capitalize" }}>{t.travelerType}</span>
                    </label>
                  );
                })}
              </div>
              <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: "11px", color: "#5C5248", marginTop: "8px" }}>{form.travelerIds.length} selected</p>
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, height: "44px", background: "transparent", border: "1px solid #E5E0D8", cursor: "pointer", fontFamily: "'Raleway', sans-serif", fontWeight: 500, fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#5C5248" }}>
              Cancel
            </button>
            <button type="submit" disabled={!form.name.trim()} className="btn-wine"
              style={{ flex: 1, height: "44px" }}>
              {editingProfile ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Individual traveler card ─── */
function TravelerCard({ traveler, onEdit, onDelete, isEditing }: {
  traveler: any; onEdit: () => void; onDelete: () => void; isEditing: boolean;
}) {
  const initial = traveler.name.charAt(0).toUpperCase();
  const isChild = traveler.travelerType === "child";
  const foodTags: string[] = traveler.foodPreferences ?? [];
  const actTags: string[] = traveler.activityPreferences ?? [];
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "24px 0",
        borderBottom: "1px solid #E5E0D8",
        borderLeft: hovered || isEditing ? "3px solid #6B2737" : "3px solid transparent",
        paddingLeft: hovered || isEditing ? "20px" : "0",
        transition: "border-color 0.2s, padding-left 0.2s",
        display: "flex",
        gap: "20px",
        alignItems: "flex-start",
      }}
    >
      {/* Large italic initial */}
      <span
        className="font-playfair"
        style={{
          fontStyle: "italic",
          fontWeight: 400,
          fontSize: "52px",
          color: "#B8963E",
          lineHeight: 1,
          width: "40px",
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        {initial}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span
              className="font-playfair"
              style={{ fontWeight: 700, fontSize: "22px", color: "#1C1C1C", display: "block" }}
            >
              {traveler.name}
            </span>
            <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", color: "#5C5248" }}>
              {isChild ? "Child" : "Adult"}
              {traveler.relationship ? ` · ${traveler.relationship}` : ""}
              {traveler.ageDisplay ? ` · ${traveler.ageDisplay}` : ""}
              {traveler.birthDate && !traveler.ageDisplay ? ` · ${traveler.birthDate}` : ""}
            </span>
          </div>
          {(hovered || isEditing) && (
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <button onClick={onEdit}
                style={{ fontFamily: "'Raleway', sans-serif", fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#6B2737", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}>
                Edit
              </button>
              <button onClick={onDelete}
                style={{ fontFamily: "'Raleway', sans-serif", fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#5C5248", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}>
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Tags as italic prose */}
        {foodTags.length > 0 && (
          <p className="font-playfair" style={{ fontStyle: "italic", fontWeight: 400, fontSize: "15px", color: "#5C5248", marginTop: "10px" }}>
            Eats: {foodTags.join(", ")}
          </p>
        )}
        {actTags.length > 0 && (
          <p className="font-playfair" style={{ fontStyle: "italic", fontWeight: 400, fontSize: "15px", color: "#5C5248", marginTop: "2px" }}>
            Does: {actTags.join(", ")}
          </p>
        )}
        {traveler.notes && (
          <p style={{ fontFamily: "'Raleway', sans-serif", fontStyle: "italic", fontSize: "13px", color: "#5C5248", marginTop: "6px" }}>
            {traveler.notes}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Form input row ─── */
function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <span className="eyebrow">{label}</span>
      {children}
    </div>
  );
}

/* ─── Page ─── */
export default function TravelersPage() {
  const { data: travelers, isLoading } = useListTravelers();
  const createTraveler = useCreateTraveler();
  const updateTraveler = useUpdateTraveler();
  const deleteTraveler = useDeleteTraveler();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { query: profilesQuery, create: createProfile, update: updateProfile, remove: removeProfile, duplicate: duplicateProfile } = useTripProfiles();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(() => {
    const s = localStorage.getItem(ACTIVE_PROFILE_KEY);
    return s ? parseInt(s, 10) : null;
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<TripProfile | null>(null);

  useEffect(() => {
    if (activeProfileId !== null) localStorage.setItem(ACTIVE_PROFILE_KEY, String(activeProfileId));
    else localStorage.removeItem(ACTIVE_PROFILE_KEY);
  }, [activeProfileId]);

  const profiles = profilesQuery.data ?? [];
  const activeProfile = activeProfileId !== null ? profiles.find(p => p.id === activeProfileId) ?? null : null;
  const activeTravelerIds = activeProfile ? new Set<number>((activeProfile.travelerIds as number[]) ?? []) : null;
  const allTravelers = travelers ?? [];
  const displayedTravelers = activeTravelerIds ? allTravelers.filter(t => activeTravelerIds.has(t.id)) : allTravelers;

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  const startEdit = (t: any) => {
    setEditingId(t.id);
    setShowForm(true);
    setForm({
      name: t.name, birthDate: t.birthDate ?? "", travelerType: t.travelerType,
      relationship: t.relationship ?? "", foodPreferences: (t.foodPreferences ?? []).join(", "),
      activityPreferences: (t.activityPreferences ?? []).join(", "),
      accessibilityNeeds: t.accessibilityNeeds ?? "", notes: t.notes ?? "",
    });
  };

  const cancelEdit = () => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(false); };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTravelersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTravelSummaryQueryKey() });
  };

  const buildPayload = () => ({
    name: form.name, travelerType: form.travelerType,
    birthDate: form.birthDate || undefined, relationship: form.relationship || undefined,
    foodPreferences: parseTags(form.foodPreferences), activityPreferences: parseTags(form.activityPreferences),
    accessibilityNeeds: form.accessibilityNeeds || undefined, notes: form.notes || undefined,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    if (editingId !== null) {
      updateTraveler.mutate({ id: editingId, data: buildPayload() }, {
        onSuccess: () => { cancelEdit(); invalidate(); toast({ title: "Traveler updated" }); },
        onError: () => toast({ title: "Failed to update", variant: "destructive" }),
      });
    } else {
      createTraveler.mutate({ data: buildPayload() }, {
        onSuccess: () => { setForm(EMPTY_FORM); setShowForm(false); invalidate(); toast({ title: "Traveler added" }); },
        onError: () => toast({ title: "Failed to add", variant: "destructive" }),
      });
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Remove this traveler?")) return;
    deleteTraveler.mutate({ id }, {
      onSuccess: () => { if (editingId === id) cancelEdit(); invalidate(); toast({ title: "Traveler removed" }); },
      onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
    });
  };

  const isPending = createTraveler.isPending || updateTraveler.isPending;

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>

        {/* Page header */}
        <div>
          <h1 className="font-playfair" style={{ fontWeight: 700, fontSize: "48px", color: "#1C1C1C", letterSpacing: "-0.01em" }}>
            Travel Party
          </h1>
          <p className="font-playfair" style={{ fontStyle: "italic", fontSize: "17px", color: "#5C5248", marginTop: "6px" }}>
            Every person in your group, captured once.
          </p>
          <span className="section-rule" style={{ marginTop: "24px", display: "block" }} />
        </div>

        {/* Trip profiles — slash breadcrumb */}
        <div>
          <p className="eyebrow" style={{ marginBottom: "12px" }}>Trip Profiles</p>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0" }}>

            {/* "All" */}
            <button
              onClick={() => setActiveProfileId(null)}
              style={{
                fontFamily: activeProfileId === null ? "'Playfair Display', serif" : "'Raleway', sans-serif",
                fontStyle: activeProfileId === null ? "italic" : "normal",
                fontWeight: 400,
                fontSize: activeProfileId === null ? "17px" : "14px",
                color: activeProfileId === null ? "#6B2737" : "#5C5248",
                background: "none", border: "none", cursor: "pointer", padding: "0",
              }}
            >
              All travelers
            </button>

            {profilesQuery.isLoading
              ? <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "14px", color: "#E5E0D8", margin: "0 10px" }}>…</span>
              : profiles.map(profile => {
                  const isActive = activeProfileId === profile.id;
                  return (
                    <span key={profile.id} style={{ display: "inline-flex", alignItems: "center" }}>
                      <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "14px", color: "#E5E0D8", margin: "0 10px" }}>/</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <button
                          onClick={() => setActiveProfileId(isActive ? null : profile.id)}
                          style={{
                            fontFamily: isActive ? "'Playfair Display', serif" : "'Raleway', sans-serif",
                            fontStyle: isActive ? "italic" : "normal",
                            fontWeight: 400,
                            fontSize: isActive ? "17px" : "14px",
                            color: isActive ? "#6B2737" : "#5C5248",
                            background: "none", border: "none", cursor: "pointer", padding: "0",
                          }}
                        >
                          {profile.name}
                        </button>
                        {/* inline actions — only visible on hover would require extra state; show always */}
                        <button
                          onClick={() => setEditingProfile(profile)}
                          title="Edit"
                          style={{ fontFamily: "'Raleway', sans-serif", fontSize: "10px", color: "#C4BBB0", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
                        >
                          edit
                        </button>
                        <button
                          onClick={() => duplicateProfile.mutate(profile.id, { onSuccess: copy => { setEditingProfile(copy); toast({ title: "Duplicated" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) })}
                          title="Duplicate"
                          style={{ fontFamily: "'Raleway', sans-serif", fontSize: "10px", color: "#C4BBB0", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
                        >
                          dup
                        </button>
                        <button
                          onClick={() => { if (!confirm("Delete profile?")) return; removeProfile.mutate(profile.id, { onSuccess: () => { if (activeProfileId === profile.id) setActiveProfileId(null); toast({ title: "Deleted" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) }); }}
                          title="Delete"
                          style={{ fontFamily: "'Raleway', sans-serif", fontSize: "10px", color: "#C4BBB0", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
                        >
                          ✕
                        </button>
                      </span>
                    </span>
                  );
                })}

            {/* + New */}
            <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "14px", color: "#E5E0D8", margin: "0 10px" }}>/</span>
            <button
              onClick={() => { setEditingProfile(null); setShowProfileModal(true); }}
              style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "14px", color: "#B8963E", background: "none", border: "none", cursor: "pointer", padding: "0" }}
            >
              + New
            </button>
          </div>
        </div>

        {/* Main two-column area */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "56px", alignItems: "start" }}>

          {/* Traveler list */}
          <div>
            {isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {[1, 2, 3].map(i => <Skeleton key={i} style={{ height: "100px", borderRadius: "2px" }} />)}
              </div>
            ) : displayedTravelers.length > 0 ? (
              <div>
                {displayedTravelers.map(t => (
                  <TravelerCard key={t.id} traveler={t} onEdit={() => startEdit(t)} onDelete={() => handleDelete(t.id)} isEditing={editingId === t.id} />
                ))}
              </div>
            ) : allTravelers.length === 0 ? (
              <div style={{ paddingTop: "20px" }}>
                <p className="font-playfair" style={{ fontStyle: "italic", fontSize: "20px", color: "#5C5248" }}>
                  No travelers yet.
                </p>
                <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: "14px", color: "#5C5248", marginTop: "8px" }}>
                  Add everyone in your party using the form.
                </p>
              </div>
            ) : (
              <div style={{ paddingTop: "20px" }}>
                <p className="font-playfair" style={{ fontStyle: "italic", fontSize: "20px", color: "#5C5248" }}>
                  No travelers in this profile.
                </p>
                <button
                  onClick={() => activeProfile && setEditingProfile(activeProfile)}
                  style={{ fontFamily: "'Raleway', sans-serif", fontSize: "13px", color: "#6B2737", background: "none", border: "none", cursor: "pointer", padding: "0", marginTop: "8px" }}
                >
                  Edit profile to add travelers →
                </button>
              </div>
            )}

            {/* + Add traveler toggle */}
            {!showForm && !editingId && (
              <div style={{ marginTop: "32px" }}>
                <button
                  onClick={() => setShowForm(true)}
                  style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 500, fontSize: "13px", color: "#6B2737", background: "none", border: "none", cursor: "pointer", padding: "0", letterSpacing: "0.04em" }}
                >
                  + Add traveler
                </button>
              </div>
            )}
          </div>

          {/* Add / Edit form */}
          {(showForm || editingId !== null) && (
            <div style={{ borderLeft: "1px solid #E5E0D8", paddingLeft: "32px", position: "sticky", top: "32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
                <h2 className="font-playfair" style={{ fontWeight: 400, fontSize: "22px", color: "#1C1C1C" }}>
                  {editingId !== null ? "Edit traveler" : "Add traveler"}
                </h2>
                <button onClick={cancelEdit} style={{ background: "none", border: "none", cursor: "pointer", color: "#5C5248" }}>
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Type selector */}
                <div>
                  <p className="eyebrow" style={{ marginBottom: "10px" }}>Type</p>
                  <div style={{ display: "flex", gap: "24px" }}>
                    {(["adult", "child"] as TravelerType[]).map(t => (
                      <button
                        key={t} type="button" onClick={() => setField("travelerType", t)}
                        style={{
                          fontFamily: "'Raleway', sans-serif",
                          fontWeight: 600,
                          fontSize: "11px",
                          letterSpacing: "0.12em",
                          textTransform: "uppercase" as const,
                          color: form.travelerType === t ? "#6B2737" : "#5C5248",
                          background: "none", border: "none",
                          borderBottom: form.travelerType === t ? "2px solid #6B2737" : "2px solid transparent",
                          paddingBottom: "4px",
                          cursor: "pointer",
                          transition: "color 0.15s, border-color 0.15s",
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <FormRow label="Name">
                  <input className="input-underline" placeholder={form.travelerType === "child" ? "e.g. Emma" : "e.g. Sarah"} value={form.name} onChange={e => setField("name", e.target.value)} required />
                </FormRow>

                <FormRow label="Relationship">
                  <input className="input-underline" placeholder={form.travelerType === "child" ? "child, stepchild…" : "self, partner, friend…"} value={form.relationship} onChange={e => setField("relationship", e.target.value)} />
                </FormRow>

                <FormRow label={form.travelerType === "child" ? "Birthdate" : "Birthdate (optional)"}>
                  <input className="input-underline" type="date" value={form.birthDate} onChange={e => setField("birthDate", e.target.value)} required={form.travelerType === "child"} />
                </FormRow>

                <FormRow label="Food preferences">
                  <input className="input-underline" placeholder="vegetarian, upscale, no gluten…" value={form.foodPreferences} onChange={e => setField("foodPreferences", e.target.value)} />
                  <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "11px", color: "#C4BBB0" }}>Comma-separated</span>
                </FormRow>

                <FormRow label="Activity preferences">
                  <input className="input-underline" placeholder="hiking, spa, beach…" value={form.activityPreferences} onChange={e => setField("activityPreferences", e.target.value)} />
                </FormRow>

                <FormRow label="Accessibility needs">
                  <input className="input-underline" placeholder="wheelchair, nut allergy…" value={form.accessibilityNeeds} onChange={e => setField("accessibilityNeeds", e.target.value)} />
                </FormRow>

                <FormRow label="Notes">
                  <textarea
                    className="input-underline"
                    placeholder="Hates tourist traps, loves rooftop bars…"
                    value={form.notes}
                    onChange={e => setField("notes", e.target.value)}
                    rows={2}
                    style={{ resize: "none" }}
                  />
                </FormRow>

                <button type="submit" disabled={isPending} className="btn-wine" style={{ height: "48px", marginTop: "8px" }}>
                  {isPending ? "Saving…" : editingId !== null ? "Save changes" : `Add ${form.travelerType}`}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {(showProfileModal || editingProfile !== null) && (
        <ProfileModal
          profiles={profiles} travelers={allTravelers} editingProfile={editingProfile}
          onClose={() => { setShowProfileModal(false); setEditingProfile(null); }}
          onCreate={f => createProfile.mutate(f, { onSuccess: p => { setShowProfileModal(false); setActiveProfileId(p.id); toast({ title: "Profile created" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) })}
          onUpdate={(id, d) => updateProfile.mutate({ id, ...d }, { onSuccess: () => { setEditingProfile(null); toast({ title: "Profile updated" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) })}
        />
      )}
    </Layout>
  );
}
