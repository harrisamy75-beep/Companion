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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus, Calendar, Edit2, X, Users, User, Plus, Copy, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

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
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create profile");
      return res.json() as Promise<TripProfile>;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: Partial<ProfileFormState> & { id: number }) => {
      const res = await fetch(`/api/trip-profiles/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json() as Promise<TripProfile>;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/trip-profiles/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete profile");
    },
    onSuccess: invalidate,
  });

  const duplicate = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/trip-profiles/${id}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to duplicate profile");
      return res.json() as Promise<TripProfile>;
    },
    onSuccess: invalidate,
  });

  return { query, create, update, remove, duplicate };
}

function ProfileModal({
  profiles,
  travelers,
  editingProfile,
  onClose,
  onCreate,
  onUpdate,
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
      return {
        name: editingProfile.name,
        emoji: editingProfile.emoji ?? "✈️",
        travelerIds: (editingProfile.travelerIds as number[]) ?? [],
        duplicateFromId: null,
      };
    }
    return EMPTY_PROFILE_FORM;
  });

  const setField = <K extends keyof ProfileFormState>(k: K, v: ProfileFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleTraveler = (id: number) => {
    setForm((f) => ({
      ...f,
      travelerIds: f.travelerIds.includes(id)
        ? f.travelerIds.filter((x) => x !== id)
        : [...f.travelerIds, id],
    }));
  };

  const handleDuplicateFrom = (profileId: number) => {
    const source = profiles.find((p) => p.id === profileId);
    if (source) {
      setForm((f) => ({
        ...f,
        travelerIds: (source.travelerIds as number[]) ?? [],
        duplicateFromId: profileId,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload = { name: form.name.trim(), emoji: form.emoji, travelerIds: form.travelerIds };
    if (editingProfile) {
      onUpdate(editingProfile.id, payload);
    } else {
      onCreate(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-background rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{editingProfile ? "Edit profile" : "New trip profile"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            <div className="space-y-1.5 w-20 shrink-0">
              <Label>Emoji</Label>
              <Input
                value={form.emoji}
                onChange={(e) => setField("emoji", e.target.value)}
                className="text-center text-xl px-2"
                maxLength={4}
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <Label>Profile name *</Label>
              <Input
                autoFocus
                placeholder='e.g. Harris Family'
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                required
              />
            </div>
          </div>

          {!editingProfile && profiles.length > 0 && (
            <div className="space-y-1.5">
              <Label>Start from existing profile (optional)</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={form.duplicateFromId ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) handleDuplicateFrom(parseInt(val, 10));
                  else setField("duplicateFromId", null);
                }}
              >
                <option value="">— start fresh —</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
                ))}
              </select>
            </div>
          )}

          {travelers.length > 0 && (
            <div className="space-y-2">
              <Label>Travelers to include</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {travelers.map((t) => {
                  const checked = form.travelerIds.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        checked ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTraveler(t.id)}
                        className="accent-primary"
                      />
                      <span className="text-sm font-medium">{t.name}</span>
                      <Badge variant="outline" className="text-xs ml-auto capitalize">{t.travelerType}</Badge>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{form.travelerIds.length} selected</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={!form.name.trim()}>
              {editingProfile ? "Save changes" : "Create profile"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TravelerCard({
  traveler,
  onEdit,
  onDelete,
  isEditing,
}: {
  traveler: any;
  onEdit: () => void;
  onDelete: () => void;
  isEditing: boolean;
}) {
  const isChild = traveler.travelerType === "child";
  const initials = traveler.name.charAt(0).toUpperCase();

  return (
    <Card className={`border-none shadow-sm overflow-hidden group ${isEditing ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-start justify-between p-5">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium ${isChild ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
            {initials}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg text-foreground leading-none">{traveler.name}</h3>
              <Badge variant={isChild ? "secondary" : "outline"} className="text-xs capitalize">
                {isChild ? "Child" : "Adult"}
              </Badge>
              {traveler.relationship && (
                <Badge variant="outline" className="text-xs text-muted-foreground">{traveler.relationship}</Badge>
              )}
            </div>
            {traveler.birthDate && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {traveler.birthDate}
                {traveler.ageDisplay && (
                  <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ml-1">
                    {traveler.ageDisplay}
                  </span>
                )}
              </p>
            )}
            {((traveler.foodPreferences?.length ?? 0) > 0 || (traveler.activityPreferences?.length ?? 0) > 0) && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {traveler.foodPreferences?.map((p: string) => (
                  <span key={p} className="inline-flex items-center rounded-md bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 text-xs font-medium">{p}</span>
                ))}
                {traveler.activityPreferences?.map((p: string) => (
                  <span key={p} className="inline-flex items-center rounded-md bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs font-medium">{p}</span>
                ))}
              </div>
            )}
            {traveler.notes && (
              <p className="text-xs text-muted-foreground italic max-w-sm truncate">{traveler.notes}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100 shrink-0">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={onEdit}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
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
    const stored = localStorage.getItem(ACTIVE_PROFILE_KEY);
    return stored ? parseInt(stored, 10) : null;
  });

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<TripProfile | null>(null);

  useEffect(() => {
    if (activeProfileId !== null) {
      localStorage.setItem(ACTIVE_PROFILE_KEY, String(activeProfileId));
    } else {
      localStorage.removeItem(ACTIVE_PROFILE_KEY);
    }
  }, [activeProfileId]);

  const profiles = profilesQuery.data ?? [];

  const activeProfile = activeProfileId !== null ? profiles.find((p) => p.id === activeProfileId) ?? null : null;
  const activeTravelerIds = activeProfile ? new Set<number>((activeProfile.travelerIds as number[]) ?? []) : null;

  const allTravelers = travelers ?? [];
  const displayedTravelers = activeTravelerIds
    ? allTravelers.filter((t) => activeTravelerIds.has(t.id))
    : allTravelers;

  const adults = displayedTravelers.filter((t) => t.travelerType === "adult");
  const children = displayedTravelers.filter((t) => t.travelerType === "child");

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const startEdit = (t: any) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      birthDate: t.birthDate ?? "",
      travelerType: t.travelerType as TravelerType,
      relationship: t.relationship ?? "",
      foodPreferences: (t.foodPreferences ?? []).join(", "),
      activityPreferences: (t.activityPreferences ?? []).join(", "),
      accessibilityNeeds: t.accessibilityNeeds ?? "",
      notes: t.notes ?? "",
    });
  };

  const cancelEdit = () => { setEditingId(null); setForm(EMPTY_FORM); };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTravelersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTravelSummaryQueryKey() });
  };

  const buildPayload = () => ({
    name: form.name,
    travelerType: form.travelerType,
    birthDate: form.birthDate || undefined,
    relationship: form.relationship || undefined,
    foodPreferences: parseTags(form.foodPreferences),
    activityPreferences: parseTags(form.activityPreferences),
    accessibilityNeeds: form.accessibilityNeeds || undefined,
    notes: form.notes || undefined,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    if (editingId !== null) {
      updateTraveler.mutate(
        { id: editingId, data: buildPayload() },
        {
          onSuccess: () => { cancelEdit(); invalidate(); toast({ title: "Traveler updated" }); },
          onError: () => toast({ title: "Failed to update", variant: "destructive" }),
        }
      );
    } else {
      createTraveler.mutate(
        { data: buildPayload() },
        {
          onSuccess: () => { setForm(EMPTY_FORM); invalidate(); toast({ title: `${form.travelerType === "child" ? "Child" : "Traveler"} added` }); },
          onError: () => toast({ title: "Failed to add", variant: "destructive" }),
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Remove this traveler?")) return;
    deleteTraveler.mutate(
      { id },
      {
        onSuccess: () => { if (editingId === id) cancelEdit(); invalidate(); toast({ title: "Traveler removed" }); },
        onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
      }
    );
  };

  const handleCreateProfile = (form: Omit<ProfileFormState, "duplicateFromId">) => {
    createProfile.mutate(form, {
      onSuccess: (profile) => {
        setShowProfileModal(false);
        setActiveProfileId(profile.id);
        toast({ title: "Profile created" });
      },
      onError: () => toast({ title: "Failed to create profile", variant: "destructive" }),
    });
  };

  const handleUpdateProfile = (id: number, data: Partial<ProfileFormState>) => {
    updateProfile.mutate({ id, ...data }, {
      onSuccess: () => { setEditingProfile(null); toast({ title: "Profile updated" }); },
      onError: () => toast({ title: "Failed to update profile", variant: "destructive" }),
    });
  };

  const handleDuplicateProfile = (id: number) => {
    duplicateProfile.mutate(id, {
      onSuccess: (copy) => {
        setEditingProfile(copy);
        toast({ title: "Profile duplicated — edit and save" });
      },
      onError: () => toast({ title: "Failed to duplicate", variant: "destructive" }),
    });
  };

  const handleDeleteProfile = (id: number) => {
    if (!confirm("Delete this profile?")) return;
    removeProfile.mutate(id, {
      onSuccess: () => {
        if (activeProfileId === id) setActiveProfileId(null);
        toast({ title: "Profile deleted" });
      },
      onError: () => toast({ title: "Failed to delete profile", variant: "destructive" }),
    });
  };

  const isPending = createTraveler.isPending || updateTraveler.isPending;

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-serif text-foreground tracking-tight">Travel Party</h1>
          <p className="text-muted-foreground mt-2">
            Everyone in the group — adults and children. Ages auto-fill on booking sites.
          </p>
        </div>

        {/* Trip Profiles Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4" /> Trip Profiles
            </h2>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={() => { setEditingProfile(null); setShowProfileModal(true); }}
            >
              <Plus className="w-3.5 h-3.5" /> New profile
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* "All" pill */}
            <button
              onClick={() => setActiveProfileId(null)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeProfileId === null
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              All travelers
              {allTravelers.length > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0 ${activeProfileId === null ? "bg-primary-foreground/20" : "bg-secondary"}`}>
                  {allTravelers.length}
                </span>
              )}
            </button>

            {profilesQuery.isLoading
              ? [1, 2].map((i) => <Skeleton key={i} className="h-8 w-28 rounded-full" />)
              : profiles.map((profile) => {
                  const isActive = activeProfileId === profile.id;
                  const count = ((profile.travelerIds as number[]) ?? []).length;
                  return (
                    <div key={profile.id} className="flex items-center gap-0.5 group/pill">
                      <button
                        onClick={() => setActiveProfileId(isActive ? null : profile.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-l-full text-sm font-medium border-y border-l transition-colors ${
                          isActive
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                        }`}
                      >
                        <span>{profile.emoji ?? "✈️"}</span>
                        <span className="max-w-[120px] truncate">{profile.name}</span>
                        <span className={`text-xs rounded-full px-1.5 py-0 ${isActive ? "bg-primary-foreground/20" : "bg-secondary"}`}>
                          {count}
                        </span>
                      </button>
                      <div className={`flex items-center border-y border-r rounded-r-full h-[34px] px-1 gap-0 transition-colors ${isActive ? "border-primary bg-primary" : "border-border bg-background"}`}>
                        <button
                          title="Edit profile"
                          onClick={() => setEditingProfile(profile)}
                          className={`p-1 rounded-sm transition-colors ${isActive ? "hover:bg-primary-foreground/20 text-primary-foreground" : "hover:bg-secondary text-muted-foreground hover:text-foreground"}`}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          title="Duplicate profile"
                          onClick={() => handleDuplicateProfile(profile.id)}
                          className={`p-1 rounded-sm transition-colors ${isActive ? "hover:bg-primary-foreground/20 text-primary-foreground" : "hover:bg-secondary text-muted-foreground hover:text-foreground"}`}
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          title="Delete profile"
                          onClick={() => handleDeleteProfile(profile.id)}
                          className={`p-1 rounded-sm transition-colors ${isActive ? "hover:bg-red-500/30 text-primary-foreground" : "hover:bg-destructive/10 text-muted-foreground hover:text-destructive"}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
          </div>

          {activeProfile && (
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-foreground">{activeProfile.emoji} {activeProfile.name}</span> — {displayedTravelers.length} traveler{displayedTravelers.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Traveler list */}
          <div className="lg:col-span-2 space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
              </div>
            ) : displayedTravelers.length > 0 ? (
              <>
                {adults.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <User className="w-4 h-4" /> Adults ({adults.length})
                    </h2>
                    {adults.map((t) => (
                      <TravelerCard key={t.id} traveler={t} onEdit={() => startEdit(t)} onDelete={() => handleDelete(t.id)} isEditing={editingId === t.id} />
                    ))}
                  </div>
                )}
                {children.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-4 h-4" /> Children ({children.length})
                    </h2>
                    {children.map((t) => (
                      <TravelerCard key={t.id} traveler={t} onEdit={() => startEdit(t)} onDelete={() => handleDelete(t.id)} isEditing={editingId === t.id} />
                    ))}
                  </div>
                )}
              </>
            ) : allTravelers.length === 0 ? (
              <Card className="border-dashed border-2 bg-transparent shadow-none">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-medium text-foreground mb-1">No travelers yet</p>
                  <p className="text-muted-foreground max-w-sm">
                    Add everyone in your party — yourself, your partner, kids, travel friends.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed border-2 bg-transparent shadow-none">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-muted-foreground">No travelers in this profile.</p>
                  <Button variant="link" size="sm" className="mt-1" onClick={() => setEditingProfile(activeProfile)}>
                    Edit profile to add travelers
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Add / Edit form */}
          <div className="lg:col-span-1">
            <Card className="border-none shadow-md sticky top-24">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {editingId !== null ? <Edit2 className="w-5 h-5 text-primary" /> : <UserPlus className="w-5 h-5 text-primary" />}
                    {editingId !== null ? "Edit Traveler" : "Add Traveler"}
                  </div>
                  {editingId !== null && (
                    <Button variant="ghost" size="icon" onClick={cancelEdit} className="h-8 w-8 -mr-2 text-muted-foreground">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>
                  {editingId !== null ? "Update their details below." : "Fill in what you know — all fields except name are optional."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <div className="flex rounded-lg border overflow-hidden">
                      {(["adult", "child"] as TravelerType[]).map((type) => (
                        <button key={type} type="button" onClick={() => setField("travelerType", type)}
                          className={`flex-1 py-2 text-sm font-medium transition-colors ${form.travelerType === type ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-secondary"}`}>
                          {type === "adult" ? "Adult" : "Child"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name *</Label>
                    <Input id="name" placeholder={form.travelerType === "child" ? "e.g. Emma" : "e.g. Sarah"} value={form.name} onChange={(e) => setField("name", e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="relationship">Relationship</Label>
                    <Input id="relationship" placeholder={form.travelerType === "child" ? "e.g. child, stepchild" : "e.g. self, partner, friend"} value={form.relationship} onChange={(e) => setField("relationship", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="birthDate">{form.travelerType === "child" ? "Birthdate" : "Birthdate (optional)"}</Label>
                    <Input id="birthDate" type="date" value={form.birthDate} onChange={(e) => setField("birthDate", e.target.value)} required={form.travelerType === "child"} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="foodPreferences">Food preferences</Label>
                    <Input id="foodPreferences" placeholder="e.g. vegetarian, no gluten, adventurous" value={form.foodPreferences} onChange={(e) => setField("foodPreferences", e.target.value)} />
                    <p className="text-xs text-muted-foreground">Comma-separated</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="activityPreferences">Activity preferences</Label>
                    <Input id="activityPreferences" placeholder="e.g. hiking, spa, beach, museums" value={form.activityPreferences} onChange={(e) => setField("activityPreferences", e.target.value)} />
                    <p className="text-xs text-muted-foreground">Comma-separated</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="accessibilityNeeds">Accessibility needs</Label>
                    <Input id="accessibilityNeeds" placeholder="e.g. wheelchair, nut allergy" value={form.accessibilityNeeds} onChange={(e) => setField("accessibilityNeeds", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" placeholder="e.g. Sarah is vegan, hates tourist traps" value={form.notes} onChange={(e) => setField("notes", e.target.value)} rows={2} className="resize-none" />
                  </div>
                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? "Saving…" : editingId !== null ? "Save Changes" : `Add ${form.travelerType === "child" ? "Child" : "Traveler"}`}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {(showProfileModal || editingProfile !== null) && (
        <ProfileModal
          profiles={profiles}
          travelers={allTravelers}
          editingProfile={editingProfile}
          onClose={() => { setShowProfileModal(false); setEditingProfile(null); }}
          onCreate={handleCreateProfile}
          onUpdate={handleUpdateProfile}
        />
      )}
    </Layout>
  );
}
