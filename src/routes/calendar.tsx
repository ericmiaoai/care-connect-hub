import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight,
  Check, RotateCcw,
  Square, CheckSquare2,
  MapPin, CheckCircle2,
  Pill, Stethoscope, Car, Activity,
} from "lucide-react";
import { EventChip } from "@/components/EventChip";
import { TaskChip } from "@/components/TaskChip";
import { useAuth } from "@/hooks/useAuth";
import { useCareCircle } from "@/hooks/useCareCircle";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import type { UICalendarEvent, UITask, TaskKind } from "@/lib/adapters";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — CareSync" },
      { name: "description", content: "Shared appointments and daily tasks for the care circle." },
    ],
  }),
  component: CalendarView,
});

// ── Shared lookup maps ────────────────────────────────────────────────────────

const KIND_ICON: Record<TaskKind, React.ComponentType<{ className?: string }>> = {
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

const PRIORITY_BORDER: Record<UITask["priority"], string> = {
  critical: "border-l-[var(--destructive)]",
  high:     "border-l-[var(--warning)]",
  medium:   "border-l-[var(--user-nurse)]",
  low:      "border-l-[var(--muted-foreground)]",
};

const PRIORITY_LABEL: Record<UITask["priority"], string> = {
  critical: "Critical",
  high:     "High",
  medium:   "Medium",
  low:      "Low",
};

const PRIORITY_TEXT: Record<UITask["priority"], string> = {
  critical: "text-destructive",
  high:     "text-[var(--warning)]",
  medium:   "text-[var(--user-nurse)]",
  low:      "text-muted-foreground",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  date.setDate(date.getDate() - date.getDay());
  date.setHours(0, 0, 0, 0);
  return date;
}

function fmtDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function fmtCompletedAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ── Day-view card: Appointment ─────────────────────────────────────────────

interface AppointmentCardProps {
  event:        UICalendarEvent;
  onComplete:   () => void;
  onUnmark:     () => void;
}

function AppointmentCard({ event: ev, onComplete, onUnmark }: AppointmentCardProps) {
  const Icon = KIND_ICON[ev.kind];
  return (
    <div className={cn(
      "rounded-xl border border-border bg-card overflow-hidden transition-opacity",
      ev.isCompleted && "opacity-60",
    )}>
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
          <Icon className={cn("h-5 w-5", KIND_COLOR[ev.kind])} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs tabular-nums text-muted-foreground">{ev.time}</p>
              <p className="mt-0.5 truncate font-medium text-foreground">{ev.title}</p>
            </div>
            {ev.isCompleted ? (
              <button
                onClick={onUnmark}
                title="Mark as not done"
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={onComplete}
                title="Mark as complete"
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-emerald-400"
              >
                <Check className="h-4 w-4" />
              </button>
            )}
          </div>
          {ev.location && (
            <p className="mt-1.5 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {ev.location}
            </p>
          )}
          {ev.description && (
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/70">{ev.description}</p>
          )}
          {ev.isCompleted && ev.completedByName && (
            <p className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              Completed by {ev.completedByName}
              {ev.completedAt ? ` · ${fmtCompletedAt(ev.completedAt)}` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Day-view card: Task ───────────────────────────────────────────────────────

interface TaskDayCardProps {
  task:     UITask;
  onToggle: () => void;
}

function TaskDayCard({ task: t, onToggle }: TaskDayCardProps) {
  const Icon        = KIND_ICON[t.kind];
  const isCompleted = t.status === "completed";
  return (
    <div className={cn(
      "rounded-xl border border-border border-l-4 bg-card overflow-hidden transition-opacity",
      PRIORITY_BORDER[t.priority],
      isCompleted && "opacity-60",
    )}>
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
          <Icon className={cn("h-5 w-5", KIND_COLOR[t.kind])} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs tabular-nums text-muted-foreground">{t.time}</p>
              <p className="mt-0.5 truncate font-medium text-foreground">{t.title}</p>
            </div>
            <button
              onClick={onToggle}
              title={isCompleted ? "Mark as pending" : "Mark as complete"}
              className={cn(
                "shrink-0 rounded-md p-1.5 transition-colors hover:bg-accent",
                isCompleted
                  ? "text-emerald-400 hover:text-muted-foreground"
                  : "text-muted-foreground hover:text-emerald-400",
              )}
            >
              {isCompleted
                ? <CheckSquare2 className="h-4 w-4" />
                : <Square className="h-4 w-4" />
              }
            </button>
          </div>
          {t.detail && (
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/70">{t.detail}</p>
          )}
          <p className={cn("mt-2 text-xs font-medium", PRIORITY_TEXT[t.priority])}>
            {PRIORITY_LABEL[t.priority]} priority
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

function CalendarView() {
  const { user, profile } = useAuth();
  const { careCircleId }  = useCareCircle(user?.id);

  const today    = useMemo(() => new Date(), []);
  const todayKey = fmtDate(today);

  const [view, setView]                   = useState<"day" | "week" | "month">("day");
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [selected, setSelected]           = useState<string | null>(null);

  function navigate(dir: -1 | 1) {
    setReferenceDate((d) => {
      const next = new Date(d);
      if (view === "day") {
        next.setDate(next.getDate() + dir);
      } else if (view === "week") {
        next.setDate(next.getDate() + dir * 7);
      } else {
        next.setMonth(next.getMonth() + dir);
      }
      return next;
    });
  }

  const { days, rangeStartISO, rangeEndISO } = useMemo(() => {
    let dates: Date[];

    if (view === "day") {
      const d = new Date(referenceDate);
      d.setHours(0, 0, 0, 0);
      dates = [d];
    } else if (view === "week") {
      const start = startOfWeek(referenceDate);
      dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      });
    } else {
      const first = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
      const start = startOfWeek(first);
      dates = Array.from({ length: 35 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      });
    }

    const end = new Date(dates[dates.length - 1]);
    end.setHours(23, 59, 59, 999);

    return {
      days:          dates,
      rangeStartISO: dates[0].toISOString(),
      rangeEndISO:   end.toISOString(),
    };
  }, [view, referenceDate]);

  const periodLabel = useMemo(() => {
    if (view === "day") {
      const isToday = fmtDate(referenceDate) === todayKey;
      return isToday
        ? `Today, ${referenceDate.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`
        : referenceDate.toLocaleDateString(undefined, {
            weekday: "long", month: "long", day: "numeric", year: "numeric",
          });
    }
    if (view === "week") {
      const start = days[0];
      const end   = days[6];
      if (start.getMonth() === end.getMonth()) {
        return (
          start.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
          `–${end.getDate()}, ${end.getFullYear()}`
        );
      }
      return (
        start.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
        " – " +
        end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      );
    }
    return referenceDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [view, days, referenceDate, todayKey]);

  const { events, isLoading: eventsLoading, markComplete, unmarkComplete } =
    useCalendarEvents(careCircleId, rangeStartISO, rangeEndISO);

  const { tasks, isLoading: tasksLoading, toggleTask } =
    useCalendarTasks(careCircleId, rangeStartISO, rangeEndISO);

  const isLoading = eventsLoading || tasksLoading;

  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : "Unknown";

  const eventsByDate = useMemo(() => {
    const m: Record<string, UICalendarEvent[]> = {};
    for (const e of events) (m[e.date] ||= []).push(e);
    return m;
  }, [events]);

  const tasksByDate = useMemo(() => {
    const m: Record<string, UITask[]> = {};
    for (const t of tasks) {
      if (t.rawDueDate) {
        const key = fmtDate(new Date(t.rawDueDate));
        (m[key] ||= []).push(t);
      }
    }
    return m;
  }, [tasks]);

  const isCurrentPeriod = useMemo(() => {
    if (view === "day")   return fmtDate(referenceDate) === todayKey;
    if (view === "week")  return days.some((d) => fmtDate(d) === todayKey);
    return (
      referenceDate.getFullYear() === today.getFullYear() &&
      referenceDate.getMonth()    === today.getMonth()
    );
  }, [view, days, referenceDate, todayKey, today]);

  const selectedEvents = selected ? (eventsByDate[selected] ?? []) : [];
  const selectedTasks  = selected ? (tasksByDate[selected]  ?? []) : [];

  // For day view — data is already scoped to the single reference date
  const dayKey    = fmtDate(referenceDate);
  const dayEvents = view === "day" ? (eventsByDate[dayKey] ?? []) : [];
  const dayTasks  = view === "day" ? (tasksByDate[dayKey]  ?? []) : [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">

      {/* ── Header ── */}
      <header className="mb-5 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Calendar
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(-1)}
              aria-label="Previous"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-card-elevated hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[200px] text-center text-xl font-semibold tracking-tight">
              {periodLabel}
            </span>
            <button
              onClick={() => navigate(1)}
              aria-label="Next"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-card-elevated hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {!isCurrentPeriod && (
              <button
                onClick={() => setReferenceDate(new Date())}
                className="ml-1 rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {/* View toggle */}
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          {(["day", "week", "month"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "touch-target rounded-md px-3 text-sm capitalize transition-colors",
                view === v
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="h-64 animate-pulse rounded-xl bg-card" />
      )}

      {/* ══════════════════════════════════════════════════════════════
          DAY VIEW
      ══════════════════════════════════════════════════════════════ */}
      {!isLoading && view === "day" && (
        <div className="flex flex-col gap-8">

          {/* Appointments */}
          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Appointments
            </p>
            {dayEvents.length === 0 ? (
              <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                No appointments scheduled.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {dayEvents.map((ev) => (
                  <AppointmentCard
                    key={ev.id}
                    event={ev}
                    onComplete={() => user && markComplete(ev.id, user.id, displayName)}
                    onUnmark={() => unmarkComplete(ev.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Tasks */}
          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tasks
            </p>
            {dayTasks.length === 0 ? (
              <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                No tasks scheduled.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {dayTasks.map((t) => (
                  <TaskDayCard
                    key={t.id}
                    task={t}
                    onToggle={() => toggleTask(t.id, t.status)}
                  />
                ))}
              </div>
            )}
          </section>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          WEEK / MONTH GRID VIEW
      ══════════════════════════════════════════════════════════════ */}
      {!isLoading && view !== "day" && (
        <>
          {/* Legend */}
          <div className="mb-3 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-card-elevated ring-1 ring-border" />
              Appointments
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-border" />
              Tasks
            </span>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="bg-card-elevated px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
              >
                {d}
              </div>
            ))}
            {days.map((d) => {
              const key       = fmtDate(d);
              const dayEvts   = eventsByDate[key] ?? [];
              const dayTsks   = tasksByDate[key]  ?? [];
              const isToday   = key === todayKey;
              const inMonth   = d.getMonth() === referenceDate.getMonth();

              const shownEvents = dayEvts.slice(0, 2);
              const taskSlots   = Math.max(0, 3 - shownEvents.length);
              const shownTasks  = dayTsks.slice(0, taskSlots);
              const overflow    =
                (dayEvts.length - shownEvents.length) +
                (dayTsks.length  - shownTasks.length);

              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={cn(
                    "flex min-h-[96px] flex-col gap-1 bg-card p-1.5 text-left transition-colors hover:bg-card-elevated",
                    !inMonth && view === "month" && "opacity-40",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums",
                      isToday
                        ? "bg-foreground text-background font-semibold"
                        : "text-muted-foreground",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {shownEvents.map((ev) => (
                      <EventChip key={ev.id} event={ev} compact />
                    ))}
                    {shownTasks.map((t) => (
                      <TaskChip key={t.id} task={t} compact />
                    ))}
                    {overflow > 0 && (
                      <span className="px-1 text-[10px] text-muted-foreground">
                        +{overflow} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════
          DAY DETAIL SHEET (week / month tap)
      ══════════════════════════════════════════════════════════════ */}
      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="bg-card">
          <SheetHeader>
            <SheetTitle>
              {selected &&
                new Date(selected + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "long", month: "long", day: "numeric",
                })}
            </SheetTitle>
            <SheetDescription>
              {selectedEvents.length === 0 && selectedTasks.length === 0
                ? "Nothing scheduled."
                : [
                    selectedEvents.length > 0 &&
                      `${selectedEvents.length} appointment${selectedEvents.length === 1 ? "" : "s"}`,
                    selectedTasks.length > 0 &&
                      `${selectedTasks.length} task${selectedTasks.length === 1 ? "" : "s"}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 flex flex-col gap-6">

            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Appointments
              </p>
              {selectedEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">None scheduled.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {selectedEvents.map((ev) => (
                    <div key={ev.id} className="flex gap-3">
                      <span className="mt-1 w-12 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                        {ev.time}
                      </span>
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1"><EventChip event={ev} /></div>
                          {ev.isCompleted ? (
                            <button
                              onClick={() => unmarkComplete(ev.id)}
                              title="Mark as not done"
                              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-card-elevated hover:text-foreground"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => user && markComplete(ev.id, user.id, displayName)}
                              title="Mark as complete"
                              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-card-elevated hover:text-emerald-400"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {ev.isCompleted && ev.completedByName && (
                          <p className="pl-1 text-[11px] text-emerald-400">
                            Completed by {ev.completedByName}
                            {ev.completedAt ? ` · ${fmtCompletedAt(ev.completedAt)}` : ""}
                          </p>
                        )}
                        {ev.location && (
                          <p className="pl-1 text-[11px] text-muted-foreground">{ev.location}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tasks
              </p>
              {selectedTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">None scheduled.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {selectedTasks.map((t) => (
                    <div key={t.id} className="flex gap-3">
                      <span className="mt-1 w-12 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                        {t.time}
                      </span>
                      <div className="flex flex-1 items-center gap-2">
                        <div className="flex-1"><TaskChip task={t} /></div>
                        <button
                          onClick={() => toggleTask(t.id, t.status)}
                          title={t.status === "completed" ? "Mark as pending" : "Mark as complete"}
                          className={cn(
                            "rounded-md p-1 transition-colors hover:bg-card-elevated",
                            t.status === "completed"
                              ? "text-emerald-400 hover:text-muted-foreground"
                              : "text-muted-foreground hover:text-emerald-400",
                          )}
                        >
                          {t.status === "completed"
                            ? <CheckSquare2 className="h-3.5 w-3.5" />
                            : <Square className="h-3.5 w-3.5" />
                          }
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
