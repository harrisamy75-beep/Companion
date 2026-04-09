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
      <div className="md:hidden flex items-center justify-between p-4 bg-card border-b sticky top-0 z-10">
        <div className="flex items-center gap-2 text-primary">
          <Plane className="w-6 h-6" />
          <span className="font-semibold text-lg tracking-tight">Companion</span>
        </div>
        {logout && (
          <button
            onClick={logout}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-card border-r fixed h-full z-10">
        <div className="p-6 flex items-center gap-3 text-primary">
          <Plane className="w-8 h-8" />
          <span className="font-semibold text-xl tracking-tight">Companion</span>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {logout && (
          <div className="px-4 pb-6 border-t pt-4">
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              Switch profile
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 lg:p-12 max-w-5xl mx-auto w-full pb-24 md:pb-12">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t flex justify-around p-2 pb-safe z-20">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full py-2 gap-1 rounded-lg",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
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
