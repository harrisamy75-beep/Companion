import { useEffect, useRef } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  Show,
  useAuth,
  useUser,
  useClerk,
} from "@clerk/react";
import {
  Switch,
  Route,
  Redirect,
  useLocation,
  Router as WouterRouter,
} from "wouter";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import TravelersPage from "@/pages/travelers";
import PreferencesPage from "@/pages/preferences";
import StaysPage from "@/pages/stays";
import PricingPage from "@/pages/pricing";
import SettingsPage from "@/pages/settings";
import SettingsExtensionPage from "@/pages/settings-extension";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";
import { OnboardingWizard } from "@/components/onboarding";
import { useState, useCallback } from "react";
import { LogoutContext } from "@/lib/logout-context";
import { setApiTokenGetter } from "@/lib/api";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL as
  | string
  | undefined;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#6B2737",
    colorBackground: "#F5F0E6",
    colorInputBackground: "#FAFAF8",
    colorText: "#1C1C1C",
    colorTextSecondary: "#5C5248",
    colorInputText: "#1C1C1C",
    colorNeutral: "#1C1C1C",
    borderRadius: "6px",
    fontFamily: "'Raleway', sans-serif",
    fontFamilyButtons: "'Raleway', sans-serif",
    fontSize: "14px",
  },
  elements: {
    rootBox: "w-full",
    cardBox:
      "border border-[#E5E0D8] shadow-[0_2px_24px_rgba(28,28,28,0.06)] rounded-2xl w-full overflow-hidden bg-[#FAFAF8]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer:
      "!shadow-none !border-0 !bg-transparent !rounded-none border-t border-[#E5E0D8]",
    headerTitle: "font-playfair italic",
    headerSubtitle: "",
    socialButtonsBlockButtonText: "",
    formFieldLabel: "",
    footerActionLink: "underline",
    footerActionText: "",
    dividerText: "",
    identityPreviewEditButton: "",
    formFieldSuccessText: "",
    alertText: "",
    logoBox: "flex justify-center pt-2 pb-4",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton:
      "border border-[#E5E0D8] hover:bg-[#F5F0E6] rounded-md",
    formButtonPrimary:
      "bg-[#6B2737] hover:bg-[#56202D] rounded-md uppercase tracking-[0.14em] text-[11px] font-semibold py-3",
    formFieldInput:
      "border border-[#E5E0D8] rounded-md bg-[#FAFAF8] focus:border-[#6B2737]",
    footerAction: "py-4",
    dividerLine: "bg-[#E5E0D8]",
    alert: "border border-[#E5E0D8] rounded-md",
    otpCodeFieldInput: "border border-[#E5E0D8] rounded-md",
    formFieldRow: "",
    main: "",
  },
};

const textStyles: Record<string, React.CSSProperties> = {
  headerTitle: { color: "#1C1C1C" },
  headerSubtitle: { color: "#5C5248" },
  footerActionText: { color: "#5C5248" },
  footerActionLink: { color: "#6B2737" },
  dividerText: { color: "#8C8279" },
  formFieldLabel: { color: "#1C1C1C" },
  socialButtonsBlockButtonText: { color: "#1C1C1C" },
  formFieldInput: { color: "#1C1C1C" },
  alertText: { color: "#6B2737" },
  formFieldSuccessText: { color: "#1C7A52" },
  identityPreviewText: { color: "#1C1C1C" },
  identityPreviewEditButton: { color: "#6B2737" },
};

const localizedAppearance = {
  ...clerkAppearance,
  elements: Object.fromEntries(
    Object.entries(clerkAppearance.elements).map(([k, v]) => {
      const style = textStyles[k];
      if (style) {
        return [k, { className: v, style }];
      }
      return [k, v];
    }),
  ),
};

function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center px-4"
      style={{ background: "#F5F0E6" }}
    >
      <div style={{ width: 400, maxWidth: "100%" }}>
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
        />
        <div
          style={{
            marginTop: "24px",
            textAlign: "center",
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 300,
            fontSize: "10px",
            color: "rgba(28,28,28,0.4)",
          }}
        >
          © 2026 Companion Travel. All rights reserved.
        </div>
      </div>
    </div>
  );
}

function SignUpPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center px-4"
      style={{ background: "#F5F0E6" }}
    >
      <div style={{ width: 400, maxWidth: "100%" }}>
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
        />
        <div
          style={{
            marginTop: "24px",
            textAlign: "center",
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 300,
            fontSize: "10px",
            color: "rgba(28,28,28,0.4)",
          }}
        >
          © 2026 Companion Travel. All rights reserved.
        </div>
      </div>
    </div>
  );
}

