import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import TravelersPage from "@/pages/travelers";
import PreferencesPage from "@/pages/preferences";
import { Plane } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { LogoutContext } from "@/lib/logout-context";

const queryClient = new QueryClient();

type AuthState =
  | { status: "loading" }
  | { status: "needs-name" }
  | { status: "ready"; userId: string };

function useSessionUser() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await res.json();
      if (!data.userId || data.userId === "default-user") {
        setAuth({ status: "needs-name" });
      } else {
        setAuth({ status: "ready", userId: data.userId });
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
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setAuth({ status: "needs-name" });
    queryClient.clear();
  }, []);

  return { auth, login, logout };
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-3 text-primary">
          <Plane className="w-9 h-9" />
          <span className="text-2xl font-semibold tracking-tight">Travel Companion</span>
        </div>
        <p className="text-muted-foreground text-sm">
          Save your family's travel details, auto-fill booking forms, and get AI-powered review matching.
        </p>
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <label className="text-left text-sm font-medium text-foreground">
            Your name
            <span className="block text-xs text-muted-foreground font-normal mt-0.5">
              Used to keep your profile separate from others on this device.
            </span>
          </label>
          <input
            autoFocus
            type="text"
            placeholder="e.g. Sarah"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-base"
          />
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-base hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {busy ? "Setting up…" : "Get started"}
          </button>
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
      <Route path="/preferences" component={PreferencesPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { auth, login, logout } = useSessionUser();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {auth.status === "loading" && (
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <Plane className="w-10 h-10 text-primary animate-pulse" />
              <p className="text-sm">Loading…</p>
            </div>
          </div>
        )}
        {auth.status === "needs-name" && <NamePrompt onSubmit={login} />}
        {auth.status === "ready" && (
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
