import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Calendar, Megaphone, ScanLine, Sun, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCareCircle } from "@/hooks/useCareCircle";
import { usePatient } from "@/hooks/usePatient";
import { usePreferences } from "@/hooks/usePreferences";
import { can } from "@/lib/permissions";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// CareSync's brand gold — same accent used in section labels and the
// Care Recipient hero. Reused here to mark the active nav destination so
// the current view is obvious at a glance.
const GOLD = "oklch(0.62 0.13 74)";

const NAV = [
  { to: "/",        label: "My Day",   icon: Sun      },
  { to: "/calendar",label: "Calendar", icon: Calendar },
  { to: "/updates", label: "Updates",  icon: Megaphone },
  { to: "/scan",    label: "Scan AVS", icon: ScanLine, requiresScan: true },
  { to: "/settings",label: "Settings", icon: Settings },
] as const;

const MAIN_NAV = NAV.filter((n) => n.to !== "/settings");

export function BottomTabBar() {
  const { user }     = useAuth();
  const { role }     = useCareCircle(user?.id);
  // Track the current route so we can paint the active tab gold inline,
  // rather than relying on the muted-foreground / foreground contrast which
  // is hard to read at 10px on dark themes.
  const { location } = useRouterState();
  const currentPath  = location.pathname;
  // Show while role is loading (null) — only hide once confirmed as viewer
  const canScan      = role === null || can(role, "scan_avs");
  const visibleNav   = NAV.filter((n) => !("requiresScan" in n && n.requiresScan) || canScan);

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around">
        {visibleNav.map(({ to, label, icon: Icon }) => {
          // "/" is exact-match only so it doesn't always look active.
          // Every other route uses prefix match so e.g. "/calendar/2026" still highlights Calendar.
          const isActive = to === "/" ? currentPath === "/" : currentPath.startsWith(to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                activeOptions={{ exact: to === "/" }}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "touch-target flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors",
                  isActive ? "font-semibold" : "text-muted-foreground hover:text-foreground",
                )}
                style={isActive ? { color: GOLD } : undefined}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SideNav() {
  const { profile, signOut }       = useAuth();
  const navigate                   = useNavigate();
  const { careCircleId, role }     = useCareCircle(profile?.id);
  const { patient }                = usePatient(careCircleId);
  const { prefs }                  = usePreferences(profile?.id);
  // Show while role is loading (null) — only hide once confirmed as viewer
  const canScan                    = role === null || can(role, "scan_avs");
  const visibleMain                = MAIN_NAV.filter((n) => !("requiresScan" in n && n.requiresScan) || canScan);
  const initials = profile
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : "…";
  const fullName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : "";

  // Patient strip is shown in "prominent" and "minimal" modes; hidden in "hidden" mode.
  const patientDisplay = prefs.patientDisplay ?? "prominent";
  const showPatientStrip = patient && patientDisplay !== "hidden";
  const patientDisplayName = patient
    ? (patient.preferred_name?.trim() || patient.first_name)
    : "";
  const patientInitials = patient
    ? `${patient.first_name[0] ?? ""}${patient.last_name[0] ?? ""}`.toUpperCase()
    : "";

  return (
    <aside className="hidden border-r border-border bg-card/30 md:flex md:w-60 md:flex-col md:p-4">
      {/* Logo */}
      <div className="mb-4 flex items-center gap-2 px-2">
        <img src="/logo-icon.png" alt="CareSync" className="h-12 w-12 rounded-xl object-cover" style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.25))" }} />
        <span className="text-xl font-semibold tracking-tight">CareSync</span>
      </div>

      {/* Care Recipient strip — quiet ambient reminder of who this circle is for */}
      {showPatientStrip && (
        <Link
          to="/settings"
          className="mb-4 flex items-center gap-2.5 rounded-lg border border-border/60 bg-card/50 px-2.5 py-2 transition-colors hover:bg-accent"
          aria-label={`Caring for ${patientDisplayName} — open Settings`}
        >
          {patient!.avatar_url ? (
            <img
              src={patient!.avatar_url}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-foreground">
              {patientInitials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground/80">Caring for</p>
            <p className="truncate text-sm font-medium text-foreground">{patientDisplayName}</p>
          </div>
        </Link>
      )}

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

      {/* User profile + dropdown menu */}
      <div className="border-t border-border pt-3 mt-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="touch-target mb-1 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-accent">
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
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
