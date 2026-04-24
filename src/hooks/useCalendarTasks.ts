import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { adaptTask, type UITask } from "@/lib/adapters";

interface UseCalendarTasksReturn {
  tasks:               UITask[];
  isLoading:           boolean;
  error:               string | null;
  toggleTask:          (id: string, currentStatus: UITask["status"]) => Promise<void>;
  addCalendarTask:     (title: string, dueDate: string | null, priority: UITask["priority"], createdBy: string) => Promise<{ error: string | null }>;
  updateCalendarTask:  (id: string, title: string, dueDate: string | null, priority: UITask["priority"]) => Promise<{ error: string | null }>;
  deleteCalendarTask:  (id: string) => Promise<void>;
  reorderTasks:        (orderedIds: string[]) => Promise<void>;
}

export function useCalendarTasks(
  careCircleId:  string | null | undefined,
  rangeStartISO: string,
  rangeEndISO:   string,
): UseCalendarTasksReturn {
  const [tasks,     setTasks]     = useState<UITask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!careCircleId) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const startDate = rangeStartISO.slice(0, 10);
    const endDate   = rangeEndISO.slice(0, 10);

    // Two parallel queries: dated tasks in the visible range + unscheduled tasks
    // (due_date IS NULL). A single range filter can never match NULL rows, so the
    // second query is required for unscheduled tasks to appear in Calendar at all.
    const [
      { data: rangedData,      error: rangedError      },
      { data: unscheduledData, error: unscheduledError },
    ] = await Promise.all([
      supabase.from("tasks").select("*")
        .eq("care_circle_id", careCircleId)
        .gte("due_date", startDate)
        .lte("due_date", endDate)
        .order("due_date", { ascending: true }),
      supabase.from("tasks").select("*")
        .eq("care_circle_id", careCircleId)
        .is("due_date", null)
        .in("status", ["pending", "in_progress"])
        .order("sort_order", { ascending: true, nullsFirst: false }),
    ]);

    const err = rangedError ?? unscheduledError;
    if (err) {
      setError(err.message);
      setTasks([]);
    } else {
      setTasks([...(rangedData ?? []), ...(unscheduledData ?? [])].map(adaptTask));
    }

    setIsLoading(false);
  }, [careCircleId, rangeStartISO, rangeEndISO]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!careCircleId) return;
    const channel = supabase
      .channel(`cal_tasks_rt_${careCircleId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `care_circle_id=eq.${careCircleId}` }, () => { fetchTasks(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [careCircleId, fetchTasks]);

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

      if (sbError) { setError(sbError.message); await fetchTasks(); }
    },
    [fetchTasks],
  );

  const addCalendarTask = useCallback(async (
    title: string,
    dueDate: string | null,
    priority: UITask["priority"],
    createdBy: string,
  ): Promise<{ error: string | null }> => {
    if (!careCircleId) return { error: "No care circle" };
    // Use .select().single() to get the inserted row back directly — avoids
    // re-running the range-filtered fetchTasks which can miss the new task
    // due to timezone edge cases in the date comparison.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: sbError } = await (supabase.from("tasks") as any)
      .insert({
        care_circle_id: careCircleId,
        title,
        priority,
        status: "pending",
        due_date: dueDate,
        created_by: createdBy,
      })
      .select()
      .single();
    if (sbError) return { error: sbError.message };
    setTasks((prev) => [...prev, adaptTask(data)]);
    return { error: null };
  }, [careCircleId]);

  const updateCalendarTask = useCallback(async (
    id: string,
    title: string,
    dueDate: string | null,
    priority: UITask["priority"],
  ): Promise<{ error: string | null }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sbError } = await (supabase.from("tasks") as any)
      .update({ title, due_date: dueDate, priority })
      .eq("id", id);
    if (!sbError) await fetchTasks();
    return { error: sbError?.message ?? null };
  }, [fetchTasks]);

  const deleteCalendarTask = useCallback(async (id: string): Promise<void> => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sbError } = await (supabase.from("tasks") as any).delete().eq("id", id);
    if (sbError) { setError(sbError.message); await fetchTasks(); }
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

  return { tasks, isLoading, error, toggleTask, addCalendarTask, updateCalendarTask, deleteCalendarTask, reorderTasks };
}
