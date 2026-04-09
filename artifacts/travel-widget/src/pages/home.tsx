import { Layout } from "@/components/layout";
import { useGetTravelSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plane, Users, Calendar, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function Home() {
  const { data: summary, isLoading } = useGetTravelSummary();

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-serif text-foreground tracking-tight">Travel Dashboard</h1>
          <p className="text-muted-foreground mt-2">Quick reference for your upcoming trips.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Kids Summary */}
          <Card className="border-none shadow-md overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <CardHeader className="pb-3 border-b border-border/50 bg-secondary/30">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5 text-primary" />
                Travel Party ({summary?.totalTravelers || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {summary?.travelers && summary.travelers.length > 0 ? (
                <div className="space-y-3">
                  {summary.travelers.slice(0, 4).map((t: any) => (
                    <div key={t.id} className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <div>
                        <p className="font-medium text-foreground">{t.name}</p>
                        <p className="text-sm text-muted-foreground capitalize">{t.travelerType}{t.relationship ? ` · ${t.relationship}` : ""}</p>
                      </div>
                      <div className="text-right">
                        {t.ageDisplay ? (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-medium text-primary">
                            {t.ageDisplay}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-sm font-medium text-muted-foreground">
                            {t.travelerType}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {summary.travelers.length > 4 && (
                    <p className="text-xs text-muted-foreground text-center">+{summary.travelers.length - 4} more</p>
                  )}
                  <Link href="/travelers" className="block text-center text-sm text-primary hover:underline mt-1">
                    Manage travel party
                  </Link>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-4">No travelers added yet.</p>
                  <Link href="/travelers" className="text-primary font-medium hover:underline">
                    Add your travel party
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preferences Summary */}
          <Card className="border-none shadow-md overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-accent" />
            <CardHeader className="pb-3 border-b border-border/50 bg-secondary/30">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plane className="w-5 h-5 text-accent" />
                Travel Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {summary?.hasPreferences && summary.preferences ? (
                <div className="space-y-4 text-sm">
                  {summary.preferences.seatPreference && (
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-muted-foreground">Seats</span>
                      <span className="col-span-2 font-medium">{summary.preferences.seatPreference}</span>
                    </div>
                  )}
                  {summary.preferences.mealPreference && (
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-muted-foreground">Meals</span>
                      <span className="col-span-2 font-medium">{summary.preferences.mealPreference}</span>
                    </div>
                  )}
                  {summary.preferences.frequentFlyerNumbers && (
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-muted-foreground">FF#</span>
                      <span className="col-span-2 font-medium">{summary.preferences.frequentFlyerNumbers}</span>
                    </div>
                  )}
                  {summary.preferences.passportNotes && (
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-muted-foreground">Passports</span>
                      <span className="col-span-2 font-medium truncate">{summary.preferences.passportNotes}</span>
                    </div>
                  )}
                  <Link href="/preferences" className="block text-center text-primary hover:underline mt-4">
                    Update preferences
                  </Link>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-3">
                    <AlertCircle className="w-6 h-6 text-accent" />
                  </div>
                  <p className="text-muted-foreground mb-4">No preferences saved.</p>
                  <Link href="/preferences" className="text-primary font-medium hover:underline">
                    Set up preferences
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
