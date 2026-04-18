import { Layout } from "@/components/layout";
import { usePlan, useChangePlan, formatLimit, type PlanDef } from "@/lib/use-plan";
import { useToast } from "@/hooks/use-toast";

const ROW_DEFS: { key: keyof PlanDef["limits"]; label: string }[] = [
  { key: "travelers", label: "Travelers" },
  { key: "tripProfiles", label: "Trip profiles" },
  { key: "favoriteProperties", label: "Saved properties" },
  { key: "loyaltyPrograms", label: "Loyalty programs" },
];

export default function PricingPage() {
  const { data, isLoading } = usePlan();
  const change = useChangePlan();
  const { toast } = useToast();

  const handleSelect = async (planId: "free" | "pro") => {
    if (data?.plan === planId) return;
    try {
      await change.mutateAsync(planId);
      toast({
        title: planId === "pro" ? "Welcome to Pro" : "Switched to Free",
        description: planId === "pro" ? "All limits removed." : "Plan updated.",
      });
    } catch {
      toast({ title: "Couldn't update plan", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: "920px" }}>
        <span className="eyebrow" style={{ display: "block", marginBottom: "12px" }}>Membership</span>
        <h1 className="font-playfair" style={{ fontSize: "44px", lineHeight: 1.1, color: "#1C1C1C", margin: 0 }}>
          Choose your plan
        </h1>
        <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "16px", color: "#5C5248", marginTop: "16px", maxWidth: "560px" }}>
          Start free. Upgrade to Pro any time for unlimited travelers, profiles, and saved stays.
        </p>

        <div className="section-rule" style={{ margin: "40px 0 32px" }} />

        {isLoading || !data ? (
          <p style={{ fontFamily: "'Raleway', sans-serif", color: "#5C5248" }}>Loading…</p>
        ) : data.betaMode ? (
          <>
            <div style={{ textAlign: "center", padding: "48px 24px" }}>
              <p
                className="font-playfair"
                style={{ fontStyle: "italic", fontSize: "22px", color: "#6B2737", margin: 0, lineHeight: 1.4, maxWidth: "640px", marginInline: "auto" }}
              >
                You're on our founding member beta — full Pro access, on us, while we're in testing.
              </p>
              <p
                style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontSize: "15px", color: "#5C5248", marginTop: "20px" }}
              >
                Pricing will be introduced when we launch publicly.
              </p>
            </div>

            <div className="section-rule" style={{ margin: "16px 0 32px" }} />

            <span className="eyebrow" style={{ display: "block", marginBottom: "16px" }}>
              What you'll get
            </span>
            <div
              className="card-editorial"
              style={{ padding: "24px 28px", background: "white", border: "1px solid #E5E0D8" }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(2, minmax(80px, auto))", gap: "0 24px", alignItems: "center" }}>
                <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#A07840" }}></span>
                {data.plans.map((p) => (
                  <span key={p.id} style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#A07840", textAlign: "right" }}>
                    {p.label}
                  </span>
                ))}
                {ROW_DEFS.map(({ key, label }) => (
                  <>
                    <span key={`l-${key}`} style={{ fontFamily: "'Raleway', sans-serif", fontSize: "14px", color: "#5C5248", padding: "12px 0", borderTop: "1px solid #F2EEE6" }}>{label}</span>
                    {data.plans.map((p) => (
                      <span key={`${key}-${p.id}`} style={{ fontFamily: "'Raleway', sans-serif", fontSize: "14px", fontWeight: 500, color: "#1C1C1C", textAlign: "right", padding: "12px 0", borderTop: "1px solid #F2EEE6" }}>
                        {formatLimit(p.limits[key])}
                      </span>
                    ))}
                  </>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "24px",
              }}
            >
              {data.plans.map((plan) => {
                const isCurrent = data.plan === plan.id;
                const isPro = plan.id === "pro";
                return (
                  <div
                    key={plan.id}
                    className="card-editorial"
                    style={{
                      padding: "32px 28px",
                      background: "white",
                      border: isCurrent ? "1px solid #6B2737" : "1px solid #E5E0D8",
                      position: "relative",
                    }}
                  >
                    {isCurrent && (
                      <span
                        style={{
                          position: "absolute", top: "16px", right: "16px",
                          fontFamily: "'Raleway', sans-serif", fontWeight: 600,
                          fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase",
                          color: "#6B2737",
                        }}
                      >
                        Current
                      </span>
                    )}
                    <span
                      style={{
                        fontFamily: "'Raleway', sans-serif", fontWeight: 600,
                        fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase",
                        color: "#A07840", display: "block", marginBottom: "10px",
                      }}
                    >
                      {plan.label}
                    </span>
                    <div className="font-playfair" style={{ fontSize: "32px", color: "#1C1C1C", marginBottom: "20px" }}>
                      {plan.priceLabel}
                    </div>

                    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px" }}>
                      {ROW_DEFS.map(({ key, label }) => (
                        <li
                          key={key}
                          style={{
                            display: "flex", justifyContent: "space-between",
                            padding: "10px 0", borderBottom: "1px solid #F2EEE6",
                            fontFamily: "'Raleway', sans-serif", fontSize: "14px",
                          }}
                        >
                          <span style={{ fontWeight: 400, color: "#5C5248" }}>{label}</span>
                          <span style={{ fontWeight: 500, color: "#1C1C1C" }}>{formatLimit(plan.limits[key])}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleSelect(plan.id)}
                      disabled={isCurrent || change.isPending}
                      className={isPro ? "btn-wine" : ""}
                      style={{
                        width: "100%",
                        padding: "14px 20px",
                        fontFamily: "'Raleway', sans-serif",
                        fontWeight: 600, fontSize: "11px",
                        letterSpacing: "0.16em", textTransform: "uppercase",
                        background: isPro ? "#6B2737" : "transparent",
                        color: isPro ? "white" : "#1C1C1C",
                        border: isPro ? "none" : "1px solid #1C1C1C",
                        cursor: isCurrent ? "default" : "pointer",
                        opacity: isCurrent ? 0.5 : 1,
                      }}
                    >
                      {isCurrent ? "Current plan" : isPro ? "Upgrade to Pro" : "Switch to Free"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: "48px" }}>
              <span className="eyebrow" style={{ display: "block", marginBottom: "12px" }}>Your usage</span>
              <div
                className="card-editorial"
                style={{ padding: "20px 24px", background: "#F5F0E6", border: "1px solid #E5E0D8" }}
              >
                {ROW_DEFS.map(({ key, label }) => {
                  const used = data.usage[key];
                  const limit = data.limits[key];
                  const limitText = limit < 0 ? "∞" : limit;
                  const atLimit = limit >= 0 && used >= limit;
                  return (
                    <div
                      key={key}
                      style={{
                        display: "flex", justifyContent: "space-between",
                        padding: "8px 0",
                        fontFamily: "'Raleway', sans-serif", fontSize: "14px",
                      }}
                    >
                      <span style={{ color: "#5C5248" }}>{label}</span>
                      <span style={{ fontWeight: 500, color: atLimit ? "#6B2737" : "#1C1C1C" }}>
                        {used} / {limitText}{atLimit ? " — limit reached" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", fontStyle: "italic", color: "#5C5248", marginTop: "16px" }}>
                Payment processing coming soon. Plan changes are applied immediately for now.
              </p>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
