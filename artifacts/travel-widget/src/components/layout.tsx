import { Link, useLocation } from "wouter";
import { Plane, Users, Home, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogout } from "@/lib/logout-context";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const logout = useLogout();

  const navItems = [
    { href: "/", icon: Home, label: "Dashboard" },
    { href: "/travelers", icon: Users, label: "Travelers" },
    { href: "/preferences", icon: Settings, label: "Preferences" },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row w-full bg-background">
      {/* Mobile Header */}
      <div
        className="md:hidden flex items-center justify-between p-4 sticky top-0 z-10"
        style={{ background: "#1B3A5C" }}
      >
        <div className="flex items-center gap-2.5">
          <Plane className="w-5 h-5" style={{ color: "#C9972B" }} />
          <span className="font-playfair text-lg font-semibold text-white tracking-wide">
            Companion
          </span>
        </div>
        {logout && (
          <button
            onClick={logout}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Sidebar */}
      <aside
        className="hidden md:flex w-64 flex-col fixed h-full z-10"
        style={{ background: "#1B3A5C" }}
      >
        {/* Logo */}
        <div className="px-7 py-7 flex items-center gap-3">
          <Plane className="w-7 h-7 shrink-0" style={{ color: "#C9972B" }} />
          <span className="font-playfair text-xl font-semibold text-white tracking-wide">
            Companion
          </span>
        </div>

        {/* Divider */}
        <div className="mx-6 mb-4 h-px" style={{ background: "rgba(255,255,255,0.10)" }} />

        {/* Nav */}
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 relative",
                  isActive
                    ? "text-white"
                    : "text-white/60 hover:text-white hover:bg-white/8"
                )}
                style={isActive ? {
                  background: "rgba(255,255,255,0.10)",
                  borderLeft: "3px solid #C9972B",
                  paddingLeft: "13px",
                } : {}}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {logout && (
          <div className="px-4 pb-8 mt-auto">
            <div className="h-px mx-2 mb-4" style={{ background: "rgba(255,255,255,0.10)" }} />
            <button
              onClick={logout}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/8 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Switch profile
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-5 md:p-10 max-w-5xl mx-auto w-full pb-24 md:pb-12">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around p-2 pb-safe z-20 border-t"
        style={{ background: "#1B3A5C", borderColor: "rgba(255,255,255,0.12)" }}
      >
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center w-full py-2 gap-1 rounded-lg transition-colors"
              style={{ color: isActive ? "#C9972B" : "rgba(255,255,255,0.55)" }}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
