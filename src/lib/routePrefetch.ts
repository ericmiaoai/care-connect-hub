/**
 * routePrefetch.ts
 * ================
 * Hover-driven route prefetching.
 *
 * When the user hovers a tab in the SideNav, we run the same Supabase
 * queries the destination route would run, and cache the adapted results
 * in a module-level map. By the time the user clicks, the data is already
 * in memory — the destination route's hook checks the cache first and
 * renders instantly with no loading state.
 *
 * Scope (only the routes that benefit):
 *   - "/"          → tasks + today's calendar events
 *   - "/calendar"  → today's calendar events (default day view)
 *   - "/updates"   → broadcasts
 *   - "/settings"  → skipped (members are already kept in app state)
 *   - "/scan"      → skipped (camera capture, no preload data)
 *
 * Cache is in-memory only — does NOT persist across reloads. TTL is 30s,
 * after which any cached entry is discarded and a fresh fetch happens.
 *
 * The same `setCached` API is used by data hooks on their normal fetches,
 * so non-prefetch visits also warm the cache for next time.
 */

import { supabase } from "./supabaseClient";
import {
  adaptBroadcast,
  adaptCalendarEvent,
  adaptTask,
  type UIBroadcast,
  type UICalendarEvent,
  type UITask,
  type DBBroadcastWithAuthor,
  type DBCalendarEventWithCompleter,
  type DBTaskWithAssignee,
} from "./adapters";

// ── Cache primitives ────────────────────────────────────────────────────────

type CacheEntry<T = unknown> = { data: T; ts: number };

const cache    = new Map<string, CacheEntry>();
const inflight = new Set<string>();

/** TTL in ms — entries older than this are treated as missing on read. */
const TTL_MS = 30_000;

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() });
}

// ── Cache keys (centralised so prefetch and hooks stay in sync) ─────────────

export const cacheKey = {
  broadcasts: (cid: string)                          => `b:${cid}`,
  tasks:      (cid: string)                          => `t:${cid}`,
  events:     (cid: string, start: string, end: string) => `e:${cid}:${start}:${end}`,
};

// ── Today's local-date range — shared so prefetch and the My Day hook agree
//    on the cache key. Mirrors the logic in src/routes/index.tsx.

export function todayRange(): { start: string; end: string } {
  const d     = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();
  return { start, end };
}

// ── Internal: run a prefetch only if not already cached / inflight ──────────

async function once(key: string, fn: () => Promise<void>): Promise<void> {
  if (getCached(key) !== null) return;
  if (inflight.has(key)) return;
  inflight.add(key);
  try {
    await fn();
  } catch (err) {
    // Don't crash the app for a speculative prefetch — just log and move on.
    console.warn("[routePrefetch] prefetch failed", key, err);
  } finally {
    inflight.delete(key);
  }
}

// ── Per-route prefetch functions ─────────────────────────────────────────────

export async function prefetchUpdates(careCircleId: string): Promise<void> {
  const key = cacheKey.broadcasts(careCircleId);
  await once(key, async () => {
    const { data } = await supabase
      .from("broadcast_updates")
      .select("*, author:author_id(first_name, last_name, avatar_url)")
      .eq("care_circle_id", careCircleId)
      .order("created_at", { ascending: false });
    setCached<UIBroadcast[]>(
      key,
      (data ?? []).map((r) => adaptBroadcast(r as DBBroadcastWithAuthor)),
    );
  });
}

export interface CachedTasks {
  active:    UITask[];
  completed: UITask[];
}

export async function prefetchTasks(careCircleId: string): Promise<void> {
  const key = cacheKey.tasks(careCircleId);
  await once(key, async () => {
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
    setCached<CachedTasks>(key, {
      active:    (activeResult.data    ?? []).map((r) => adaptTask(r as DBTaskWithAssignee)),
      completed: (completedResult.data ?? []).map((r) => adaptTask(r as DBTaskWithAssignee)),
    });
  });
}

export async function prefetchTodayEvents(careCircleId: string): Promise<void> {
  const { start, end } = todayRange();
  const key = cacheKey.events(careCircleId, start, end);
  await once(key, async () => {
    const { data } = await supabase
      .from("calendar_events")
      .select("*, completer:completed_by(first_name, last_name)")
      .eq("care_circle_id", careCircleId)
      .gte("start_time", start)
      .lte("start_time", end)
      .order("start_time", { ascending: true });
    setCached<UICalendarEvent[]>(
      key,
      (data ?? []).map((r) => adaptCalendarEvent(r as DBCalendarEventWithCompleter)),
    );
  });
}

// ── Dispatcher used by SideNav hover handlers ──────────────────────────────

export function prefetchForRoute(to: string, careCircleId: string): void {
  if (!careCircleId) return;
  switch (to) {
    case "/":
      // Fire both — they run in parallel and don't depend on each other.
      void prefetchTasks(careCircleId);
      void prefetchTodayEvents(careCircleId);
      break;
    case "/calendar":
      // Calendar opens on day view (today) by default; prefetch matches.
      void prefetchTodayEvents(careCircleId);
      break;
    case "/updates":
      void prefetchUpdates(careCircleId);
      break;
    // "/settings", "/scan": no prefetch (no benefit)
  }
}
