import { Plus } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import type { Theme } from "@/lib/theme";

const SHADOW: Record<Theme, string> = {
  black: "5px 5px 14px rgba(0,0,0,0.85), -3px -3px 8px rgba(255,255,255,0.04)",
  gray:  "4px 4px 12px rgba(0,0,0,0.6),  -3px -3px 8px rgba(255,255,255,0.07)",
  light: "5px 5px 14px #c4c4c6, -5px -5px 14px #ffffff",
  blue:  "5px 5px 14px rgba(0,0,0,0.88), -2px -2px 8px rgba(61,109,208,0.20)",
};

interface AddButtonProps {
  onClick:   () => void;
  disabled?: boolean;
  label?:    string;
}

export function AddButton({ onClick, disabled = false, label = "Add" }: AddButtonProps) {
  const { theme } = useTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-muted-foreground transition-all active:scale-95 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      style={{ boxShadow: SHADOW[theme] }}
    >
      <Plus className="h-5 w-5" />
    </button>
  );
}
