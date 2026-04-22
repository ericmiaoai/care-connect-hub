import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check, RotateCcw } from "lucide-react";
import { EventChip } from "@/components/EventChip";
import { useAuth } from "@/hooks/useAuth";
import { useCareCircle } from "@/hooks/useCareCircle";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import type { UICalendarEvent } from "@/lib/adapters";
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
      { name: "description", content: "Shared, color-coded calendar of care events." },
    ],
  }),
  component: CalendarView,
});

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  date.setDate(date.getDate() - date.getDay());
  date.setHours(0, 0, 0, 0);
  return date;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtCompletedAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

function CalendarView() {
  const { user, profile } = useAuth();
  const { careCircleId }  = useCareCircle(user?.id);

  const today    = useMemo(() => new Date(), []);
  const todayKey = fmtDate(today);

  const [view, setView]                 = useState<"week" | "month">("week");
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [selected, setSelected]         = useState<string | null>(null);

  function navigate(dir: -1 | 1) {
    setReferenceDate((d) => {
      const next = new Date(d);
      if (view === "week") {
        next.setDate(next.getDate() + dir * 7);
      } else {
        next.setMonth(next.getMonth() + dir);
      }
      return next;
    });
  }

  const { days, rangeStartISO, rangeEndISO } = useMemo(() => {
    let dates: Date[];

    if (view === "week") {
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
      days:         dates,
      rangeStartISO: dates[0].toISOString(),
      rangeEndISO:   end.toISOString(),
    };
  }, [view, referenceDate]);

  const periodLabel = useMemo(() => {
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
  }, [view, days, referenceDate]);

  const { events, isLoading, markComplete, unmarkComplete } =
    useCalendarEvents(careCircleId, rangeStartISO, rangeEndISO);

  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : "Unknown";

  const eventsByDate = useMemo(() => {
    const m: Record<string, UICalendarEvent[]> = {};
    for (const e of events) {
      (m[e.date] ||= []).push(e);
    }
    return m;
  }, [events]);

  const selectedEvents = selected ? (eventsByDate[selected] ?? []) : [];

  const isCurrentPeriod = useMemo(() => {
    if (view === "week") return days.some((d) => fmtDate(d) === todayKey);
    return (
      referenceDate.getFullYear() === today.getFullYear() &&
      referenceDate.getMonth()    === today.getMonth()
    );
  }, [view, days, referenceDate, todayKey, today]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between gap-4">
        {/* Period label + navigation */}
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
            <span className="min-w-[160px] text-center text-xl font-semibold tracking-tight">
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
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "touch-target rounded-md px-4 text-sm capitalize transition-colors",
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

      {/* Loading skeleton */}
      {isLoading && (
        <div className="h-64 animate-pulse rounded-xl bg-card" />
      )}

      {/* Calendar grid */}
      {!isLoading && (
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
            const dayEvents = eventsByDate[key] ?? [];
            const isToday   = key === todayKey;
            const inMonth   = d.getMonth() === referenceDate.getMonth();
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
                <div className="flex flex-col gap-1">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <EventChip key={ev.id} event={ev} compact />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="px-1 text-[10px] text-muted-foreground">
                      +{dayEvents.length - 3} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Day detail sheet */}
      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="bg-card">
          <SheetHeader>
            <SheetTitle>
              {selected &&
                new Date(selected + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "long",
                  month:   "long",
                  day:     "numeric",
                })}
            </SheetTitle>
            <SheetDescription>
              {selectedEvents.length === 0
                ? "Nothing scheduled."
                : `${selectedEvents.length} event${selectedEvents.length === 1 ? "" : "s"}`}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 flex flex-col gap-4">
            {selectedEvents.map((ev) => (
              <div key={ev.id} className="flex gap-3">
                <span className="mt-1 w-12 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                  {ev.time}
                </span>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <EventChip event={ev} />
                    </div>
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
        </SheetContent>
      </Sheet>
    </div>
  );
}
