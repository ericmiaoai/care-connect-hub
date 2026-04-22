import { Pill, Stethoscope, Car, Activity, CheckCircle2 } from "lucide-react";
import type { UICalendarEvent, TaskKind } from "@/lib/adapters";
import { cn } from "@/lib/utils";

const ICON: Record<TaskKind, React.ComponentType<{ className?: string }>> = {
  medication:  Pill,
  appointment: Stethoscope,
  transport:   Car,
  vitals:      Activity,
};

const KIND_COLOR: Record<TaskKind, string> = {
  medication:  "text-[var(--user-nurse)]",
  appointment: "text-[var(--user-sister)]",
  transport:   "text-[var(--user-dad)]",
  vitals:      "text-[var(--user-admin)]",
};

interface EventChipProps {
  event:    UICalendarEvent;
  compact?: boolean;
}

export function EventChip({ event, compact }: EventChipProps) {
  const Icon = ICON[event.kind];
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-border bg-card-elevated px-1.5 py-1 text-[11px] transition-opacity",
        compact ? "" : "text-xs",
        event.isCompleted && "opacity-50",
      )}
    >
      <Icon className={cn("h-3 w-3 shrink-0", KIND_COLOR[event.kind])} />
      <span className="flex-1 truncate text-foreground/90">{event.title}</span>
      {event.isCompleted && (
        <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
      )}
    </div>
  );
}
