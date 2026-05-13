/**
 * TimeInput — custom replacement for <input type="time">
 *
 * Drop-in replacement that solves three problems with the native input:
 *   1. Partial input no longer silently becomes NULL.
 *      Type "11" and leave minutes blank → on blur, defaults to "11:00".
 *   2. Consistent rendering across Chrome / Safari / Firefox.
 *   3. Numeric keypad on mobile (via inputMode="numeric").
 *
 * API matches <input type="time">:
 *   value:    "HH:MM" in 24-hour format, or "" for unset
 *   onChange: (value: string) => void — receives the same format
 *
 * Internally renders 12-hour HH:MM with an AM/PM toggle. Values are
 * clamped to valid ranges (hour 1–12, minute 0–59) on blur.
 */

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TimeInputProps {
  value:      string;
  onChange:   (value: string) => void;
  disabled?:  boolean;
  className?: string;
  id?:        string;
}

type Period = "AM" | "PM";

// ── Helpers ────────────────────────────────────────────────────────────────

function parse24(value: string): { hourStr: string; minStr: string; period: Period } {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) {
    return { hourStr: "", minStr: "", period: "AM" };
  }
  const [h, m] = value.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) {
    return { hourStr: "", minStr: "", period: "AM" };
  }
  const period: Period = h >= 12 ? "PM" : "AM";
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return {
    hourStr: String(hour12),
    minStr:  String(m).padStart(2, "0"),
    period,
  };
}

function format24(hourStr: string, minStr: string, period: Period): string {
  if (!hourStr) return "";
  const hRaw = parseInt(hourStr, 10);
  if (isNaN(hRaw) || hRaw < 1 || hRaw > 12) return "";

  // If minute is empty, default to 0 — this is the key fix
  const mRaw = minStr ? parseInt(minStr, 10) : 0;
  const m    = isNaN(mRaw) ? 0 : Math.max(0, Math.min(59, mRaw));

  // 12-hour → 24-hour conversion
  let h = hRaw;
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── Component ─────────────────────────────────────────────────────────────

export function TimeInput({ value, onChange, disabled, className, id }: TimeInputProps) {
  const initial = parse24(value);
  const [hourStr, setHourStr] = useState(initial.hourStr);
  const [minStr,  setMinStr]  = useState(initial.minStr);
  const [period,  setPeriod]  = useState<Period>(initial.period);

  // Sync from outside when the prop changes (e.g. when opening edit form)
  useEffect(() => {
    const p = parse24(value);
    setHourStr(p.hourStr);
    setMinStr(p.minStr);
    setPeriod(p.period);
  }, [value]);

  function emit(h: string, m: string, p: Period) {
    onChange(format24(h, m, p));
  }

  // ── Hour field ─────────────────────────────────────────────────────────
  function handleHourChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
    setHourStr(v);
    if (v) emit(v, minStr, period);
    else   onChange("");
  }

  function handleHourBlur() {
    let v = hourStr;
    if (v) {
      const num = parseInt(v, 10);
      if (isNaN(num) || num < 1) v = "";
      else if (num > 12)         v = "12";
      else                       v = String(num);
    }
    if (v !== hourStr) setHourStr(v);

    // ── The fix: hour filled but minute empty → default minute to "00" ──
    if (v && !minStr) {
      setMinStr("00");
      emit(v, "00", period);
    } else if (v) {
      emit(v, minStr, period);
    }
  }

  // ── Minute field ───────────────────────────────────────────────────────
  function handleMinChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
    setMinStr(v);
    if (hourStr) emit(hourStr, v, period);
  }

  function handleMinBlur() {
    let v = minStr;
    if (v) {
      const num = parseInt(v, 10);
      if (isNaN(num) || num < 0) v = "00";
      else if (num > 59)         v = "59";
      else                       v = String(num).padStart(2, "0");
    } else if (hourStr) {
      // Hour is filled but minute is empty → default to 00
      v = "00";
    }
    if (v !== minStr) setMinStr(v);
    if (hourStr) emit(hourStr, v, period);
  }

  // ── AM / PM toggle ─────────────────────────────────────────────────────
  function togglePeriod() {
    if (disabled) return;
    const next: Period = period === "AM" ? "PM" : "AM";
    setPeriod(next);
    if (hourStr) emit(hourStr, minStr, next);
  }

  const innerInput = "w-7 bg-transparent text-center outline-none tabular-nums disabled:cursor-not-allowed";

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-within:outline-none focus-within:ring-2 focus-within:ring-ring",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={hourStr}
        onChange={handleHourChange}
        onBlur={handleHourBlur}
        placeholder="HH"
        maxLength={2}
        disabled={disabled}
        className={innerInput}
        id={id}
        aria-label="Hour"
      />
      <span className="text-muted-foreground">:</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={minStr}
        onChange={handleMinChange}
        onBlur={handleMinBlur}
        placeholder="MM"
        maxLength={2}
        disabled={disabled}
        className={innerInput}
        aria-label="Minute"
      />
      <button
        type="button"
        onClick={togglePeriod}
        disabled={disabled}
        className="ml-1.5 rounded px-2 py-0.5 text-xs font-semibold uppercase text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
        aria-label={`Switch to ${period === "AM" ? "PM" : "AM"}`}
      >
        {period}
      </button>
    </div>
  );
}
