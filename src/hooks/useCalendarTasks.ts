import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { adaptTask, type UITask, type DBTaskWithAssignee } from "@/lib/adapters";
import { setChannelStatus } from "@/lib/realtimeSyncStore";

interface UseCalendarTasksReturn {
  tasks:                       UITask[];
  completedUnscheduledTasks:   UITask[];
  isLoading:                   boolean;
  error:                       string | null;
  toggleTask:                  (id: string, currentStatus: UITask["status"]) => Promise<void>;
  restoreUnscheduledTask:      (id: string) => Promise<void>;
  addCalendarTask:             (title: string, dueDate: string | null, priority: UITask["priority"], createdBy: string, assignedTo?: string | null, notes?: string | null) => Promise<{ error: string | null }>;
  updateCalendarTask:          (id: string, title: string, dueDate: string | null, priority: UITask["priority"], assignedTo?: string | null, notes?: string | null) => Promise<{ error: string | null }>;
  deleteCalendarTask:          (id: string) => Promise<void>;
  reorderTasks:                (orderedIds: string[]) => Promise<void>;
}

export function useCalendarTasks(
  careCircleId:  string | null | undefined,
  rangeStartISO: string,
  rangeEndISO:   string,
): UseCalendarTasksReturn {
  const [tasks,                     setTasks]                     = useState<UITask[]>([]);
  const [completedUnscheduledTasks, setCompletedUnscheduledTasks] = useState<UITask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const fetchTasks = useCallback(async (silent = false) => {
    if (!careCircleId) {
      setTasks([]);
      setCompletedUnscheduledTasks([]);
      setIsLoading(false);
      return;
    }

    if (!silent) setIsLoading(true);
    setError(null);

    // ── Timezone-safe range ──────────────────────────────────────────────────
    // due_date is TIMESTAMPTZ. Comparing against a date-only string (e.g.
    // ".lte('due_date', '2026-05-13')") makes Postgres read it as midnight UTC
    // of that date, which excludes any timed task later that same day. Always
    // pass full ISO timestamps. We also widen by one day on each side so that
    // untimed tasks (stored at UTC midnight regardless of the user's local TZ)
    // are caught even when their UTC instant falls just outside the local day
    // window; calendar.tsx then groups by localDateKey for precise display.
    const widenStart = new Date(rangeStartISO); widenStart.setUTCDate(widenStart.getUTCDate() - 1);
    const widenEnd   = new Date(rangeEndISO);   widenEnd.setUTCDate(widenEnd.getUTCDate() + 1);
    const startTs = widenStart.toISOString();
    const endTs   = widenEnd.toISOString();

    // Three parallel queries:
    // 1. Dated tasks in the visible range
    // 2. Active unscheduled tasks (due_date IS NULL, not completed)
    // 3. Completed unscheduled tasks (for the "Show Completed" toggle)
    const [
      { data: rangedData,              error: rangedError              },
      { data: unscheduledData,         error: unscheduledError         },
      { data: completedUnscheduledData                                 },
    ] = await Promise.all([
      supabase.from("tasks").select("*, assignee:assigned_to(first_name, last_name, avatar_url)")
        .eq("care_circle_id", careCircleId)
        .gte("due_date", startTs)
        .lte("due_date", endTs)
        .order("due_date", { ascending: true }),
      supabase.from("tasks").select("*, assignee:assigned_to(first_name, last_name, avatar_url)")
        .eq("care_circle_id", careCircleId)
        .is("due_date", null)
        .in("status", ["pending", "in_progress"])
        .order("sort_order", { ascending: true, nullsFirst: false }),
      supabase.from("tasks").select("*, assignee:assigned_to(first_name, last_name, avatar_url)")
        .eq("care_circle_id", careCircleId)
        .eq("status", "completed")
        .is("due_date", null)
        .order("completed_at", { ascending: false })
        .limit(50),
    ]);

    const err = rangedError ?? unscheduledError;
    if (err) {
      setError(err.message);
      setTasks([]);
    } else {
      setTasks([...(rangedData ?? []), ...(unscheduledData ?? [])].map((r) => adaptTask(r as DBTaskWithAssignee)));
    }

    setCompletedUnscheduledTasks((completedUnscheduledData ?? []).map((r) => adaptTask(r as DBTaskWithAssignee)));

    setIsLoading(false);
  }, [careCircleId, rangeStartISO, rangeEndISO]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!careCircleId) return;
    const channelKey = `cal_tasks_rt_${careCircleId}`;
    const channel = supabase
      .channel(channelKey)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `care_circle_id=eq.${careCircleId}` }, () => { fetchTasks(true); })
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          setChannelStatus(channelKey, true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setChannelStatus(channelKey, false);
          console.error(`[useCalendarTasks] Realtime channel error (${status}):`, err);
        }
      });
    return () => {
      setChannelStatus(channelKey, true);
      supabase.removeChannel(channel);
    };
  }, [careCircleId, fetchTasks]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchTasks(true);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchTasks]);

  const toggleTask = useCallback(
    async (id: string, currentStatus: UITask["status"]) => {
      const completing  = currentStatus !== "completed";
      const newStatus   = completing ? "completed" : "pending";
      const completedAt = completing ? new Date().toISOString() : null;

      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, status: newStatus as UITask["status"] } : t,
        ),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: sbError } = await (supabase.from("tasks") as any)
        .update({ status: newStatus, completed_at: completedAt })
        .eq("id", id);

      if (sbError) { setError(sbError.message); await fetchTasks(true); }
    },
    [fetchTasks],
  );

  const restoreUnscheduledTask = useCallback(async (id: string): Promise<void> => {
    // Optimistically remove from the completed list so it vanishes immediately
    setCompletedUnscheduledTasks((prev) => prev.filter((t) => t.id !== id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sbError } = await (supabase.from("tasks") as any)
      .update({ status: "pending", completed_at: null })
      .eq("id", id);
    if (sbError) { setError(sbError.message); }
    // Silently refetch so the task re-appears in the active Unscheduled list
    await fetchTasks(true);
  }, [fetchTasks]);

  const addCalendarTask = useCallback(async (
    title: string,
    dueDate: string | null,
    priority: UITask["priority"],
    createdBy: string,
    assignedTo?: string | null,
    notes?: string | null,
  ): Promise<{ error: string | null }> => {
    if (!careCircleId) return { error: "No care circle" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: sbError } = await (supabase.from("tasks") as any)
      .insert({
        care_circle_id: careCircleId,
        title,
        priority,
        status: "pending",
        due_date: dueDate,
        created_by: createdBy,
        assigned_to: assignedTo ?? null,
        notes: notes ?? null,
      })
      .select("*, assignee:assigned_to(first_name, last_name, avatar_url)")
      .single();
    if (sbError) return { error: sbError.message };
    setTasks((prev) => [...prev, adaptTask(data as DBTaskWithAssignee)]);
    return { error: null };
  }, [careCircleId]);

  const updateCalendarTask = useCallback(async (
    id: string,
    title: string,
    dueDate: string | null,
    priority: UITask["priority"],
    assignedTo?: string | null,
    notes?: string | null,
  ): Promise<{ error: string | null }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sbError } = await (supabase.from("tasks") as any)
      .update({ title, due_date: dueDate, priority, assigned_to: assignedTo ?? null, notes: notes ?? null })
      .eq("id", id);
    if (!sbError) await fetchTasks(true);
    return { error: sbError?.message ?? null };
  }, [fetchTasks]);

  const deleteCalendarTask = useCallback(async (id: string): Promise<void> => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sbError } = await (supabase.from("tasks") as any).delete().eq("id", id);
    if (sbError) { setError(sbError.message); await fetchTasks(true); }
  }, [fetchTasks]);

  const reorderTasks = useCallback(async (orderedIds: string[]): Promise<void> => {
    // Optimistically update sort_order in local state
    setTasks((prev) => {
      const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
      return prev.map((t) =>
        orderMap.has(t.id) ? { ...t, sortOrder: orderMap.get(t.id)! } : t,
      );
    });
    // Persist each updated sort_order to Supabase
    await Promise.all(
      orderedIds.map((id, i) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("tasks") as any).update({ sort_order: i }).eq("id", id),
      ),
    );
  }, []);

  return { tasks, completedUnscheduledTasks, isLoading, error, toggleTask, restoreUnscheduledTask, addCalendarTask, updateCalendarTask, deleteCalendarTask, reorderTasks };
}
