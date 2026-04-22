/**
 * adapters.ts
 * ===========
 * Maps snake_case Supabase database row types to camelCase UI types.
 * This is the single place where DB shape → UI shape conversion happens.
 * Import UI types from here; never import database row types into components.
 */

import type { Task as DBTask, CalendarEvent as DBEvent, BroadcastUpdate as DBUpdate } from "./database.types";

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------
export type TaskKind = "medication" | "appointment" | "transport" | "vitals";

export interface UITask {
  id:           string;
  time:         string;         // "08:00" extracted from due_date
  title:        string;
  detail:       string | null;
  kind:         TaskKind;
  priority:     DBTask["priority"];
  assigneeId:   string | null;  // UUID of assigned profile
  rawDueDate:   string | null;  // original ISO string for sorting
}

/** Infer task kind from the title using keyword matching */
function inferKind(title: string): TaskKind {
  const t = title.toLowerCase();
  if (/\b(mg|ml|tablets?|doses?|medications?|pills?|capsules?|patch|insulin|inhaler|injections?|creams?|lotions?|sprays?|eyedrops?|eardrops?|antibiotics?|probiotics?|vitamins?|supplements?|ingest|drink|edibles?|eat|eaten|dissolve)\b/.test(t))
    return "medication";
  if (/\b(dr\.|doctor|appointments?|follow[- ]up|clinic|visit|therapy|consult|nurse|mri|ct|x[- ]?ray|pt|counseling|exams?)\b/.test(t))
    return "appointment";
  if (/\b(pickup|pick up|transport|drive|ride|drop[- ]off|escort|pharmacy|run|deliver(y|ies)?)\b/.test(t))
    return "transport";
  return "vitals"; // default: vitals / general care
}

/** Extract "HH:MM" from an ISO timestamp string */
function extractTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function adaptTask(row: DBTask): UITask {
  return {
    id:          row.id,
    time:        extractTime(row.due_date),
    title:       row.title,
    detail:      row.notes ?? null,
    kind:        inferKind(row.title),
    priority:    row.priority,
    assigneeId:  row.assigned_to ?? null,
    rawDueDate:  row.due_date ?? null,
  };
}

// ---------------------------------------------------------------------------
// Calendar Event
// ---------------------------------------------------------------------------
export interface UICalendarEvent {
  id:              string;
  date:            string;         // "YYYY-MM-DD"
  time:            string;         // "HH:MM"
  title:           string;
  description:     string | null;
  location:        string | null;
  kind:            TaskKind;
  isCompleted:     boolean;
  completedByName: string | null;  // "First Last" of the caregiver who confirmed it
  completedAt:     string | null;  // ISO string
}

// Extended DB row type that includes the joined completer profile
export interface DBCalendarEventWithCompleter extends DBEvent {
  completer: { first_name: string; last_name: string } | null;
}

export function adaptCalendarEvent(row: DBCalendarEventWithCompleter): UICalendarEvent {
  const d = new Date(row.start_time);
  return {
    id:              row.id,
    date:            d.toISOString().slice(0, 10),
    time:            d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
    title:           row.title,
    description:     row.description ?? null,
    location:        row.location ?? null,
    kind:            inferKind(row.title),
    isCompleted:     row.completed_by !== null,
    completedByName: row.completer
      ? `${row.completer.first_name} ${row.completer.last_name}`
      : null,
    completedAt:     row.completed_at ?? null,
  };
}

// ---------------------------------------------------------------------------
// Broadcast Update
// ---------------------------------------------------------------------------
export interface UIBroadcast {
  id:        string;
  title:     string;
  content:   string;
  severity:  DBUpdate["severity"];
  authorId:  string;
  createdAt: string;   // ISO string
  timeAgo:   string;   // Human readable: "12m ago", "2h ago", "Yesterday"
}

export function formatTimeAgo(iso: string): string {
  const now    = Date.now();
  const then   = new Date(iso).getTime();
  const secs   = Math.floor((now - then) / 1000);
  const mins   = Math.floor(secs / 60);
  const hours  = Math.floor(mins / 60);
  const days   = Math.floor(hours / 24);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export function adaptBroadcast(row: DBUpdate): UIBroadcast {
  return {
    id:        row.id,
    title:     row.title,
    content:   row.content,
    severity:  row.severity,
    authorId:  row.author_id,
    createdAt: row.created_at,
    timeAgo:   formatTimeAgo(row.created_at),
  };
}
