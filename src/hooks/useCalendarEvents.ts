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
  addEvent:       (title: string, startISO: string, endISO: string, createdBy: string, location?: string, description?: string) => Promise<{ error: string | null }>;
  updateEvent:    (id: string, title: string, startISO: string, endISO: string, location?: string, description?: string) => Promise<{ error: string | null }>;
  deleteEvent:    (id: string) => Promise<void>;
}

export function useCalendarEvents(
  careCircleId:  string | null | undefined,
  rangeStartISO: string,
  rangeEndISO:   string,
): UseCalendarEventsReturn {
  const [events,    setEvents]    = useState<UICalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const fetchEvents = useCallback(async (silent = false) => {
    if (!careCircleId) {
      setEvents([]);
      setIsLoading(false);
      return;
    }

    if (!silent) setIsLoading(true);
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
      setEvents((data as DBCalendarEventWithCompleter[] ?? []).map(adaptCalendarEvent));
    }

    setIsLoading(false);
  }, [careCircleId, rangeStartISO, rangeEndISO]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (!careCircleId) return;
    const channel = supabase
      .channel(`cal_events_rt_${careCircleId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events", filter: `care_circle_id=eq.${careCircleId}` }, () => { fetchEvents(true); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [careCircleId, fetchEvents]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchEvents(true);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchEvents]);

  const markComplete = useCallback(
    async (eventId: string, userId: string, displayName: string) => {
      const completedAt = new Date().toISOString();
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
      if (sbError) { setError(sbError.message); await fetchEvents(true); }
    },
    [fetchEvents],
  );

  const unmarkComplete = useCallback(async (eventId: string) => {
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
    if (sbError) { setError(sbError.message); await fetchEvents(true); }
  }, [fetchEvents]);

  const addEvent = useCallback(async (
    title: string,
    startISO: string,
    endISO: string,
    createdBy: string,
    location?: string,
    description?: string,
  ): Promise<{ error: string | null }> => {
    if (!careCircleId) return { error: "No care circle" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sbError } = await (supabase.from("calendar_events") as any).insert({
      care_circle_id: careCircleId,
      title,
      start_time: startISO,
      end_time: endISO,
      created_by: createdBy,
      location: location || null,
      description: description || null,
    });
    if (!sbError) await fetchEvents(true);
    return { error: sbError?.message ?? null };
  }, [careCircleId, fetchEvents]);

  const updateEvent = useCallback(async (
    id: string,
    title: string,
    startISO: string,
    endISO: string,
    location?: string,
    description?: string,
  ): Promise<{ error: string | null }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sbError } = await (supabase.from("calendar_events") as any)
      .update({ title, start_time: startISO, end_time: endISO, location: location || null, description: description || null })
      .eq("id", id);
    if (!sbError) await fetchEvents(true);
    return { error: sbError?.message ?? null };
  }, [fetchEvents]);

  const deleteEvent = useCallback(async (id: string): Promise<void> => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sbError } = await (supabase.from("calendar_events") as any).delete().eq("id", id);
    if (sbError) { setError(sbError.message); await fetchEvents(true); }
  }, [fetchEvents]);

  return { events, isLoading, error, markComplete, unmarkComplete, addEvent, updateEvent, deleteEvent };
}
