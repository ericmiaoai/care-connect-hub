import { Plus } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import type { Theme } from "@/lib/theme";

const SHADOW: Record<Theme, string> = {
  black: "6px 6px 16px rgba(0,0,0,0.90), -4px -4px 10px rgba(255,255,255,0.13), inset 0 1px 0 rgba(255,255,255,0.11)",
  gray:  "5px 5px 14px rgba(0,0,0,0.65), -4px -4px 10px rgba(255,255,255,0.16), inset 0 1px 0 rgba(255,255,255,0.13)",
  light: "6px 6px 16px #b4b4b6, -6px -6px 16px #ffffff, inset 0 1px 0 rgba(255,255,255,0.95)",
  blue:  "6px 6px 16px rgba(0,0,0,0.90), -4px -4px 10px rgba(255,255,255,0.13), inset 0 1px 0 rgba(255,255,255,0.09)",
  prototypeLovable: "0 10px 30px -8px rgba(0,0,0,0.75), 0 2px 6px rgba(0,0,0,0.45), -2px -2px 8px rgba(255,255,255,0.10), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 0 0 1px rgba(255,255,255,0.06)",
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
