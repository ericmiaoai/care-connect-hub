import type { UserId } from "./users";

export type TaskKind = "medication" | "appointment" | "transport" | "vitals";

export interface Task {
  id: string;
  time: string; // "08:00"
  title: string;
  detail?: string;
  kind: TaskKind;
  assignedTo: UserId;
}

export const MOCK_TASKS: Task[] = [
  { id: "t1", time: "07:30", title: "Blood pressure check", detail: "Log systolic/diastolic in journal", kind: "vitals", assignedTo: "nurse" },
  { id: "t2", time: "08:00", title: "Lisinopril 10mg", detail: "1 tablet, with breakfast", kind: "medication", assignedTo: "mom" },
  { id: "t3", time: "08:00", title: "Metformin 500mg", detail: "1 tablet, with food", kind: "medication", assignedTo: "mom" },
  { id: "t4", time: "10:30", title: "Cardiology follow-up", detail: "Dr. Patel — bring AVS folder", kind: "appointment", assignedTo: "sister" },
  { id: "t5", time: "12:00", title: "Lunch + Atorvastatin 20mg", detail: "After meal", kind: "medication", assignedTo: "mom" },
  { id: "t6", time: "14:00", title: "Physical therapy pickup", detail: "Front entrance, building B", kind: "transport", assignedTo: "sister" },
  { id: "t7", time: "18:00", title: "Lisinopril 10mg", detail: "Evening dose", kind: "medication", assignedTo: "mom" },
  { id: "t8", time: "21:00", title: "Wound dressing change", detail: "Left forearm — sterile gauze", kind: "vitals", assignedTo: "nurse" },
];

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  title: string;
  kind: TaskKind;
  assignedTo: UserId;
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const MOCK_EVENTS: CalendarEvent[] = [
  { id: "e1", date: dateOffset(0), time: "08:00", title: "Lisinopril", kind: "medication", assignedTo: "mom" },
  { id: "e2", date: dateOffset(0), time: "10:30", title: "Cardiology", kind: "appointment", assignedTo: "sister" },
  { id: "e3", date: dateOffset(1), time: "09:00", title: "PT Session", kind: "transport", assignedTo: "sister" },
  { id: "e4", date: dateOffset(2), time: "08:00", title: "Metformin", kind: "medication", assignedTo: "mom" },
  { id: "e5", date: dateOffset(3), time: "14:00", title: "Lab draw", kind: "appointment", assignedTo: "nurse" },
  { id: "e6", date: dateOffset(4), time: "11:00", title: "Pharmacy run", kind: "transport", assignedTo: "mom" },
  { id: "e7", date: dateOffset(5), time: "08:00", title: "Lisinopril", kind: "medication", assignedTo: "mom" },
];

export interface StatusUpdate {
  id: string;
  author: UserId;
  authorName: string;
  timeAgo: string;
  body: string;
}

export const MOCK_UPDATES: StatusUpdate[] = [
  {
    id: "u1",
    author: "admin",
    authorName: "Care Coordinator",
    timeAgo: "12m ago",
    body: "Updated dad's evening medication schedule per Dr. Patel's notes from today's visit. Please review before tonight's dose.",
  },
  {
    id: "u2",
    author: "admin",
    authorName: "Care Coordinator",
    timeAgo: "2h ago",
    body: "Nurse Kim arrives Thursday at 9 AM for wound check. Sister will be on-site to let her in.",
  },
  {
    id: "u3",
    author: "admin",
    authorName: "Care Coordinator",
    timeAgo: "Yesterday",
    body: "New AVS uploaded from yesterday's cardiology visit — pending review in Scan AVS tab.",
  },
];

export interface ParsedRow {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  time: string;
}

export const MOCK_PARSED_ROWS: ParsedRow[] = [
  { id: "p1", medication: "Lisinopril", dosage: "10 mg", frequency: "2x daily", time: "08:00, 18:00" },
  { id: "p2", medication: "Metformin", dosage: "500 mg", frequency: "2x daily", time: "08:00, 20:00" },
  { id: "p3", medication: "Atorvastatin", dosage: "20 mg", frequency: "1x daily", time: "12:00" },
  { id: "p4", medication: "Aspirin", dosage: "81 mg", frequency: "1x daily", time: "08:00" },
];
