import { Layout } from "@/components/layout";
import { useGetTravelSummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function Home() {
  const { data: summary, isLoading } = useGetTravelSummary();

  if (isLoading) {
    return (
      <Layout>
        <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Skeleton style={{ height: "58px", width: "260px", borderRadius: "2px" }} />
            <Skeleton style={{ height: "22px", width: "200px", borderRadius: "2px" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <Skeleton style={{ height: "280px", borderRadius: "2px" }} />
            <Skeleton style={{ height: "280px", borderRadius: "2px" }} />
          </div>
        </div>
      </Layout>
    );
  }

  const travelers = summary?.travelers ?? [];
  const prefs = summary?.preferences as any;

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>

        {/* Page header */}
        <div>
          <h1
            className="font-playfair"
            style={{ fontWeight: 700, fontSize: "48px", color: "#1C1C1C", letterSpacing: "-0.01em" }}
          >
            Travel Dashboard
          </h1>
          <p
            className="font-playfair"
            style={{ fontStyle: "italic", fontSize: "17px", color: "#8C8279", marginTop: "6px" }}
          >
            Everything you need, in one place.
          </p>
          <span className="section-rule" style={{ marginTop: "24px", display: "block" }} />
        </div>

        {/* Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "24px",
          }}
        >
          {/* Travel Party */}
          <div className="card-editorial">
            <p className="eyebrow" style={{ marginBottom: "10px" }}>Travel Party</p>
            <h2
              className="font-playfair"
              style={{ fontWeight: 400, fontSize: "22px", color: "#1C1C1C", marginBottom: "24px" }}
            >
              {summary?.totalTravelers || 0} traveler{(summary?.totalTravelers || 0) !== 1 ? "s" : ""}
            </h2>

            {travelers.length > 0 ? (
              <div>
                {travelers.slice(0, 5).map((t: any) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      padding: "10px 0",
                      borderBottom: "1px solid #E5E0D8",
                    }}
                  >
                    <div>
                      <span
                        className="font-playfair"
                        style={{ fontSize: "15px", fontWeight: 400, color: "#1C1C1C" }}
                      >
                        {t.name}
                      </span>
                      {t.relationship && (
                        <span
                          style={{
                            fontFamily: "'Raleway', sans-serif",
                            fontSize: "12px",
                            color: "#8C8279",
                            marginLeft: "8px",
                          }}
                        >
                          · {t.relationship}
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontFamily: "'Raleway', sans-serif",
                        fontSize: "12px",
                        color: "#8C8279",
                        textTransform: "capitalize" as const,
                      }}
                    >
                      {t.ageDisplay || t.travelerType}
                    </span>
                  </div>
                ))}
                {travelers.length > 5 && (
                  <p
                    style={{
                      fontFamily: "'Raleway', sans-serif",
                      fontSize: "12px",
                      color: "#8C8279",
                      marginTop: "10px",
                    }}
                  >
                    +{travelers.length - 5} more
                  </p>
                )}
                <div style={{ marginTop: "24px" }}>
                  <Link href="/travelers" className="link-wine" style={{ fontSize: "13px" }}>
                    Manage travel party →
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ paddingTop: "8px" }}>
                <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: "14px", color: "#8C8279", marginBottom: "16px" }}>
                  No travelers added yet.
                </p>
                <Link href="/travelers" className="link-wine" style={{ fontSize: "13px" }}>
                  Add your travel party →
                </Link>
              </div>
            )}
          </div>

          {/* Preferences */}
          <div className="card-editorial">
            <p className="eyebrow" style={{ marginBottom: "10px" }}>Preferences</p>
            <h2
              className="font-playfair"
              style={{ fontWeight: 400, fontSize: "22px", color: "#1C1C1C", marginBottom: "24px" }}
            >
              Travel Profile
            </h2>

            {summary?.hasPreferences && prefs ? (
              <div>
                {[
                  { label: "Seats", value: prefs.seatPreference },
                  { label: "Meals", value: prefs.mealPreference },
                  { label: "Frequent Flyer", value: prefs.frequentFlyerNumbers },
                  { label: "Passports", value: prefs.passportNotes },
                  { label: "Hotel", value: prefs.hotelPreferences },
                ]
                  .filter((r) => r.value)
                  .map((row) => (
                    <div
                      key={row.label}
                      style={{
                        display: "flex",
                        gap: "16px",
                        padding: "10px 0",
                        borderBottom: "1px solid #E5E0D8",
                      }}
                    >
                      <span
                        className="eyebrow"
                        style={{ width: "90px", flexShrink: 0, paddingTop: "2px" }}
                      >
                        {row.label}
                      </span>
                      <span
                        style={{
                          fontFamily: "'Raleway', sans-serif",
                          fontSize: "14px",
                          color: "#1C1C1C",
                          fontWeight: 400,
                        }}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                <div style={{ marginTop: "24px" }}>
                  <Link href="/preferences" className="link-wine" style={{ fontSize: "13px" }}>
                    Update preferences →
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ paddingTop: "8px" }}>
                <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: "14px", color: "#8C8279", marginBottom: "16px" }}>
                  No preferences saved yet.
                </p>
                <Link href="/preferences" className="link-wine" style={{ fontSize: "13px" }}>
                  Set up preferences →
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>
    </Layout>
  );
}
