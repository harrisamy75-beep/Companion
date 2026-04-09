import { Link, useLocation } from "wouter";
import { useLogout } from "@/lib/logout-context";

interface LayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/travelers", label: "Travelers" },
  { href: "/stays", label: "Stays" },
  { href: "/preferences", label: "Preferences" },
];

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const logout = useLogout();

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row w-full" style={{ background: "#FAFAF8" }}>

      {/* Mobile Header */}
      <div
        className="md:hidden flex items-center justify-between px-6 py-4 sticky top-0 z-10"
        style={{ background: "#1C1C1C" }}
      >
        <span
          className="font-playfair"
          style={{ fontStyle: "italic", fontWeight: 700, fontSize: "22px", color: "white" }}
        >
          Companion
        </span>
        {logout && (
          <button
            onClick={logout}
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 400,
              fontSize: "11px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.45)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            Switch
          </button>
        )}
      </div>

      {/* Sidebar */}
      <aside
        className="hidden md:flex flex-col fixed h-full z-10"
        style={{ background: "#1C1C1C", width: "220px" }}
      >
        {/* Wordmark */}
        <div style={{ padding: "36px 32px 0" }}>
          <span
            className="font-playfair"
            style={{ fontStyle: "italic", fontWeight: 700, fontSize: "24px", color: "white", display: "block" }}
          >
            Companion
          </span>
          <div style={{ marginTop: "20px", height: "1px", background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "28px 0 0" }}>
          {NAV_ITEMS.map(({ href, label }) => {
            const isActive = location === href;
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "block",
                  padding: "10px 32px",
                  fontFamily: "'Raleway', sans-serif",
                  fontWeight: 500,
                  fontSize: "11px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase" as const,
                  color: isActive ? "white" : "rgba(255,255,255,0.5)",
                  textDecoration: "none",
                  borderLeft: isActive ? "2px solid #6B2737" : "2px solid transparent",
                  paddingLeft: "30px",
                  transition: "color 0.15s, border-color 0.15s",
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer tagline */}
        <div style={{ padding: "0 32px 36px", marginTop: "auto" }}>
          <div style={{ height: "1px", background: "rgba(255,255,255,0.12)", marginBottom: "20px" }} />
          {logout && (
            <button
              onClick={logout}
              style={{
                fontFamily: "'Raleway', sans-serif",
                fontWeight: 300,
                fontStyle: "italic" as const,
                fontSize: "11px",
                color: "rgba(255,255,255,0.35)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "block",
                marginBottom: "12px",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
            >
              switch profile
            </button>
          )}
          <span
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 300,
              fontStyle: "italic" as const,
              fontSize: "11px",
              color: "rgba(255,255,255,0.28)",
              display: "block",
            }}
          >
            crafted for discerning travelers
          </span>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className="flex-1"
        style={{
          marginLeft: 0,
          padding: "48px 56px",
          maxWidth: "900px",
          width: "100%",
          paddingBottom: "80px",
        }}
      >
        <style>{`@media (min-width: 768px) { main { margin-left: 220px; } }`}</style>
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around z-20 border-t"
        style={{ background: "#1C1C1C", borderColor: "rgba(255,255,255,0.10)", padding: "10px 0 14px" }}
      >
        {NAV_ITEMS.map(({ href, label }) => {
          const isActive = location === href;
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                fontFamily: "'Raleway', sans-serif",
                fontWeight: 600,
                fontSize: "9px",
                letterSpacing: "0.14em",
                textTransform: "uppercase" as const,
                textDecoration: "none",
                color: isActive ? "white" : "rgba(255,255,255,0.4)",
                borderBottom: isActive ? "2px solid #6B2737" : "2px solid transparent",
                paddingBottom: "4px",
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
