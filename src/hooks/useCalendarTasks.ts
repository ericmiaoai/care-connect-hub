/**
 * useCalendarTasks.ts
 * ====================
 * Fetches all tasks (all statuses) for the displayed calendar date range.
 * Distinct from useTasks, which fetches only pending/in-progress tasks for My Day.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { adaptTask, type UITask } from "@/lib/adapters";

interface UseCalendarTasksReturn {
  tasks:      UITask[];
  isLoading:  boolean;
  error:      string | null;
  toggleTask: (id: string, currentStatus: UITask["status"]) => Promise<void>;
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

    const { data, error: sbError } = await supabase
      .from("tasks")
      .select("*")
      .eq("care_circle_id", careCircleId)
      .gte("due_date", rangeStartISO)
      .lte("due_date", rangeEndISO)
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

      // Optimistic update — flip status in place (task stays visible)
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, status: newStatus as UITask["status"] } : t,
        ),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: sbError } = await (supabase.from("tasks") as any)
        .update({ status: newStatus, completed_at: completedAt })
        .eq("id", id);

      if (sbError) {
        setError(sbError.message);
        await fetchTasks(); // rollback on failure
      }
    },
    [fetchTasks],
  );

  return { tasks, isLoading, error, toggleTask };
}
