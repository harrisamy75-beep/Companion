import { Layout } from "@/components/layout";
import { useGetTravelSummary } from "@workspace/api-client-react";
import { Plane, Users, Settings, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

const NAVY = "#1B3A5C";
const GOLD = "#C9972B";

export default function Home() {
  const { data: summary, isLoading } = useGetTravelSummary();

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-8">
          <div className="space-y-2">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-0.5 w-16 mt-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </div>
      </Layout>
    );
  }

  const travelers = summary?.travelers ?? [];
  const prefs = summary?.preferences as any;

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Page Header */}
        <div>
          <h1
            className="font-playfair tracking-tight leading-tight"
            style={{ color: NAVY, fontSize: "36px", fontWeight: 600 }}
          >
            Travel Dashboard
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "#8a8078" }}>
            Quick reference for your upcoming trips.
          </p>
          <span className="gold-rule" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Travel Party card */}
          <div className="card-premium overflow-hidden">
            {/* Card top accent */}
            <div className="h-1 w-full" style={{ background: NAVY }} />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "#EEF2F8" }}
                  >
                    <Users className="w-4.5 h-4.5" style={{ color: NAVY }} />
                  </div>
                  <div>
                    <h2 className="font-playfair font-semibold text-base" style={{ color: NAVY }}>
                      Travel Party
                    </h2>
                    <p className="text-xs" style={{ color: "#8a8078" }}>
                      {travelers.length} traveler{travelers.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </div>

              {travelers.length > 0 ? (
                <div className="space-y-2.5">
                  {travelers.slice(0, 4).map((t: any) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between px-4 py-3 rounded-xl"
                      style={{ background: "#F9F7F4", border: "1px solid #E8E4DC" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
                          style={{ background: NAVY }}
                        >
                          {t.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-playfair font-medium text-sm" style={{ color: NAVY }}>
                            {t.name}
                          </p>
                          <p className="text-xs capitalize" style={{ color: "#8a8078" }}>
                            {t.travelerType}{t.relationship ? ` · ${t.relationship}` : ""}
                          </p>
                        </div>
                      </div>
                      {t.ageDisplay ? (
                        <span className="badge-gold">{t.ageDisplay}</span>
                      ) : (
                        <span className="badge-gold-adult capitalize">{t.travelerType}</span>
                      )}
                    </div>
                  ))}
                  {travelers.length > 4 && (
                    <p className="text-xs text-center pt-1" style={{ color: "#8a8078" }}>
                      +{travelers.length - 4} more
                    </p>
                  )}
                  <Link
                    href="/travelers"
                    className="flex items-center justify-center gap-1.5 text-sm font-medium mt-2 py-2 rounded-xl transition-colors hover:bg-[#F9F7F4]"
                    style={{ color: NAVY }}
                  >
                    Manage travel party <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-center">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                    style={{ background: "#EEF2F8" }}
                  >
                    <Users className="w-6 h-6" style={{ color: NAVY }} />
                  </div>
                  <p className="text-sm mb-3" style={{ color: "#8a8078" }}>No travelers added yet.</p>
                  <Link
                    href="/travelers"
                    className="text-sm font-semibold flex items-center gap-1"
                    style={{ color: NAVY }}
                  >
                    Add your travel party <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Preferences card */}
          <div className="card-premium overflow-hidden">
            <div className="h-1 w-full" style={{ background: GOLD }} />
            <div className="p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "#FDF3DC" }}
                >
                  <Plane className="w-4.5 h-4.5" style={{ color: GOLD }} />
                </div>
                <div>
                  <h2 className="font-playfair font-semibold text-base" style={{ color: NAVY }}>
                    Travel Preferences
                  </h2>
                  <p className="text-xs" style={{ color: "#8a8078" }}>
                    {summary?.hasPreferences ? "Saved" : "Not set up yet"}
                  </p>
                </div>
              </div>

              {summary?.hasPreferences && prefs ? (
                <div className="space-y-3">
                  {[
                    { label: "Seats", value: prefs.seatPreference },
                    { label: "Meals", value: prefs.mealPreference },
                    { label: "FF#", value: prefs.frequentFlyerNumbers },
                    { label: "Passports", value: prefs.passportNotes },
                  ]
                    .filter((row) => row.value)
                    .map((row) => (
                      <div
                        key={row.label}
                        className="flex items-baseline gap-3 px-4 py-3 rounded-xl"
                        style={{ background: "#F9F7F4", border: "1px solid #E8E4DC" }}
                      >
                        <span className="pref-label w-20 shrink-0">{row.label}</span>
                        <span className="text-sm font-medium truncate" style={{ color: NAVY }}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  <Link
                    href="/preferences"
                    className="flex items-center justify-center gap-1.5 text-sm font-medium mt-2 py-2 rounded-xl transition-colors hover:bg-[#F9F7F4]"
                    style={{ color: NAVY }}
                  >
                    Update preferences <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-center">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                    style={{ background: "#FDF3DC" }}
                  >
                    <Settings className="w-6 h-6" style={{ color: GOLD }} />
                  </div>
                  <p className="text-sm mb-3" style={{ color: "#8a8078" }}>No preferences saved yet.</p>
                  <Link
                    href="/preferences"
                    className="text-sm font-semibold flex items-center gap-1"
                    style={{ color: GOLD }}
                  >
                    Set up preferences <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
