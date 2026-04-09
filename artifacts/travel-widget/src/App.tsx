import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import TravelersPage from "@/pages/travelers";
import PreferencesPage from "@/pages/preferences";
import { useAuth } from "@workspace/replit-auth-web";
import { Plane } from "lucide-react";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/travelers" component={TravelersPage} />
      <Route path="/preferences" component={PreferencesPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, login } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Plane className="w-10 h-10 text-primary animate-pulse" />
          <p className="text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 text-center px-4">
          <div className="flex items-center gap-3 text-primary">
            <Plane className="w-10 h-10" />
            <span className="text-3xl font-semibold tracking-tight">Travel Companion</span>
          </div>
          <p className="text-muted-foreground max-w-sm">
            Save your family's travel details, auto-fill booking forms, and get AI-powered review matching.
          </p>
          <button
            onClick={login}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-lg hover:bg-primary/90 transition-colors shadow-md"
          >
            Log in to get started
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthGate>
            <Router />
          </AuthGate>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
