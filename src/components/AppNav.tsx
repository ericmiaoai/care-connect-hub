import { Link } from "@tanstack/react-router";
import { Calendar, Megaphone, ScanLine, Sun, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCareCircle } from "@/hooks/useCareCircle";
import { can } from "@/lib/permissions";

const NAV = [
  { to: "/",        label: "My Day",   icon: Sun      },
  { to: "/calendar",label: "Calendar", icon: Calendar },
  { to: "/updates", label: "Updates",  icon: Megaphone },
  { to: "/scan",    label: "Scan AVS", icon: ScanLine, requiresScan: true },
  { to: "/settings",label: "Settings", icon: Settings },
] as const;

const MAIN_NAV = NAV.filter((n) => n.to !== "/settings");

export function BottomTabBar() {
  const { user }   = useAuth();
  const { role }   = useCareCircle(user?.id);
  // Show while role is loading (null) — only hide once confirmed as viewer
  const canScan    = role === null || can(role, "scan_avs");
  const visibleNav = NAV.filter((n) => !("requiresScan" in n && n.requiresScan) || canScan);

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around">
        {visibleNav.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="touch-target flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] text-muted-foreground transition-colors data-[status=active]:text-foreground"
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SideNav() {
  const { profile, signOut } = useAuth();
  const { role }             = useCareCircle(profile?.id);
  // Show while role is loading (null) — only hide once confirmed as viewer
  const canScan              = role === null || can(role, "scan_avs");
  const visibleMain          = MAIN_NAV.filter((n) => !("requiresScan" in n && n.requiresScan) || canScan);
  const initials = profile
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : "…";
  const fullName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : "";

  return (
    <aside className="hidden border-r border-border bg-card/30 md:flex md:w-60 md:flex-col md:p-4">
      {/* Logo */}
      <div className="mb-4 flex items-center gap-2 px-2">
        <img src="/logo-icon.png" alt="CareSync" className="h-12 w-12 rounded-xl object-cover" style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.25))" }} />
        <span className="text-xl font-semibold tracking-tight">CareSync</span>
      </div>

      {/* Navigation links */}
      <nav aria-label="Primary">
        <ul className="flex flex-col gap-0.5">
          {visibleMain.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact: to === "/" }}
                className={cn(
                  "touch-target flex items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors",
                  "hover:bg-accent hover:text-foreground",
                  "data-[status=active]:bg-accent data-[status=active]:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings — sits just above the separator line */}
      <Link
        to="/settings"
        activeOptions={{ exact: true }}
        className={cn(
          "touch-target flex items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors",
          "hover:bg-accent hover:text-foreground",
          "data-[status=active]:bg-accent data-[status=active]:text-foreground",
        )}
      >
        <Settings className="h-4 w-4" />
        <span>Settings</span>
      </Link>

      {/* User profile + Sign out */}
      <div className="border-t border-border pt-3 mt-2">
        <div className="mb-1 flex items-center gap-2.5 rounded-lg px-2 py-2">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={fullName}
              className="h-7 w-7 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-foreground">
              {initials}
            </div>
          )}
          <span className="truncate text-xs text-muted-foreground">{fullName}</span>
        </div>
        <button
          id="sidenav-sign-out"
          onClick={signOut}
          className="touch-target flex w-full items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
