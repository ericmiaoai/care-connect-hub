/**
 * useCalendarEvents.ts
 * ====================
 * Fetches calendar events for the current user's Care Circle within a date range.
 * rangeStartISO / rangeEndISO are ISO strings bounding the displayed calendar grid.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  adaptCalendarEvent,
  type UICalendarEvent,
  type DBCalendarEventWithCompleter,
} from "@/lib/adapters";

interface UseCalendarEventsReturn {
  events:         UICalendarEvent[];
  isLoading:      boolean;
  error:          string | null;
  markComplete:   (eventId: string, userId: string, displayName: string) => Promise<void>;
  unmarkComplete: (eventId: string) => Promise<void>;
}

export function useCalendarEvents(
  careCircleId:  string | null | undefined,
  rangeStartISO: string,
  rangeEndISO:   string,
): UseCalendarEventsReturn {
  const [events,    setEvents]    = useState<UICalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!careCircleId) {
      setEvents([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data, error: sbError } = await supabase
      .from("calendar_events")
      .select("*, completer:completed_by(first_name, last_name)")
      .eq("care_circle_id", careCircleId)
      .gte("start_time", rangeStartISO)
      .lte("start_time", rangeEndISO)
      .order("start_time", { ascending: true });

    if (sbError) {
      setError(sbError.message);
      setEvents([]);
    } else {
      setEvents(
        (data as DBCalendarEventWithCompleter[] ?? []).map(adaptCalendarEvent),
      );
    }

    setIsLoading(false);
  }, [careCircleId, rangeStartISO, rangeEndISO]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const markComplete = useCallback(
    async (eventId: string, userId: string, displayName: string) => {
      const completedAt = new Date().toISOString();

      // Optimistic update
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? { ...e, isCompleted: true, completedByName: displayName, completedAt }
            : e,
        ),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: sbError } = await (supabase.from("calendar_events") as any)
        .update({ completed_by: userId, completed_at: completedAt })
        .eq("id", eventId);

      if (sbError) {
        setError(sbError.message);
        await fetchEvents(); // rollback
      }
    },
    [fetchEvents],
  );

  const unmarkComplete = useCallback(
    async (eventId: string) => {
      // Optimistic update
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? { ...e, isCompleted: false, completedByName: null, completedAt: null }
            : e,
        ),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: sbError } = await (supabase.from("calendar_events") as any)
        .update({ completed_by: null, completed_at: null })
        .eq("id", eventId);

      if (sbError) {
        setError(sbError.message);
        await fetchEvents(); // rollback
      }
    },
    [fetchEvents],
  );

  return { events, isLoading, error, markComplete, unmarkComplete };
}
