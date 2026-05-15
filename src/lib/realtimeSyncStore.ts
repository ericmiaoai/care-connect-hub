import { useState, useEffect } from "react";

/**
 * Module-level store for tracking Supabase realtime channel subscription health.
 * When a channel fails to subscribe (CHANNEL_ERROR or TIMED_OUT), it's marked as unhealthy.
 * When a channel successfully subscribes, it's marked as healthy.
 *
 * Simple Map + listeners pattern for reactivity.
 * No context or useSyncExternalStore complexity.
 */

const statusMap = new Map<string, boolean>(); // key → isHealthy (true = healthy, false = error)
const listeners = new Set<(status: Map<string, boolean>) => void>();

/**
 * Record the subscription status of a channel.
 * Called from hook subscribe callbacks when status changes.
 */
export function setChannelStatus(key: string, isHealthy: boolean): void {
  const prev = statusMap.get(key);
  if (prev === isHealthy) return; // no change
  statusMap.set(key, isHealthy);
  // Notify all listeners with the updated map
  listeners.forEach((listener) => listener(new Map(statusMap)));
}

/**
 * Hook to check if any realtime channel has an error.
 * Returns true if at least one channel is unhealthy (failed to subscribe or timed out).
 */
export function useRealtimeSyncHealth(): { hasError: boolean } {
  const [status, setStatus] = useState<Map<string, boolean>>(new Map(statusMap));

  useEffect(() => {
    const handleUpdate = (updatedStatus: Map<string, boolean>) => {
      setStatus(new Map(updatedStatus));
    };

    listeners.add(handleUpdate);
    return () => { listeners.delete(handleUpdate); };
  }, []);

  const hasError = [...status.values()].some((isHealthy) => !isHealthy);
  return { hasError };
}
