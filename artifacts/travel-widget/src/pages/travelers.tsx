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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, UserPlus, Calendar, Edit2, X, Users, User, Plus, Copy, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const NAVY = "#1B3A5C";
const GOLD = "#C9972B";

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
  name: "",
  birthDate: "",
  travelerType: "adult",
  relationship: "",
  foodPreferences: "",
  activityPreferences: "",
  accessibilityNeeds: "",
  notes: "",
};

const EMPTY_PROFILE_FORM: ProfileFormState = {
  name: "",
  emoji: "✈️",
  travelerIds: [],
  duplicateFromId: null,
};

const ACTIVE_PROFILE_KEY = "activeProfileId";

function parseTags(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function TagRow({ label, tags }: { label: string; tags: string[] }) {
  if (tags.length === 0) return null;
  const visible = tags.slice(0, 4);
  const overflow = tags.length - 4;
  return (
    <div className="flex items-start gap-2 mt-1.5">
      <span className="pref-label shrink-0 pt-0.5">{label}</span>
      <div className="flex flex-wrap gap-1">
        {visible.map((t) => <span key={t} className="pill-tag">{t}</span>)}
        {overflow > 0 && <span className="pill-tag" style={{ color: GOLD }}>+{overflow} more</span>}
      </div>
    </div>
  );
}

function useTripProfiles() {
  const qc = useQueryClient();
  const KEY = ["trip-profiles"];

  const query = useQuery<TripProfile[]>({
    queryKey: KEY,
    queryFn: async () => {
      const res = await fetch("/api/trip-profiles", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load profiles");
      return res.json();
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: async (data: Omit<ProfileFormState, "duplicateFromId">) => {
      const res = await fetch("/api/trip-profiles", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<TripProfile>;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: Partial<ProfileFormState> & { id: number }) => {
      const res = await fetch(`/api/trip-profiles/${id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<TripProfile>;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/trip-profiles/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: invalidate,
  });

  const duplicate = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/trip-profiles/${id}/duplicate`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<TripProfile>;
    },
    onSuccess: invalidate,
  });

  return { query, create, update, remove, duplicate };
}

function ProfileModal({
  profiles, travelers, editingProfile, onClose, onCreate, onUpdate,
}: {
  profiles: TripProfile[];
  travelers: any[];
  editingProfile: TripProfile | null;
  onClose: () => void;
  onCreate: (form: Omit<ProfileFormState, "duplicateFromId">) => void;
  onUpdate: (id: number, form: Partial<ProfileFormState>) => void;
}) {
  const [form, setForm] = useState<ProfileFormState>(() => {
    if (editingProfile) {
      return { name: editingProfile.name, emoji: editingProfile.emoji ?? "✈️", travelerIds: (editingProfile.travelerIds as number[]) ?? [], duplicateFromId: null };
    }
    return EMPTY_PROFILE_FORM;
  });

  const setField = <K extends keyof ProfileFormState>(k: K, v: ProfileFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleTraveler = (id: number) =>
    setForm((f) => ({
      ...f,
      travelerIds: f.travelerIds.includes(id) ? f.travelerIds.filter((x) => x !== id) : [...f.travelerIds, id],
    }));

  const handleDuplicateFrom = (profileId: number) => {
    const source = profiles.find((p) => p.id === profileId);
    if (source) setForm((f) => ({ ...f, travelerIds: (source.travelerIds as number[]) ?? [], duplicateFromId: profileId }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload = { name: form.name.trim(), emoji: form.emoji, travelerIds: form.travelerIds };
    if (editingProfile) onUpdate(editingProfile.id, payload);
    else onCreate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="h-1 w-full" style={{ background: GOLD }} />
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-playfair text-lg font-semibold" style={{ color: NAVY }}>
              {editingProfile ? "Edit profile" : "New trip profile"}
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-3">
              <div className="space-y-1.5 w-20 shrink-0">
                <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: GOLD }}>Emoji</label>
                <Input value={form.emoji} onChange={(e) => setField("emoji", e.target.value)} className="text-center text-xl px-2" maxLength={4} style={{ borderColor: "#E8E4DC" }} />
              </div>
              <div className="space-y-1.5 flex-1">
                <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: GOLD }}>Profile name</label>
                <Input autoFocus placeholder='e.g. Harris Family' value={form.name} onChange={(e) => setField("name", e.target.value)} required style={{ borderColor: "#E8E4DC" }} />
              </div>
            </div>

            {!editingProfile && profiles.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: GOLD }}>Start from existing</label>
                <select
                  className="w-full h-9 rounded-xl border px-3 py-1 text-sm bg-white"
                  style={{ borderColor: "#E8E4DC", color: NAVY }}
                  value={form.duplicateFromId ?? ""}
                  onChange={(e) => { const v = e.target.value; if (v) handleDuplicateFrom(parseInt(v, 10)); else setField("duplicateFromId", null); }}
                >
                  <option value="">— start fresh —</option>
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                </select>
              </div>
            )}

            {travelers.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: GOLD }}>Travelers to include</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {travelers.map((t) => {
                    const checked = form.travelerIds.includes(t.id);
                    return (
                      <label key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors"
                        style={{ borderColor: checked ? NAVY : "#E8E4DC", background: checked ? "#EEF2F8" : "white" }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleTraveler(t.id)} className="accent-[#1B3A5C]" />
                        <span className="text-sm font-medium flex-1" style={{ color: NAVY }}>{t.name}</span>
                        <span className={t.travelerType === "child" ? "badge-gold" : "badge-gold-adult"} style={{ textTransform: "capitalize" }}>{t.travelerType}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs" style={{ color: "#8a8078" }}>{form.travelerIds.length} selected</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose} style={{ borderColor: "#E8E4DC" }}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={!form.name.trim()} style={{ background: NAVY }}>
                {editingProfile ? "Save changes" : "Create profile"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function TravelerCard({ traveler, onEdit, onDelete, isEditing }: {
  traveler: any; onEdit: () => void; onDelete: () => void; isEditing: boolean;
}) {
  const isChild = traveler.travelerType === "child";
  const initials = traveler.name.charAt(0).toUpperCase();
  const foodPrefs: string[] = traveler.foodPreferences ?? [];
  const activityPrefs: string[] = traveler.activityPreferences ?? [];

  return (
    <div className={`card-premium p-5 ${isEditing ? "ring-2" : ""}`}
      style={isEditing ? { outline: "none", boxShadow: `0 0 0 2px ${NAVY}, 0 4px 12px rgba(0,0,0,0.10)` } : undefined}>
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold text-white shrink-0"
          style={{ background: NAVY }}
        >
          {initials}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-playfair font-semibold" style={{ fontSize: "18px", color: NAVY, lineHeight: 1.2 }}>
                {traveler.name}
              </h3>
              {traveler.relationship && (
                <p className="text-xs mt-0.5" style={{ color: "#8a8078" }}>{traveler.relationship}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className={isChild ? "badge-gold" : "badge-gold-adult"} style={{ textTransform: "capitalize" }}>
                {isChild ? "Child" : "Adult"}
              </span>
              <button className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[#EEF2F8] transition-all text-gray-400 hover:text-[#1B3A5C]" onClick={onEdit}>
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all text-gray-400 hover:text-red-500" onClick={onDelete}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {traveler.birthDate && (
            <p className="text-xs flex items-center gap-1.5 mt-1.5" style={{ color: "#8a8078" }}>
              <Calendar className="w-3.5 h-3.5" />
              {traveler.birthDate}
              {traveler.ageDisplay && (
                <span className="badge-gold ml-1">{traveler.ageDisplay}</span>
              )}
            </p>
          )}

          <TagRow label="Eats:" tags={foodPrefs} />
          <TagRow label="Does:" tags={activityPrefs} />

          {traveler.notes && (
            <p className="text-xs italic mt-1.5 truncate max-w-sm" style={{ color: "#8a8078" }}>{traveler.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}

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
  const activeProfile = activeProfileId !== null ? profiles.find((p) => p.id === activeProfileId) ?? null : null;
  const activeTravelerIds = activeProfile ? new Set<number>((activeProfile.travelerIds as number[]) ?? []) : null;
  const allTravelers = travelers ?? [];
  const displayedTravelers = activeTravelerIds ? allTravelers.filter((t) => activeTravelerIds.has(t.id)) : allTravelers;
  const adults = displayedTravelers.filter((t) => t.travelerType === "adult");
  const children = displayedTravelers.filter((t) => t.travelerType === "child");

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const startEdit = (t: any) => {
    setEditingId(t.id);
    setForm({ name: t.name, birthDate: t.birthDate ?? "", travelerType: t.travelerType, relationship: t.relationship ?? "", foodPreferences: (t.foodPreferences ?? []).join(", "), activityPreferences: (t.activityPreferences ?? []).join(", "), accessibilityNeeds: t.accessibilityNeeds ?? "", notes: t.notes ?? "" });
  };
  const cancelEdit = () => { setEditingId(null); setForm(EMPTY_FORM); };

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
        onSuccess: () => { setForm(EMPTY_FORM); invalidate(); toast({ title: `${form.travelerType === "child" ? "Child" : "Traveler"} added` }); },
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

  const handleCreateProfile = (f: Omit<ProfileFormState, "duplicateFromId">) => {
    createProfile.mutate(f, {
      onSuccess: (p) => { setShowProfileModal(false); setActiveProfileId(p.id); toast({ title: "Profile created" }); },
      onError: () => toast({ title: "Failed to create", variant: "destructive" }),
    });
  };

  const handleUpdateProfile = (id: number, data: Partial<ProfileFormState>) => {
    updateProfile.mutate({ id, ...data }, {
      onSuccess: () => { setEditingProfile(null); toast({ title: "Profile updated" }); },
      onError: () => toast({ title: "Failed to update", variant: "destructive" }),
    });
  };

  const handleDuplicateProfile = (id: number) => {
    duplicateProfile.mutate(id, {
      onSuccess: (copy) => { setEditingProfile(copy); toast({ title: "Profile duplicated" }); },
      onError: () => toast({ title: "Failed to duplicate", variant: "destructive" }),
    });
  };

  const handleDeleteProfile = (id: number) => {
    if (!confirm("Delete this profile?")) return;
    removeProfile.mutate(id, {
      onSuccess: () => { if (activeProfileId === id) setActiveProfileId(null); toast({ title: "Profile deleted" }); },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  };

  const isPending = createTraveler.isPending || updateTraveler.isPending;

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Page Header */}
        <div>
          <h1 className="font-playfair tracking-tight" style={{ color: NAVY, fontSize: "36px", fontWeight: 600 }}>
            Travel Party
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "#8a8078" }}>
            Everyone in the group — adults and children. Ages auto-fill on booking sites.
          </p>
          <span className="gold-rule" />
        </div>

        {/* Trip Profiles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="pref-label flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Trip Profiles
            </span>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* All chip */}
            <button
              onClick={() => setActiveProfileId(null)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all"
              style={activeProfileId === null
                ? { background: NAVY, color: "white", borderColor: NAVY }
                : { background: "white", color: NAVY, borderColor: "#E8E4DC" }}
            >
              <Users className="w-3.5 h-3.5" />
              All travelers
              {allTravelers.length > 0 && (
                <span className="text-xs rounded-full px-1.5 py-0 font-medium"
                  style={{ background: activeProfileId === null ? "rgba(255,255,255,0.20)" : "#EEF2F8", color: activeProfileId === null ? "white" : NAVY }}>
                  {allTravelers.length}
                </span>
              )}
            </button>

            {profilesQuery.isLoading
              ? [1, 2].map((i) => <Skeleton key={i} className="h-9 w-28 rounded-full" />)
              : profiles.map((profile) => {
                  const isActive = activeProfileId === profile.id;
                  const count = ((profile.travelerIds as number[]) ?? []).length;
                  return (
                    <div key={profile.id} className="inline-flex items-center rounded-full border overflow-hidden transition-all"
                      style={{ borderColor: isActive ? NAVY : "#E8E4DC" }}>
                      <button
                        onClick={() => setActiveProfileId(isActive ? null : profile.id)}
                        className="flex items-center gap-2 pl-3 pr-2 py-2 text-sm font-medium"
                        style={{ background: isActive ? NAVY : "white", color: isActive ? "white" : NAVY }}
                      >
                        <span>{profile.emoji ?? "✈️"}</span>
                        <span className="max-w-[110px] truncate">{profile.name}</span>
                        <span className="text-xs rounded-full px-1.5 py-0 font-medium ml-0.5"
                          style={{ background: isActive ? "rgba(255,255,255,0.20)" : "#EEF2F8", color: isActive ? "white" : NAVY }}>
                          {count}
                        </span>
                      </button>
                      <div className="flex items-center h-full pr-1"
                        style={{ background: isActive ? NAVY : "white" }}>
                        <button title="Edit" onClick={() => setEditingProfile(profile)} className="p-1 rounded transition-colors"
                          style={{ color: isActive ? "rgba(255,255,255,0.7)" : "#8a8078" }}>
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button title="Duplicate" onClick={() => handleDuplicateProfile(profile.id)} className="p-1 rounded transition-colors"
                          style={{ color: isActive ? "rgba(255,255,255,0.7)" : "#8a8078" }}>
                          <Copy className="w-3 h-3" />
                        </button>
                        <button title="Delete" onClick={() => handleDeleteProfile(profile.id)} className="p-1 rounded transition-colors"
                          style={{ color: isActive ? "rgba(255,255,255,0.5)" : "#c0b8b0" }}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}

            {/* + New chip */}
            <button
              onClick={() => { setEditingProfile(null); setShowProfileModal(true); }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all hover:bg-[#F9F7F4]"
              style={{ border: `1.5px dashed #C9972B`, color: GOLD, background: "transparent" }}
            >
              <Plus className="w-3.5 h-3.5" /> New profile
            </button>
          </div>

          {activeProfile && (
            <p className="text-xs" style={{ color: "#8a8078" }}>
              Viewing <span className="font-medium" style={{ color: NAVY }}>{activeProfile.emoji} {activeProfile.name}</span> — {displayedTravelers.length} traveler{displayedTravelers.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Traveler list */}
          <div className="lg:col-span-2 space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
              </div>
            ) : displayedTravelers.length > 0 ? (
              <>
                {adults.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: "#8a8078" }}>
                      <User className="w-3.5 h-3.5" /> Adults ({adults.length})
                    </h2>
                    <div className="space-y-3">
                      {adults.map((t) => (
                        <div key={t.id} className="group">
                          <TravelerCard traveler={t} onEdit={() => startEdit(t)} onDelete={() => handleDelete(t.id)} isEditing={editingId === t.id} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {children.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: "#8a8078" }}>
                      <Users className="w-3.5 h-3.5" /> Children ({children.length})
                    </h2>
                    <div className="space-y-3">
                      {children.map((t) => (
                        <div key={t.id} className="group">
                          <TravelerCard traveler={t} onEdit={() => startEdit(t)} onDelete={() => handleDelete(t.id)} isEditing={editingId === t.id} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : allTravelers.length === 0 ? (
              <div className="card-premium p-12 text-center" style={{ borderStyle: "dashed" }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#EEF2F8" }}>
                  <Users className="w-7 h-7" style={{ color: NAVY }} />
                </div>
                <p className="font-playfair text-lg font-semibold mb-1" style={{ color: NAVY }}>No travelers yet</p>
                <p className="text-sm" style={{ color: "#8a8078" }}>
                  Add everyone in your party — yourself, your partner, kids, travel friends.
                </p>
              </div>
            ) : (
              <div className="card-premium p-10 text-center">
                <p className="text-sm mb-2" style={{ color: "#8a8078" }}>No travelers in this profile.</p>
                <button className="text-sm font-medium" style={{ color: GOLD }} onClick={() => setEditingProfile(activeProfile)}>
                  Edit profile to add travelers
                </button>
              </div>
            )}
          </div>

          {/* Add / Edit Form */}
          <div className="lg:col-span-1">
            <div className="card-premium overflow-hidden sticky top-6" style={{ borderRadius: "16px" }}>
              <div className="h-1 w-full" style={{ background: GOLD }} />
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {editingId !== null
                      ? <Edit2 className="w-4 h-4" style={{ color: GOLD }} />
                      : <UserPlus className="w-4 h-4" style={{ color: GOLD }} />}
                    <h2 className="font-playfair font-semibold" style={{ color: NAVY, fontSize: "16px" }}>
                      {editingId !== null ? "Edit Traveler" : "Add Traveler"}
                    </h2>
                  </div>
                  {editingId !== null && (
                    <button onClick={cancelEdit} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs mb-5" style={{ color: "#8a8078" }}>
                  {editingId !== null ? "Update their details below." : "All fields except name are optional."}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Type toggle */}
                  <div className="space-y-1.5">
                    <span className="pref-label">Type</span>
                    <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "#E8E4DC" }}>
                      {(["adult", "child"] as TravelerType[]).map((type) => (
                        <button key={type} type="button" onClick={() => setField("travelerType", type)}
                          className="flex-1 py-2.5 text-sm font-medium transition-colors"
                          style={form.travelerType === type
                            ? { background: NAVY, color: "white" }
                            : { background: "white", color: "#8a8078" }}>
                          {type === "adult" ? "Adult" : "Child"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {[
                    { id: "name", label: "Name", placeholder: form.travelerType === "child" ? "e.g. Emma" : "e.g. Sarah", required: true, type: "text" },
                    { id: "relationship", label: "Relationship", placeholder: form.travelerType === "child" ? "e.g. child, stepchild" : "e.g. self, partner, friend", type: "text" },
                    { id: "birthDate", label: form.travelerType === "child" ? "Birthdate" : "Birthdate (optional)", placeholder: "", required: form.travelerType === "child", type: "date" },
                  ].map(({ id, label, placeholder, required, type }) => (
                    <div key={id} className="space-y-1.5">
                      <span className="pref-label">{label}</span>
                      <Input
                        id={id} type={type} placeholder={placeholder} required={required}
                        value={(form as any)[id]} onChange={(e) => setField(id as keyof FormState, e.target.value)}
                        style={{ borderColor: "#E8E4DC", color: NAVY }}
                        className="placeholder:text-[#bbb]"
                      />
                    </div>
                  ))}

                  <div className="space-y-1.5">
                    <span className="pref-label">Food preferences</span>
                    <Input placeholder="e.g. vegetarian, no gluten" value={form.foodPreferences}
                      onChange={(e) => setField("foodPreferences", e.target.value)}
                      style={{ borderColor: "#E8E4DC", color: NAVY }} className="placeholder:text-[#bbb]" />
                    <p className="text-xs" style={{ color: "#bbb" }}>Comma-separated</p>
                  </div>

                  <div className="space-y-1.5">
                    <span className="pref-label">Activity preferences</span>
                    <Input placeholder="e.g. hiking, spa, beach" value={form.activityPreferences}
                      onChange={(e) => setField("activityPreferences", e.target.value)}
                      style={{ borderColor: "#E8E4DC", color: NAVY }} className="placeholder:text-[#bbb]" />
                    <p className="text-xs" style={{ color: "#bbb" }}>Comma-separated</p>
                  </div>

                  <div className="space-y-1.5">
                    <span className="pref-label">Accessibility needs</span>
                    <Input placeholder="e.g. wheelchair, nut allergy" value={form.accessibilityNeeds}
                      onChange={(e) => setField("accessibilityNeeds", e.target.value)}
                      style={{ borderColor: "#E8E4DC", color: NAVY }} className="placeholder:text-[#bbb]" />
                  </div>

                  <div className="space-y-1.5">
                    <span className="pref-label">Notes</span>
                    <Textarea placeholder="e.g. Hates tourist traps" value={form.notes}
                      onChange={(e) => setField("notes", e.target.value)}
                      rows={2} className="resize-none placeholder:text-[#bbb]"
                      style={{ borderColor: "#E8E4DC", color: NAVY }} />
                  </div>

                  <button type="submit" disabled={isPending}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                    style={{ background: NAVY }}>
                    {isPending ? "Saving…" : editingId !== null ? "Save Changes" : `Add ${form.travelerType === "child" ? "Child" : "Traveler"}`}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(showProfileModal || editingProfile !== null) && (
        <ProfileModal
          profiles={profiles} travelers={allTravelers} editingProfile={editingProfile}
          onClose={() => { setShowProfileModal(false); setEditingProfile(null); }}
          onCreate={handleCreateProfile} onUpdate={handleUpdateProfile}
        />
      )}
    </Layout>
  );
}
