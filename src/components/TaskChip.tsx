import { Pill, Stethoscope, Car, Activity, Circle, CheckCircle2 } from "lucide-react";
import type { UITask, TaskKind } from "@/lib/adapters";
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

interface TaskChipProps {
  task:     UITask;
  compact?: boolean;
}

export function TaskChip({ task, compact }: TaskChipProps) {
  const Icon        = ICON[task.kind];
  const isCompleted = task.status === "completed";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-dashed border-border px-1.5 py-1 text-[11px] transition-opacity",
        compact ? "" : "text-xs",
        isCompleted && "opacity-50",
      )}
    >
      {isCompleted ? (
        <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
      ) : (
        <Circle className="h-3 w-3 shrink-0 text-muted-foreground" />
      )}
      <Icon className={cn("h-3 w-3 shrink-0", KIND_COLOR[task.kind])} />
      <span className="flex-1 truncate text-foreground/90">{task.title}</span>
    </div>
  );
}
