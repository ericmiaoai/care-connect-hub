import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { adaptTask, type UITask } from "@/lib/adapters";

interface UseCalendarTasksReturn {
  tasks:               UITask[];
  isLoading:           boolean;
  error:               string | null;
  toggleTask:          (id: string, currentStatus: UITask["status"]) => Promise<void>;
  addCalendarTask:     (title: string, dueDate: string, priority: UITask["priority"], createdBy: string) => Promise<{ error: string | null }>;
  updateCalendarTask:  (id: string, title: string, dueDate: string, priority: UITask["priority"]) => Promise<{ error: string | null }>;
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

    // Tasks store due_date as "YYYY-MM-DD" (no time component). Slice the ISO
    // range strings to date-only so the comparison is always apples-to-apples
    // and is not thrown off by timezone offsets in the ISO timestamps.
    const startDate = rangeStartISO.slice(0, 10);
    const endDate   = rangeEndISO.slice(0, 10);

    const { data, error: sbError } = await supabase
      .from("tasks")
      .select("*")
      .eq("care_circle_id", careCircleId)
      .gte("due_date", startDate)
      .lte("due_date", endDate)
      .order("due_date", { ascending: true });

    if (sbError) {
      setError(sbError.message);
      setTasks([]);
    } else {
      setTasks((data ?? []).map(adaptTask));
    }

    setIsLoading(false);
  }, [careCircleId, rangeStartISO, rangeEndISO]);

  useEffect(() => {
    fetchTasks();
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

      if (sbError) { setError(sbError.message); await fetchTasks(); }
    },
    [fetchTasks],
  );

  const addCalendarTask = useCallback(async (
    title: string,
    dueDate: string,
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
    dueDate: string,
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
