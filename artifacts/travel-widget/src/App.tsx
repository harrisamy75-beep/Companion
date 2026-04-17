import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import TravelersPage from "@/pages/travelers";
import PreferencesPage from "@/pages/preferences";
import StaysPage from "@/pages/stays";
import PricingPage from "@/pages/pricing";
import { OnboardingWizard } from "@/components/onboarding";
import { useState, useEffect, useCallback } from "react";
import { LogoutContext } from "@/lib/logout-context";

const queryClient = new QueryClient();

type AuthState =
  | { status: "loading" }
  | { status: "needs-name" }
  | { status: "ready"; userId: string };

function useSessionUser() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [showOnboarding, setShowOnboarding] = useState(false);

  const needsOnboarding = () =>
    localStorage.getItem("onboardingComplete") !== "true";

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await res.json();
      if (!data.userId || data.userId === "default-user") {
        setAuth({ status: "needs-name" });
      } else {
        setAuth({ status: "ready", userId: data.userId });
        setShowOnboarding(needsOnboarding());
      }
    } catch {
      setAuth({ status: "needs-name" });
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  const login = useCallback(async (name: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: name }),
    });
    if (res.ok) {
      setAuth({ status: "ready", userId: name });
      setShowOnboarding(needsOnboarding());
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setAuth({ status: "needs-name" });
    setShowOnboarding(false);
    queryClient.clear();
  }, []);

  const completeOnboarding = useCallback(() => {
    localStorage.setItem("onboardingComplete", "true");
    setShowOnboarding(false);
  }, []);

  return { auth, login, logout, showOnboarding, completeOnboarding };
}

function NamePrompt({ onSubmit }: { onSubmit: (name: string) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setBusy(true);
    await onSubmit(trimmed);
    setBusy(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#F5F0E6" }}
    >
      <div className="flex flex-col items-center text-center" style={{ width: 340 }}>
        {/* Hero wordmark */}
        <h1
          className="font-playfair"
          style={{
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: "56px",
            lineHeight: 1.05,
            color: "#1C1C1C",
            letterSpacing: "-0.01em",
          }}
        >
          Companion
        </h1>

        {/* Three-line value prop */}
        <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "18px", alignItems: "center" }}>
          {[
            "Save your family's ages, preferences & loyalty numbers.",
            "Auto-fill every travel booking form in one click.",
            "See only the reviews that match your travel style.",
          ].map((line) => (
            <p
              key={line}
              className="font-playfair"
              style={{
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: "17px",
                color: "#5C5248",
                lineHeight: 1,
                margin: 0,
                padding: 0,
                whiteSpace: "nowrap",
              }}
            >
              {line}
            </p>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ marginTop: "48px", width: "100%" }}>
          <label
            className="eyebrow"
            style={{ display: "block", textAlign: "left", marginBottom: "6px" }}
          >
            Your name
          </label>
          <input
            autoFocus
            type="text"
            placeholder="e.g. Sarah"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="input-underline"
            style={{ textAlign: "center", fontSize: "16px" }}
          />
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="btn-wine"
            style={{ width: "100%", height: "48px", marginTop: "28px" }}
          >
            {busy ? "Setting up…" : "Get started"}
          </button>
          <p
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 400,
              fontSize: "11px",
              color: "#5C5248",
              textAlign: "center",
              marginTop: "16px",
              letterSpacing: "0.03em",
            }}
          >
            No account needed · Your data stays private
          </p>
        </form>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/travelers" component={TravelersPage} />
      <Route path="/stays" component={StaysPage} />
      <Route path="/preferences" component={PreferencesPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { auth, login, logout, showOnboarding, completeOnboarding } = useSessionUser();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* Loading */}
        {auth.status === "loading" && (
          <div
            className="min-h-screen flex items-center justify-center"
            style={{ background: "#F5F0E6" }}
          >
            <p className="font-playfair" style={{ fontStyle: "italic", fontSize: "20px", color: "#5C5248" }}>
              Loading…
            </p>
          </div>
        )}

        {/* Login */}
        {auth.status === "needs-name" && <NamePrompt onSubmit={login} />}

        {/* Onboarding wizard */}
        {auth.status === "ready" && showOnboarding && (
          <LogoutContext.Provider value={logout}>
            <OnboardingWizard userId={auth.userId} onComplete={completeOnboarding} />
          </LogoutContext.Provider>
        )}

        {/* Main app */}
        {auth.status === "ready" && !showOnboarding && (
          <LogoutContext.Provider value={logout}>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRoutes />
            </WouterRouter>
          </LogoutContext.Provider>
        )}

        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
