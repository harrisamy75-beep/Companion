import { useState } from "react";
import { Layout } from "@/components/layout";
import { 
  useListChildren, 
  useCreateChild, 
  useUpdateChild,
  useDeleteChild,
  getListChildrenQueryKey,
  getGetTravelSummaryQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, UserPlus, Calendar, Edit2, X, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChildrenPage() {
  const { data: children, isLoading } = useListChildren();
  const createChild = useCreateChild();
  const updateChild = useUpdateChild();
  const deleteChild = useDeleteChild();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const startEdit = (child: { id: number, name: string, birthdate: string }) => {
    setEditingId(child.id);
    setName(child.name);
    setBirthdate(child.birthdate.split('T')[0] || child.birthdate); // just in case it's a timestamp
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName("");
    setBirthdate("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !birthdate) return;

    if (editingId) {
      updateChild.mutate(
        { id: editingId, data: { name, birthdate } },
        {
          onSuccess: () => {
            cancelEdit();
            queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetTravelSummaryQueryKey() });
            toast({ title: "Child updated successfully" });
          },
          onError: () => {
            toast({ title: "Failed to update child", variant: "destructive" });
          }
        }
      );
    } else {
      createChild.mutate(
        { data: { name, birthdate } },
        {
          onSuccess: () => {
            setName("");
            setBirthdate("");
            queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetTravelSummaryQueryKey() });
            toast({ title: "Child added successfully" });
          },
          onError: () => {
            toast({ title: "Failed to add child", variant: "destructive" });
          }
        }
      );
    }
  };

  const handleDeleteChild = (id: number) => {
    if (!confirm("Are you sure you want to remove this child?")) return;

    deleteChild.mutate(
      { id },
      {
        onSuccess: () => {
          if (editingId === id) cancelEdit();
          queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTravelSummaryQueryKey() });
          toast({ title: "Child removed" });
        },
        onError: () => {
          toast({ title: "Failed to remove child", variant: "destructive" });
        }
      }
    );
  };

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-serif text-foreground tracking-tight">Manage Children</h1>
          <p className="text-muted-foreground mt-2">Add your children to automatically track their ages for travel bookings.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : children && children.length > 0 ? (
              children.map(child => (
                <Card key={child.id} className={`border-none shadow-sm overflow-hidden group ${editingId === child.id ? 'ring-2 ring-primary' : ''}`}>
                  <div className="flex items-center justify-between p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-lg">
                        {child.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-foreground">{child.name}</h3>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {child.birthdate}
                          </span>
                          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {child.ageDisplay}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={() => startEdit(child)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteChild(child.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="border-dashed border-2 bg-transparent shadow-none">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-medium text-foreground mb-1">No children added</p>
                  <p className="text-muted-foreground max-w-sm">
                    Add your children here. Their ages will be automatically calculated when you need them for booking.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="border-none shadow-md sticky top-24">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {editingId ? <Edit2 className="w-5 h-5 text-primary" /> : <UserPlus className="w-5 h-5 text-primary" />}
                    {editingId ? "Edit Child" : "Add Child"}
                  </div>
                  {editingId && (
                    <Button variant="ghost" size="icon" onClick={cancelEdit} className="h-8 w-8 -mr-2 text-muted-foreground">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>
                  {editingId ? "Update their details below." : "Enter their birthdate to auto-calculate age."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">First Name</Label>
                    <Input 
                      id="name" 
                      placeholder="e.g. Emma" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthdate">Birthdate</Label>
                    <Input 
                      id="birthdate" 
                      type="date"
                      value={birthdate}
                      onChange={(e) => setBirthdate(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={createChild.isPending || updateChild.isPending}
                  >
                    {createChild.isPending || updateChild.isPending ? "Saving..." : (editingId ? "Save Changes" : "Add Child")}
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
