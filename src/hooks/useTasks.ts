import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { adaptTask, type UITask, type DBTaskWithAssignee } from "@/lib/adapters";
import { setChannelStatus } from "@/lib/realtimeSyncStore";
import { useReportLoading } from "@/lib/routeReadiness";
import { getCached, setCached, cacheKey, type CachedTasks } from "@/lib/routePrefetch";

interface UseTasksReturn {
  tasks:                       UITask[];
  completedUnscheduledTasks:   UITask[];
  isLoading:                   boolean;
  error:                       string | null;
  completeTask: (id: string) => Promise<void>;
  restoreTask:  (id: string) => Promise<void>;
  addTask:      (title: string, dueDate: string | null, priority: UITask["priority"], createdBy: string, assignedTo?: string | null, notes?: string | null) => Promise<{ error: string | null }>;
  updateTask:   (id: string, title: string, dueDate: string | null, priority: UITask["priority"], assignedTo?: string | null, notes?: string | null) => Promise<{ error: string | null }>;
  deleteTask:   (id: string) => Promise<void>;
  reorderTasks: (orderedIds: string[]) => Promise<void>;
}

export function useTasks(careCircleId: string | null | undefined): UseTasksReturn {
  const [tasks,                     setTasks]                     = useState<UITask[]>([]);
  const [completedUnscheduledTasks, setCompletedUnscheduledTasks] = useState<UITask[]>([]);
  const [isLoading,                 setIsLoading]                 = useState(true);
  const [error,                     setError]                     = useState<string | null>(null);

  // Report loading state to the route-readiness store (see lib/routeReadiness).
  useReportLoading(isLoading);

  const fetchTasks = useCallback(async (silent = false) => {
    if (!careCircleId) {
      // Keep isLoading=true while careCircleId resolves. Setting it to false
      // here causes a brief flash of the "no tasks" empty state during route
      // mount, before the real fetch runs with a valid circleId.
      return;
    }

    // Fast path: data was already prefetched (e.g. by SideNav hover) — use
    // it instantly and skip the loading state entirely.
    if (!silent) {
      const cached = getCached<CachedTasks>(cacheKey.tasks(careCircleId));
      if (cached) {
        setTasks(cached.active);
        setCompletedUnscheduledTasks(cached.completed);
        setIsLoading(false);
        return;
      }
    }

    if (!silent) setIsLoading(true);
    setError(null);

    const [activeResult, completedResult] = await Promise.all([
      supabase
        .from("tasks")
        .select("*, assignee:assigned_to(first_name, last_name, avatar_url)")
        .eq("care_circle_id", careCircleId)
        .in("status", ["pending", "in_progress"])
        .order("due_date", { ascending: true }),
      supabase
        .from("tasks")
        .select("*, assignee:assigned_to(first_name, last_name, avatar_url)")
        .eq("care_circle_id", careCircleId)
        .eq("status", "completed")
        .is("due_date", null)
        .order("completed_at", { ascending: false })
        .limit(50),
    ]);

    if (activeResult.error) {
      setError(activeResult.error.message);
      setTasks([]);
      setCompletedUnscheduledTasks(
        (completedResult.data ?? []).map((r) => adaptTask(r as DBTaskWithAssignee)),
      );
    } else {
      const active    = (activeResult.data    ?? []).map((r) => adaptTask(r as DBTaskWithAssignee));
      const completed = (completedResult.data ?? []).map((r) => adaptTask(r as DBTaskWithAssignee));
      setTasks(active);
      setCompletedUnscheduledTasks(completed);
      // Warm the cache for next time (subsequent visits + hover prefetch path)
      setCached<CachedTasks>(cacheKey.tasks(careCircleId), { active, completed });
    }

    setIsLoading(false);
  }, [careCircleId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!careCircleId) return;
    const channelKey = `tasks_rt_${careCircleId}`;
    const channel = supabase
      .channel(channelKey)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `care_circle_id=eq.${careCircleId}` }, () => { fetchTasks(true); })
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          setChannelStatus(channelKey, true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setChannelStatus(channelKey, false);
          console.error(`[useTasks] Realtime channel error (${status}):`, err);
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

  const completeTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sbError } = await (supabase.from("tasks") as any)
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", id);
    if (sbError) { await fetchTasks(true); setError(`Failed to complete task: ${sbError.message}`); }
  }, [fetchTasks]);

  const restoreTask = useCallback(async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sbError } = await (supabase.from("tasks") as any)
      .update({ status: "pending", completed_at: null })
      .eq("id", id);
    if (!sbError) await fetchTasks(true);
  }, [fetchTasks]);

  const addTask = useCallback(async (
    title: string,
    dueDate: string | null,
    priority: UITask["priority"],
    createdBy: string,
    assignedTo?: string | null,
    notes?: string | null,
  ): Promise<{ error: string | null }> => {
    if (!careCircleId) return { error: "No care circle" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: sbError } = await (supabase.from("tasks") as any).insert({
      care_circle_id: careCircleId,
      title,
      priority,
      status: "pending",
      due_date: dueDate,
      created_by: createdBy,
      assigned_to: assignedTo ?? null,
      notes: notes ?? null,
    }).select("*, assignee:assigned_to(first_name, last_name, avatar_url)").single();
    if (sbError) {
      await fetchTasks(true);
      return { error: sbError.message };
    }
    setTasks((prev) => [...prev, adaptTask(data as DBTaskWithAssignee)]);
    return { error: null };
  }, [careCircleId]);

  const updateTask = useCallback(async (
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

  const deleteTask = useCallback(async (id: string): Promise<void> => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sbError } = await (supabase.from("tasks") as any).delete().eq("id", id);
    if (sbError) { setError(`Failed to delete task: ${sbError.message}`); await fetchTasks(true); }
  }, [fetchTasks]);

  const reorderTasks = useCallback(async (orderedIds: string[]): Promise<void> => {
    setTasks((prev) => {
      const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
      return prev.map((t) =>
        orderMap.has(t.id) ? { ...t, sortOrder: orderMap.get(t.id)! } : t,
      );
    });
    await Promise.all(
      orderedIds.map((id, i) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("tasks") as any).update({ sort_order: i }).eq("id", id),
      ),
    );
  }, []);

  return { tasks, completedUnscheduledTasks, isLoading, error, completeTask, restoreTask, addTask, updateTask, deleteTask, reorderTasks };
}
