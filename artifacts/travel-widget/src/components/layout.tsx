import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useLogout } from "@/lib/logout-context";
import { useState, useRef, useEffect } from "react";

interface LayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_W = 260;

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/travelers", label: "Travelers" },
  { href: "/stays", label: "Stays" },
  { href: "/preferences", label: "Preferences" },
  { href: "/pricing", label: "Pricing" },
  { href: "/settings", label: "Settings" },
];

function getInitials(user: { firstName?: string | null; lastName?: string | null; primaryEmailAddress?: { emailAddress: string } | null } | null | undefined): string {
  if (!user) return "·";
  const f = user.firstName?.charAt(0) ?? "";
  const l = user.lastName?.charAt(0) ?? "";
  const initials = (f + l).toUpperCase();
  if (initials) return initials;
  const e = user.primaryEmailAddress?.emailAddress;
  return e ? e.charAt(0).toUpperCase() : "·";
}

function AccountMenu({ inverted }: { inverted?: boolean }) {
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const fallbackLogout = useLogout();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const initials = getInitials(user);
  const display =
    user?.firstName ??
    user?.fullName ??
    user?.primaryEmailAddress?.emailAddress ??
    "Account";

  const labelColor = inverted ? "rgba(255,255,255,0.55)" : "#5C5248";
  const labelHover = inverted ? "rgba(255,255,255,0.85)" : "#1C1C1C";
  const avatarBg = inverted ? "#6B2737" : "#1C1C1C";

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: labelColor,
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = labelHover)}
        onMouseLeave={(e) => (e.currentTarget.style.color = labelColor)}
        title={display}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: avatarBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 12,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initials
          )}
        </div>
        <span
          style={{
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 500,
            fontSize: 12,
            letterSpacing: "0.06em",
            maxWidth: 140,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "left",
          }}
        >
          Account
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            background: "white",
            border: "1px solid #E5E0D8",
            borderRadius: 6,
            minWidth: 200,
            boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
            zIndex: 30,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid #E5E0D8",
              fontFamily: "'Raleway', sans-serif",
              fontSize: 12,
              color: "#5C5248",
            }}
          >
            <div style={{ color: "#1C1C1C", fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
              {display}
            </div>
            {user?.primaryEmailAddress?.emailAddress && (
              <div style={{ fontSize: 11, color: "#8C8279" }}>
                {user.primaryEmailAddress.emailAddress}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setOpen(false);
              openUserProfile();
            }}
            className="account-menu-item"
            style={menuItemStyle}
          >
            Manage account
          </button>
          <button
            onClick={() => {
              setOpen(false);
              fallbackLogout?.();
            }}
            className="account-menu-item"
            style={{ ...menuItemStyle, color: "#6B2737" }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "none",
  border: "none",
  padding: "10px 14px",
  fontFamily: "'Raleway', sans-serif",
  fontSize: 12,
  color: "#1C1C1C",
  cursor: "pointer",
};

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

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
        <AccountMenu inverted />
      </div>

      {/* Sidebar — fixed, 260px wide */}
      <aside
        className="hidden md:flex flex-col fixed top-0 left-0 h-full z-10"
        style={{ background: "#1C1C1C", width: `${SIDEBAR_W}px` }}
      >
        {/* Wordmark */}
        <div style={{ padding: "36px 36px 0" }}>
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
                  padding: "11px 36px",
                  fontFamily: "'Raleway', sans-serif",
                  fontWeight: 500,
                  fontSize: "11px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase" as const,
                  color: isActive ? "white" : "rgba(255,255,255,0.5)",
                  textDecoration: "none",
                  borderLeft: isActive ? "2px solid #6B2737" : "2px solid transparent",
                  paddingLeft: isActive ? "34px" : "36px",
                  transition: "color 0.15s, border-color 0.15s",
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "0 36px 36px", marginTop: "auto" }}>
          <div style={{ height: "1px", background: "rgba(255,255,255,0.12)", marginBottom: "20px" }} />
          <div style={{ marginBottom: "16px" }}>
            <AccountMenu inverted />
          </div>
          <span
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 400,
              fontStyle: "italic" as const,
              fontSize: "11px",
              color: "rgba(255,255,255,0.28)",
              display: "block",
            }}
          >
            crafted for discerning travelers
          </span>
          <div style={{ marginTop: "10px" }}>
            <Link
              href="/privacy"
              style={{
                fontFamily: "'Raleway', sans-serif",
                fontWeight: 300,
                fontSize: "10px",
                color: "rgba(255,255,255,0.3)",
                textDecoration: "none",
              }}
            >
              Privacy
            </Link>
            <span
              style={{
                color: "rgba(255,255,255,0.2)",
                fontFamily: "'Raleway', sans-serif",
                fontSize: "10px",
                margin: "0 6px",
              }}
            >
              ·
            </span>
            <Link
              href="/terms"
              style={{
                fontFamily: "'Raleway', sans-serif",
                fontWeight: 300,
                fontSize: "10px",
                color: "rgba(255,255,255,0.3)",
                textDecoration: "none",
              }}
            >
              Terms
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content — offset by exact sidebar width on md+ */}
      <main
        style={{
          flex: 1,
          marginLeft: 0,
          paddingTop: "48px",
          paddingBottom: "80px",
          paddingLeft: "48px",
          paddingRight: "56px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <style>{`
          @media (min-width: 768px) {
            main { margin-left: ${SIDEBAR_W}px !important; max-width: calc(100% - ${SIDEBAR_W}px); }
          }
          @media (max-width: 767px) {
            main { padding-left: 20px !important; padding-right: 20px !important; padding-top: 24px !important; }
          }
        `}</style>
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
