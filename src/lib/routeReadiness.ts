/**
 * routeReadiness.ts
 * =================
 * Tiny module-level store that tracks whether ANY data hook is currently
 * loading. Used by the deferred-route-mount logic in __root.tsx so route
 * transitions wait for the new route's data to settle before becoming
 * visible — avoiding the "ghosts of old view + loading skeletons of new
 * view" overlap during navigation.
 *
 * Each data hook (useTasks, useBroadcasts, …) reports its loading state
 * via `useReportLoading(hookId, isLoading)`. The renderer reads aggregate
 * status with `useAnyHookLoading()`.
 *
 * No external library — just a Set + listeners. Lives outside React because
 * a singleton suits the "is anything loading right now" question better
 * than React context.
 */

import { useEffect, useId, useState } from "react";

const loadingHooks = new Set<string>();
const listeners    = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/**
 * Imperative API — call from a data hook to declare it is (or is no longer)
 * loading. Pass a stable `hookId` (e.g. from useId()) so the store can
 * track per-instance state.
 */
export function setHookLoading(hookId: string, loading: boolean): void {
  const had = loadingHooks.has(hookId);
  if (loading) loadingHooks.add(hookId);
  else         loadingHooks.delete(hookId);
  // Notify only on transitions (avoids unnecessary renders)
  if (had !== loading) notify();
}

/**
 * React hook for data hooks to report their loading state. Wraps
 * setHookLoading with a stable per-instance id (via useId) and ensures
 * the entry is cleared when the hook unmounts.
 */
export function useReportLoading(isLoading: boolean): void {
  const id = useId();
  useEffect(() => {
    setHookLoading(id, isLoading);
    // On unmount, always clear so a stale "loading" doesn't block a future
    // route transition.
    return () => setHookLoading(id, false);
  }, [id, isLoading]);
}

/**
 * Subscribes to the store and returns true while ANY tracked hook is
 * loading. Used by the deferred-mount logic in __root.tsx.
 */
export function useAnyHookLoading(): boolean {
  const [loading, setLoading] = useState(loadingHooks.size > 0);
  useEffect(() => {
    const listener = () => setLoading(loadingHooks.size > 0);
    listeners.add(listener);
    // Sync once on mount in case state changed before subscribe ran
    listener();
    return () => { listeners.delete(listener); };
  }, []);
  return loading;
}
