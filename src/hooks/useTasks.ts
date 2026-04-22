/**
 * useTasks.ts
 * ===========
 * Fetches today's tasks for the current user's Care Circle from Supabase.
 * Exposes a completeTask() mutation that marks a task as done in the DB.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { adaptTask, type UITask } from "@/lib/adapters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface UseTasksReturn {
  tasks:        UITask[];
  isLoading:    boolean;
  error:        string | null;
  completeTask: (id: string) => Promise<void>;
  restoreTask:  (id: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useTasks(careCircleId: string | null | undefined): UseTasksReturn {
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
      .in("status", ["pending", "in_progress"])
      .order("due_date", { ascending: true });

    if (sbError) {
      setError(sbError.message);
      setTasks([]);
    } else {
      setTasks((data ?? []).map(adaptTask));
    }

    setIsLoading(false);
  }, [careCircleId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ── Complete a task ─────────────────────────────────────────────────────
  const completeTask = useCallback(async (id: string) => {
    // Optimistically remove from UI immediately
    setTasks((prev) => prev.filter((t) => t.id !== id));

    const { error: sbError } = await supabase
      .from("tasks")
      .update({
        status:       "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (sbError) {
      // If DB update failed, restore the task in UI and show error
      await fetchTasks();
      setError(`Failed to complete task: ${sbError.message}`);
    }
  }, [fetchTasks]);

  // ── Restore a task (for toast "undo") ───────────────────────────────────
  const restoreTask = useCallback(async (id: string) => {
    const { error: sbError } = await supabase
      .from("tasks")
      .update({
        status:       "pending",
        completed_at: null,
      })
      .eq("id", id);

    if (!sbError) {
      // Re-fetch to get the restored task back in the list
      await fetchTasks();
    }
  }, [fetchTasks]);

  return { tasks, isLoading, error, completeTask, restoreTask };
}
