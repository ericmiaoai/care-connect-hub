import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEMES, type Theme } from "@/lib/theme";
import { useTheme } from "@/hooks/useTheme";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CareSync" },
      { name: "description", content: "Customize your CareSync experience." },
    ],
  }),
  component: SettingsPage,
});

// ── Theme swatch preview gradients ───────────────────────────────────────────
const SWATCH_STYLE: Record<Theme, React.CSSProperties> = {
  black: {
    background: "#0a0a0b",
  },
  gray: {
    background:
      "radial-gradient(ellipse at 22% 20%, #3a3d47 0%, #22242c 50%, #111318 100%)",
  },
  light: {
    background: "#f5f5f6",
  },
  blue: {
    background:
      "linear-gradient(175deg, #3d6dd0 0%, #1e3a9e 45%, #0d1462 100%)",
  },
};

function ThemeSwatch({ id, label }: { id: Theme; label: string }) {
  const { theme, setTheme } = useTheme();
  const isActive = theme === id;
  const isLight  = id === "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(id)}
      className={cn(
        "group flex flex-col items-center gap-2 rounded-xl p-2 transition-colors",
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive && "bg-accent",
      )}
    >
      {/* Preview card */}
      <div
        className={cn(
          "relative h-20 w-full max-w-[88px] overflow-hidden rounded-lg border-2 transition-colors",
          isActive ? "border-primary" : "border-border",
        )}
        style={SWATCH_STYLE[id]}
      >
        {/* Mini UI chrome lines */}
        <div className="absolute inset-x-3 top-3 flex flex-col gap-1.5">
          <div
            className="h-1.5 w-3/4 rounded-full opacity-30"
            style={{ background: isLight ? "#000" : "#fff" }}
          />
          <div
            className="h-1 w-1/2 rounded-full opacity-20"
            style={{ background: isLight ? "#000" : "#fff" }}
          />
          <div
            className="mt-1 h-6 w-full rounded opacity-15"
            style={{ background: isLight ? "#000" : "#fff" }}
          />
          <div
            className="h-4 w-full rounded opacity-10"
            style={{ background: isLight ? "#000" : "#fff" }}
          />
        </div>

        {/* Active checkmark */}
        {isActive && (
          <div className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow-sm">
            <Check
              className="h-3 w-3"
              style={{ color: isLight ? "#fff" : "#0a0a0b" }}
            />
          </div>
        )}
      </div>

      {/* Label */}
      <span
        className={cn(
          "text-xs font-medium",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </button>
  );
}

function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Preferences
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      {/* Appearance tab — single section for now */}
      <div className="mb-2 border-b border-border">
        <button
          type="button"
          className="border-b-2 border-foreground pb-2 text-sm font-medium text-foreground"
        >
          Appearance
        </button>
      </div>

      <section className="py-5">
        <p className="mb-1 text-sm font-medium text-foreground">Theme</p>
        <p className="mb-4 text-xs text-muted-foreground">
          Choose a background style for CareSync.
        </p>

        <div className="grid grid-cols-4 gap-2">
          {THEMES.map(({ id, label }) => (
            <ThemeSwatch key={id} id={id} label={label} />
          ))}
        </div>
      </section>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground/60">
        Your preference is saved to this device.
      </p>
    </div>
  );
}
