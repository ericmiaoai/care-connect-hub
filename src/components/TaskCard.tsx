import { Pill, Stethoscope, Car, Activity } from "lucide-react";
import type { UITask, TaskKind } from "@/lib/adapters";
import { cn } from "@/lib/utils";

const ICON: Record<TaskKind, React.ComponentType<{ className?: string }>> = {
  medication:  Pill,
  appointment: Stethoscope,
  transport:   Car,
  vitals:      Activity,
};

// Priority maps to a left-border accent color
const PRIORITY_BORDER: Record<UITask["priority"], string> = {
  critical: "border-l-[var(--destructive)]",
  high:     "border-l-[var(--warning)]",
  medium:   "border-l-[var(--user-nurse)]",
  low:      "border-l-[var(--muted-foreground)]",
};

interface TaskCardProps {
  task:       UITask;
  onComplete: (id: string) => void;
}

export function TaskCard({ task, onComplete }: TaskCardProps) {
  const Icon         = ICON[task.kind];
  const borderClass  = PRIORITY_BORDER[task.priority];

  return (
    <div
      className={cn(
        "flex items-stretch gap-3 rounded-xl border border-border border-l-4 bg-card shadow-sm",
        borderClass,
      )}
    >
      {/* Time column */}
      <div className="flex w-16 flex-col items-center justify-center border-r border-border py-3 text-center">
        <span className="text-sm font-semibold tabular-nums">{task.time}</span>
      </div>

      {/* Content */}
      <div className="flex flex-1 items-center gap-3 py-3 pr-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
          {task.detail && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.detail}</p>
          )}
        </div>
      </div>

      {/* Complete button */}
      <button
        type="button"
        aria-label={`Complete ${task.title}`}
        onClick={() => onComplete(task.id)}
        className="touch-target group flex items-center justify-center pr-3"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-border-strong transition-colors group-hover:border-[var(--success)] group-active:bg-[var(--success)]/20" />
      </button>
    </div>
  );
}