function LandingHero() {
  const [, setLocation] = useLocation();
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#F5F0E6" }}
    >
      <div
        className="flex flex-col items-center text-center"
        style={{ width: 600, maxWidth: "100%" }}
      >
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

        <div
          style={{
            marginTop: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            alignItems: "center",
            maxWidth: "520px",
            width: "100%",
          }}
        >
          {[
            <>Save your family's ages &amp; preferences.</>,
            <>Auto-fill every travel booking form in one click.</>,
            <>See only the reviews that match your travel style.</>,
          ].map((line, i) => (
            <p
              key={i}
              className="font-playfair"
              style={{
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: "17px",
                color: "#5C5248",
                lineHeight: 1.2,
                margin: 0,
                padding: 0,
              }}
            >
              {line}
            </p>
          ))}
        </div>

        <div style={{ marginTop: "48px", width: "100%" }}>
          <button
            onClick={() => setLocation("/sign-up")}
            className="btn-wine"
            style={{ width: "100%", height: "48px" }}
          >
            Get started
          </button>
          <button
            onClick={() => setLocation("/sign-in")}
            style={{
              marginTop: "16px",
              width: "100%",
              height: "44px",
              background: "transparent",
              border: "none",
              fontFamily: "'Raleway', sans-serif",
              fontSize: "12px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#5C5248",
              cursor: "pointer",
            }}
          >
            Already have an account? Sign in
          </button>
        </div>

        <div
          style={{
            marginTop: "32px",
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 300,
            fontSize: "11px",
            color: "#8C8279",
            textAlign: "center",
          }}
        >
          <a
            href={`${basePath}/privacy`}
            style={{ color: "#8C8279", textDecoration: "none" }}
          >
            Privacy Policy
          </a>
          <span style={{ margin: "0 8px" }}>·</span>
          <a
            href={`${basePath}/terms`}
            style={{ color: "#8C8279", textDecoration: "none" }}
          >
            Terms of Service
          </a>
        </div>
      </div>
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingHero />
      </Show>
    </>
  );
}

function ProtectedShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function onboardingKey(userId: string | null | undefined) {
  return userId ? `onboardingComplete:${userId}` : "onboardingComplete";
}

function AuthenticatedApp() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  const userId = user?.id;
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkedOnboarding, setCheckedOnboarding] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const done = localStorage.getItem(onboardingKey(userId)) === "true";
    setShowOnboarding(!done);
    setCheckedOnboarding(true);
  }, [userId]);

  const completeOnboarding = useCallback(() => {
    if (userId) {
      localStorage.setItem(onboardingKey(userId), "true");
    }
    setShowOnboarding(false);
  }, [userId]);

  const logout = useCallback(async () => {
    await signOut();
    queryClient.clear();
    setLocation("/");
  }, [signOut, setLocation]);

  if (!userId || !checkedOnboarding) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#F5F0E6" }}
      >
        <p
          className="font-playfair"
          style={{ fontStyle: "italic", fontSize: "20px", color: "#5C5248" }}
        >
          Loading…
        </p>
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <LogoutContext.Provider value={logout}>
        <OnboardingWizard userId={userId} onComplete={completeOnboarding} />
      </LogoutContext.Provider>
    );
  }

  return (
    <LogoutContext.Provider value={logout}>
      <Switch>
        <Route path="/dashboard" component={Home} />
        <Route path="/travelers" component={TravelersPage} />
        <Route path="/stays" component={StaysPage} />
        <Route path="/preferences" component={PreferencesPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/settings/extension" component={SettingsExtensionPage} />
        <Route component={NotFound} />
      </Switch>
    </LogoutContext.Provider>
  );
}

// Bridges Clerk's getToken into the apiFetch helper so all API calls
// automatically include the bearer token.
function ClerkTokenBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    const fn = () => getToken();
    setApiTokenGetter(fn);
    setAuthTokenGetter(fn);
    return () => {
      setApiTokenGetter(null);
      setAuthTokenGetter(null);
    };
  }, [getToken]);
  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }: { user: { id: string } | null | undefined }) => {
      const id = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== id
      ) {
        qc.clear();
      }
      prevUserIdRef.current = id;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey!}
      proxyUrl={clerkProxyUrl}
      appearance={localizedAppearance as any}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your Companion account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Save your family's travel profile in seconds",
          },
        },
      }}
      routerPush={(to: string) => setLocation(stripBase(to))}
      routerReplace={(to: string) =>
        setLocation(stripBase(to), { replace: true })
      }
    >
      <QueryClientProvider client={queryClient}>
        <ClerkTokenBridge />
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/privacy" component={PrivacyPage} />
            <Route path="/terms" component={TermsPage} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route>
              <ProtectedShell>
                <AuthenticatedApp />
              </ProtectedShell>
            </Route>
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
