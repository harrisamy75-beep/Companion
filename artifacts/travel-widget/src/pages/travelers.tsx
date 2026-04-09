import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useListTravelers,
  useCreateTraveler,
  useUpdateTraveler,
  useDeleteTraveler,
  getListTravelersQueryKey,
  getGetTravelSummaryQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus, Calendar, Edit2, X, Users, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium ${
              isChild ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"
            }`}
          >
            {initials}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg text-foreground leading-none">{traveler.name}</h3>
              <Badge variant={isChild ? "secondary" : "outline"} className="text-xs capitalize">
                {isChild ? "Child" : "Adult"}
              </Badge>
              {traveler.relationship && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {traveler.relationship}
                </Badge>
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
                  <span key={p} className="inline-flex items-center rounded-md bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 text-xs font-medium">
                    {p}
                  </span>
                ))}
                {traveler.activityPreferences?.map((p: string) => (
                  <span key={p} className="inline-flex items-center rounded-md bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs font-medium">
                    {p}
                  </span>
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

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);

  const adults = travelers?.filter((t) => t.travelerType === "adult") ?? [];
  const children = travelers?.filter((t) => t.travelerType === "child") ?? [];

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

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

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
          onSuccess: () => {
            cancelEdit();
            invalidate();
            toast({ title: "Traveler updated" });
          },
          onError: () => toast({ title: "Failed to update", variant: "destructive" }),
        }
      );
    } else {
      createTraveler.mutate(
        { data: buildPayload() },
        {
          onSuccess: () => {
            setForm(EMPTY_FORM);
            invalidate();
            toast({ title: `${form.travelerType === "child" ? "Child" : "Traveler"} added` });
          },
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
        onSuccess: () => {
          if (editingId === id) cancelEdit();
          invalidate();
          toast({ title: "Traveler removed" });
        },
        onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
      }
    );
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Traveler list */}
          <div className="lg:col-span-2 space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
              </div>
            ) : travelers && travelers.length > 0 ? (
              <>
                {adults.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <User className="w-4 h-4" /> Adults ({adults.length})
                    </h2>
                    {adults.map((t) => (
                      <TravelerCard
                        key={t.id}
                        traveler={t}
                        onEdit={() => startEdit(t)}
                        onDelete={() => handleDelete(t.id)}
                        isEditing={editingId === t.id}
                      />
                    ))}
                  </div>
                )}

                {children.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-4 h-4" /> Children ({children.length})
                    </h2>
                    {children.map((t) => (
                      <TravelerCard
                        key={t.id}
                        traveler={t}
                        onEdit={() => startEdit(t)}
                        onDelete={() => handleDelete(t.id)}
                        isEditing={editingId === t.id}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
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
                  {/* Type toggle */}
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <div className="flex rounded-lg border overflow-hidden">
                      {(["adult", "child"] as TravelerType[]).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setField("travelerType", type)}
                          className={`flex-1 py-2 text-sm font-medium transition-colors ${
                            form.travelerType === type
                              ? "bg-primary text-primary-foreground"
                              : "bg-background text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          {type === "adult" ? "Adult" : "Child"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      placeholder={form.travelerType === "child" ? "e.g. Emma" : "e.g. Sarah"}
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="relationship">Relationship</Label>
                    <Input
                      id="relationship"
                      placeholder={form.travelerType === "child" ? "e.g. child, stepchild" : "e.g. self, partner, friend"}
                      value={form.relationship}
                      onChange={(e) => setField("relationship", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="birthDate">
                      {form.travelerType === "child" ? "Birthdate" : "Birthdate (optional)"}
                    </Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={form.birthDate}
                      onChange={(e) => setField("birthDate", e.target.value)}
                      required={form.travelerType === "child"}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="foodPreferences">Food preferences</Label>
                    <Input
                      id="foodPreferences"
                      placeholder="e.g. vegetarian, no gluten, adventurous"
                      value={form.foodPreferences}
                      onChange={(e) => setField("foodPreferences", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Comma-separated</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="activityPreferences">Activity preferences</Label>
                    <Input
                      id="activityPreferences"
                      placeholder="e.g. hiking, spa, beach, museums"
                      value={form.activityPreferences}
                      onChange={(e) => setField("activityPreferences", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Comma-separated</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="accessibilityNeeds">Accessibility needs</Label>
                    <Input
                      id="accessibilityNeeds"
                      placeholder="e.g. wheelchair, nut allergy"
                      value={form.accessibilityNeeds}
                      onChange={(e) => setField("accessibilityNeeds", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="e.g. Sarah is vegan, hates tourist traps"
                      value={form.notes}
                      onChange={(e) => setField("notes", e.target.value)}
                      rows={2}
                      className="resize-none"
                    />
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
    </Layout>
  );
}
