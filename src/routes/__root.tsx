import { Outlet, Link, createRootRoute, HeadContent, Scripts, useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "sonner";
import { useEffect } from "react";
import { WifiOff } from "lucide-react";
import { BottomTabBar, SideNav } from "@/components/AppNav";
import { useAuth } from "@/hooks/useAuth";
import { useCareCircle } from "@/hooks/useCareCircle";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useNewMemberAlert } from "@/hooks/useNewMemberAlert";
import { applyTheme, getStoredTheme } from "@/lib/theme";

import appCss from "../styles.css?url";

// Routes that bypass the auth guard (no login required)
const PUBLIC_ROUTES = ["/login", "/register", "/join"];
// Routes that require auth but NOT a care circle yet
const SHELL_FREE_ROUTES = ["/login", "/register", "/onboarding", "/join"];

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0a0a0b" },
      { title: "CareSync — Coordinated Care, Simplified" },
      {
        name: "description",
        content:
          "CareSync helps families and caregivers coordinate medications, appointments, and updates in one calm, focused place.",
      },
      { property: "og:title", content: "CareSync" },
      { property: "og:description", content: "Coordinated care for the people you love." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/logo-icon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/logo-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AppHeader() {
  const { profile, signOut } = useAuth();
  const initials = profile
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : "…";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:hidden">
      <div className="flex items-center gap-2">
        <img src="/logo-icon.png" alt="CareSync" className="h-7 w-7 rounded-lg object-cover" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.2))" }} />
        <span className="text-base font-semibold tracking-tight">CareSync</span>
      </div>
      <button
        id="header-user-menu"
        onClick={signOut}
        title="Sign out"
        className="h-7 w-7 overflow-hidden rounded-full ring-2 ring-background transition-opacity hover:opacity-80"
      >
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt="Profile"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-accent text-xs font-semibold text-foreground">
            {initials}
          </span>
        )}
      </button>
    </header>
  );
}

function Disclaimer() {
  return (
    <p className="px-4 py-3 text-center text-[11px] leading-relaxed text-muted-foreground/80">
      CareSync is an administrative organizational tool, not a substitute for professional medical
      advice.
    </p>
  );
}

function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  return (
    <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-400">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You're offline — changes are paused until connectivity is restored.</span>
    </div>
  );
}

function RootComponent() {
  // Apply persisted theme as early as possible on client mount
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  const { user, isLoading: authLoading } = useAuth();
  const { careCircleId, role, isLoading: circleLoading } = useCareCircle(user?.id);
  useNewMemberAlert(careCircleId, role);
  const navigate    = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const isPublicRoute   = PUBLIC_ROUTES.includes(currentPath);
  const isShellFree     = SHELL_FREE_ROUTES.includes(currentPath);
  const isLoading       = authLoading || (!isPublicRoute && !!user && circleLoading);

  useEffect(() => {
    if (isLoading) return;

    // Guard 1: Must be authenticated to see any non-public route
    if (!user && !isPublicRoute) {
      navigate({ to: "/login" });
      return;
    }

    // Guard 2: Must have a care circle to see any non-onboarding route
    if (user && !careCircleId && !isShellFree) {
      navigate({ to: "/onboarding" });
      return;
    }

    // Guard 3: Prevent already-setup users from seeing onboarding
    if (user && careCircleId && currentPath === "/onboarding") {
      navigate({ to: "/" });
    }
  }, [user, careCircleId, isLoading, isPublicRoute, isShellFree, currentPath, navigate]);

  // Show spinner while resolving auth + care circle state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
      </div>
    );
  }

  // Shell-free routes: login, register, onboarding — no nav, no sidebar
  if (isShellFree) {
    return (
      <>
        <Outlet />
        <Toaster theme="dark" position="bottom-center" offset={16} />
      </>
    );
  }

  // Full authenticated app shell
  return (
    <div data-app-shell className="flex min-h-screen bg-background text-foreground md:h-screen md:overflow-hidden">
      <SideNav />
      {/* Right column: on desktop, constrained to screen height so only this pane scrolls */}
      <div className="flex flex-1 flex-col md:min-h-0">
        <AppHeader />
        <OfflineBanner />
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentPath}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: "easeInOut" }}
            >
              <main className="pb-24 md:pb-12">
                <Outlet />
              </main>
              <footer className="border-t border-border">
                <Disclaimer />
              </footer>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <BottomTabBar />
      <Toaster
        theme="dark"
        position="bottom-center"
        offset={80}
        toastOptions={{
          classNames: {
            toast:
              "!bg-card !border-border !text-foreground !rounded-xl !shadow-lg",
            actionButton: "!bg-foreground !text-background !rounded-md !px-3 !py-1.5",
          },
        }}
      />
    </div>
  );
}
