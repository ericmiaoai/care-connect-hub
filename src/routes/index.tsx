import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  CalendarDays, MapPin, CheckCircle2,
  GripVertical, ChevronDown, ChevronRight, BellOff,
} from "lucide-react";
import { AddButton } from "@/components/AddButton";
import { ActionTypeSheet } from "@/components/ActionTypeSheet";
import { AddTaskSheet } from "@/components/AddTaskSheet";
import { ProgressRing } from "@/components/ProgressRing";
import { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskCard } from "@/components/TaskCard";
import { useAuth } from "@/hooks/useAuth";
import { useCareCircle } from "@/hooks/useCareCircle";
import { useTasks } from "@/hooks/useTasks";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { UITask, UICalendarEvent } from "@/lib/adapters";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type SectionId = "appointments" | "overdue" | "today" | "unscheduled";

const ALL_SECTIONS: SectionId[] = ["appointments", "overdue", "today", "unscheduled"];

const SECTION_TITLE: Record<SectionId, string> = {
  appointments: "Today's Appointments",
  overdue:      "Overdue Tasks",
  today:        "Today's Tasks",
  unscheduled:  "Unscheduled",
};

const GOLD  = "oklch(0.62 0.13 74)";
const INPUT = "rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

// ---------------------------------------------------------------------------
// localStorage helpers (keyed per user so each account keeps its own prefs)
// ---------------------------------------------------------------------------

const orderKey       = (uid: string) => `cs_myday_order_${uid}`;
const OVERDUE_PREF_KEY = "cs_myday_overdue_pref";
const COLLAPSE_KEY     = "cs_myday_collapsed";

function loadOrder(uid: string): SectionId[] {
  try {
    const raw = localStorage.getItem(orderKey(uid));
    if (!raw) return [...ALL_SECTIONS];
    const parsed = JSON.parse(raw) as SectionId[];
    const valid   = parsed.filter((s) => (ALL_SECTIONS as string[]).includes(s));
    const missing = ALL_SECTIONS.filter((s) => !valid.includes(s));
    return [...valid, ...missing];
  } catch {
    return [...ALL_SECTIONS];
  }
}

function saveOrder(uid: string, order: SectionId[]) {
  try { localStorage.setItem(orderKey(uid), JSON.stringify(order)); } catch { /* */ }
}

// Unified collapse map — covers every section so new sections get it for free
type CollapseMap = Partial<Record<SectionId, boolean>>;

function loadCollapseMap(): CollapseMap {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    return raw ? (JSON.parse(raw) as CollapseMap) : {};
  } catch { return {}; }
}

function saveCollapseMap(m: CollapseMap) {
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(m)); } catch { /* */ }
}

// Overdue-specific pref — only snooze lives here; collapse moved to CollapseMap
interface OverduePref { snoozedUntil: string | null; }

function loadOverduePref(): OverduePref {
  try {
    const raw = localStorage.getItem(OVERDUE_PREF_KEY);
    if (!raw) return { snoozedUntil: null };
    const parsed = JSON.parse(raw);
    return { snoozedUntil: parsed.snoozedUntil ?? null };
  } catch { return { snoozedUntil: null }; }
}

function saveOverduePref(p: OverduePref) {
  try { localStorage.setItem(OVERDUE_PREF_KEY, JSON.stringify(p)); } catch { /* */ }
}

function tomorrowMidnight(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function formatToday(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });
}

function todayISO(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function fmtShortDate(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function daysOverdue(yyyymmdd: string): number {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const taskDate  = new Date(y, m - 1, d);
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - taskDate.getTime()) / 86400000));
}

// ---------------------------------------------------------------------------
// Section card shell (frosted glass, header bar, collapse/snooze)
// ---------------------------------------------------------------------------

interface SectionCardProps {
  title:             string;
  badge?:            number;
  variant?:          "default" | "overdue" | "dim";
  collapsed?:        boolean;
  onToggleCollapse?: () => void;
  onSnooze?:         () => void;
  noun?:             string;   // label used in collapsed footer, e.g. "task" or "appointment"
  dragHandleProps?:  React.ComponentPropsWithoutRef<"button">;
  children:          React.ReactNode;
}

function SectionCard({
  title, badge, variant = "default",
  collapsed, onToggleCollapse, onSnooze,
  noun = "task",
  dragHandleProps, children,
}: SectionCardProps) {
  const isOverdue = variant === "overdue";
  const labelColor = isOverdue
    ? "var(--destructive)"
    : variant === "dim"
    ? "var(--muted-foreground)"
    : GOLD;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xl shadow-md overflow-hidden">

      {/* ── Card header ── */}
      <div className="flex items-center gap-2 px-4 py-3.5">

        {/* Drag grip (section-level reorder) */}
        {dragHandleProps && (
          <button
            {...dragHandleProps}
            title="Drag to reorder section"
            className="cursor-grab shrink-0 flex items-center justify-center rounded-md p-1 text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing"
            style={{ touchAction: "none" }}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        {/* Title + badge */}
        <div className="flex flex-1 items-center gap-2.5 min-w-0">
          <span
            className="text-base font-semibold tracking-tight"
            style={{ color: labelColor }}
          >
            {title}
          </span>
          {badge !== undefined && badge > 0 && (
            <span
              className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold",
                isOverdue
                  ? "bg-destructive/15 text-destructive"
                  : "bg-accent text-muted-foreground",
              )}
            >
              {badge}
            </span>
          )}
        </div>

        {/* Collapse/expand toggle */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand" : "Collapse"}
            className="shrink-0 flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {collapsed
              ? <ChevronRight className="h-4 w-4" />
              : <ChevronDown  className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="mx-4 h-px bg-border/40" />

      {/* ── Content ── */}
      {!collapsed && (
        <div className="px-4 pt-4 pb-5 flex flex-col gap-2.5">
          {children}
        </div>
      )}

      {/* ── Collapsed footer with snooze option ── */}
      {collapsed && (
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {badge} {noun}{badge === 1 ? "" : "s"} hidden
          </span>
          {onSnooze && (
            <button
              type="button"
              onClick={onSnooze}
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <BellOff className="h-3.5 w-3.5" />
              Snooze until tomorrow
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable section wrapper (for section-level drag-to-reorder)
// ---------------------------------------------------------------------------

function SortableSection({
  id,
  children,
}: {
  id:       SectionId;
  children: (dragHandleProps: React.ComponentPropsWithoutRef<"button">) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity:   isDragging ? 0.45 : 1,
      }}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Appointment card (read-only, calendar events)
// ---------------------------------------------------------------------------

function AppointmentCard({ event }: { event: UICalendarEvent }) {
  return (
    <div
      className={cn(
        "flex items-stretch gap-3 rounded-xl border border-border border-l-4 bg-background/50 shadow-sm",
        "border-l-[oklch(0.65_0.15_210)]",
        event.isCompleted && "opacity-55",
      )}
    >
      <div className="flex w-16 flex-col items-center justify-center border-r border-border py-3 text-center">
        <span className="text-sm font-semibold tabular-nums">{event.time}</span>
      </div>

      <div className="flex flex-1 items-center gap-3 py-3 pr-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn(
            "truncate text-sm font-medium text-foreground",
            event.isCompleted && "line-through text-muted-foreground",
          )}>
            {event.title}
          </p>
          {event.location && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {event.location}
            </p>
          )}
          {event.isCompleted && event.completedByName && (
            <p
              className="mt-0.5 flex items-center gap-1 text-xs"
              style={{ color: "oklch(0.60 0.14 155)" }}
            >
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              Confirmed by {event.completedByName}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable task card (for within-section task drag-to-reorder)
// ---------------------------------------------------------------------------

function SortableTaskCard({
  task, onComplete, onDelete,
}: {
  task:       Parameters<typeof TaskCard>[0]["task"];
  onComplete: (id: string) => void;
  onDelete?:  (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform:   CSS.Transform.toString(transform),
        transition,
        opacity:     isDragging ? 0.5 : 1,
        touchAction: "none",
      }}
    >
      <TaskCard
        task={task}
        onComplete={onComplete}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "My Day — CareSync" },
      { name: "description", content: "Today's medications, appointments, and care tasks." },
    ],
  }),
  component: MyDay,
});

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function MyDay() {
  const { user }               = useAuth();
  const { careCircleId, role } = useCareCircle(user?.id);
  const {
    tasks, isLoading: tasksLoading,
    completeTask, restoreTask, addTask, updateTask, deleteTask, reorderTasks,
  } = useTasks(careCircleId);
  const isOnline = useOnlineStatus();

  // Today's local-time window for appointments
  const todayRange = useMemo(() => {
    const d     = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
    const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();
    return { start, end };
  }, []);

  const { events: appointments, isLoading: apptLoading, addEvent } =
    useCalendarEvents(careCircleId, todayRange.start, todayRange.end);

  const isLoading = tasksLoading || apptLoading;

  // Section order + collapse state — loaded from localStorage once user is known
  const [sectionOrder, setSectionOrder] = useState<SectionId[]>([...ALL_SECTIONS]);
  const [overduePref,  setOverduePref]  = useState<OverduePref>({ snoozedUntil: null });
  const [collapseMap,  setCollapseMap]  = useState<CollapseMap>({});

  useEffect(() => {
    if (user?.id) setSectionOrder(loadOrder(user.id));
    setOverduePref(loadOverduePref());
    setCollapseMap(loadCollapseMap());
  }, [user?.id]);

  // Progress ring — tracks today tasks completed this session
  const [completedToday, setCompletedToday] = useState(0);

  // Action type sheet (+ button)
  const [actionSheetOpen,  setActionSheetOpen]  = useState(false);
  const [addTaskSheetOpen, setAddTaskSheetOpen] = useState(false);

  // Add-appointment sheet state
  const [submitting, setSubmitting] = useState(false);

  // Add-appointment sheet state
  const [apptSheetOpen,  setApptSheetOpen]  = useState(false);
  const [apptTitle,      setApptTitle]      = useState("");
  const [apptDate,       setApptDate]       = useState("");
  const [apptTime,       setApptTime]       = useState("09:00");
  const [apptLocation,   setApptLocation]   = useState("");
  const [apptNotes,      setApptNotes]      = useState("");

  // Edit task sheet state (overdue tasks)
  const [editSheetOpen,   setEditSheetOpen]   = useState(false);
  const [editingTask,     setEditingTask]     = useState<UITask | null>(null);
  const [editTitle,       setEditTitle]       = useState("");
  const [editDate,        setEditDate]        = useState("");
  const [editTime,        setEditTime]        = useState("");
  const [editPriority,    setEditPriority]    = useState<UITask["priority"]>("medium");
  const [editSubmitting,  setEditSubmitting]  = useState(false);

  const openEditSheet = (task: UITask) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDate(task.localDateKey ?? "");
    if (task.hasTime && task.rawDueDate) {
      const d = new Date(task.rawDueDate);
      setEditTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    } else {
      setEditTime("");
    }
    setEditPriority(task.priority);
    setEditSheetOpen(true);
  };

  const handleEditSave = async () => {
    if (!isOnline) { toast.error("You're offline — reconnect to make changes."); return; }
    if (!editTitle.trim() || !editingTask) return;
    setEditSubmitting(true);
    const dueDate: string | null = editDate
      ? (editTime ? new Date(`${editDate}T${editTime}:00`).toISOString() : editDate)
      : null;
    const { error } = await updateTask(editingTask.id, editTitle.trim(), dueDate, editPriority);
    setEditSubmitting(false);
    if (error) toast.error("Failed to update task", { description: error });
    else { setEditSheetOpen(false); toast.success("Task updated"); }
  };

  const canManage = can(role, "manage_tasks");

  // DnD sensors — separate instances for section vs. task reordering
  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const taskSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  // Task categorization using localDateKey (no UTC drift)
  const todayKey = todayISO();

  const overdueTasks = useMemo(
    () => tasks.filter((t) => t.localDateKey !== null && t.localDateKey < todayKey),
    [tasks, todayKey],
  );
  const todayTimedTasks = useMemo(
    () => tasks
      .filter((t) => t.localDateKey === todayKey && t.hasTime)
      .sort((a, b) => (a.rawDueDate ?? "").localeCompare(b.rawDueDate ?? "")),
    [tasks, todayKey],
  );
  const todayUntimedTasks = useMemo(
    () => tasks
      .filter((t) => t.localDateKey === todayKey && !t.hasTime)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [tasks, todayKey],
  );
  const unscheduledTasks = useMemo(
    () => tasks
      .filter((t) => t.localDateKey === null)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [tasks],
  );

  // Snooze: hide overdue section entirely until snoozedUntil passes
  const isOverdueSnoozed = overduePref.snoozedUntil
    ? new Date() < new Date(overduePref.snoozedUntil)
    : false;

  const sectionHasContent: Record<SectionId, boolean> = {
    appointments: appointments.length > 0,
    overdue:      overdueTasks.length > 0 && !isOverdueSnoozed,
    today:        todayTimedTasks.length > 0 || todayUntimedTasks.length > 0,
    unscheduled:  unscheduledTasks.length > 0,
  };

  const visibleSections = sectionOrder.filter((id) => sectionHasContent[id]);

  const totalTasks  = overdueTasks.length + todayTimedTasks.length + todayUntimedTasks.length + unscheduledTasks.length;
  const hasAnything = appointments.length > 0 || totalTasks > 0;

  // Progress ring — today's tasks only (overdue and unscheduled excluded)
  const todayTotal = todayTimedTasks.length + todayUntimedTasks.length + completedToday;
  const celebrate  = todayTotal > 0 && completedToday === todayTotal;

  // Section drag-to-reorder
  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSectionOrder((prev) => {
      const oi = prev.indexOf(active.id as SectionId);
      const ni = prev.indexOf(over.id  as SectionId);
      if (oi === -1 || ni === -1) return prev;
      const next = arrayMove(prev, oi, ni);
      if (user?.id) saveOrder(user.id, next);
      return next;
    });
  };

  // Task drag-to-reorder (unscheduled section only)
  const handleTaskDragEnd = async (event: DragEndEvent) => {
    if (!isOnline) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oi = unscheduledTasks.findIndex((t) => t.id === active.id);
    const ni = unscheduledTasks.findIndex((t) => t.id === over.id);
    if (oi === -1 || ni === -1) return;
    await reorderTasks(arrayMove(unscheduledTasks, oi, ni).map((t) => t.id));
  };

  // Universal section collapse — works for every current and future section
  const toggleCollapse = (id: SectionId) => {
    setCollapseMap((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveCollapseMap(next);
      return next;
    });
  };

  // Overdue snooze — hides the section entirely until tomorrow midnight
  const handleSnoozeOverdue = () => {
    const next = { snoozedUntil: tomorrowMidnight() };
    setOverduePref(next);
    saveOverduePref(next);
    toast.success("Overdue tasks snoozed until tomorrow morning");
  };

  // Task actions
  const handleComplete = async (id: string) => {
    if (!isOnline) { toast.error("You're offline — reconnect to make changes."); return; }
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const isToday = task.localDateKey === todayKey;
    await completeTask(id);
    if (isToday) setCompletedToday((n) => n + 1);
    toast.success("Task completed", {
      description: `${task.time !== "—" ? task.time + " · " : ""}${task.title}`,
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          restoreTask(id);
          if (isToday) setCompletedToday((n) => Math.max(0, n - 1));
        },
      },
    });
  };

  const handleDelete = async (id: string) => {
    if (!isOnline) { toast.error("You're offline — reconnect to make changes."); return; }
    const task = tasks.find((t) => t.id === id);
    await deleteTask(id);
    if (task) toast.success(`"${task.title}" deleted`);
  };

  const openApptSheet = () => {
    setApptTitle(""); setApptDate(todayISO()); setApptTime("09:00");
    setApptLocation(""); setApptNotes("");
    setApptSheetOpen(true);
  };

  const handleAddAppt = async () => {
    if (!isOnline) { toast.error("You're offline — reconnect to make changes."); return; }
    if (!apptTitle.trim() || !apptDate) return;
    setSubmitting(true);
    const start = new Date(`${apptDate}T${apptTime}:00`);
    const end   = new Date(start.getTime() + 60 * 60 * 1000);
    const { error } = await addEvent(
      apptTitle.trim(), start.toISOString(), end.toISOString(),
      user?.id ?? "", apptLocation || undefined, apptNotes || undefined,
    );
    setSubmitting(false);
    if (error) toast.error("Failed to add appointment", { description: error });
    else       { setApptSheetOpen(false); toast.success("Appointment added"); }
  };


  // ---------------------------------------------------------------------------
  // Section renderers
  // ---------------------------------------------------------------------------

  function renderSection(
    id:               SectionId,
    dragHandleProps:  React.ComponentPropsWithoutRef<"button">,
  ) {
    switch (id) {

      case "appointments":
        return (
          <SectionCard
            title={SECTION_TITLE.appointments}
            badge={appointments.length}
            variant="dim"
            noun="appointment"
            collapsed={collapseMap["appointments"] ?? false}
            onToggleCollapse={() => toggleCollapse("appointments")}
            dragHandleProps={dragHandleProps}
          >
            <AnimatePresence initial={false}>
              {appointments.map((event) => (
                <motion.div
                  key={event.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40, height: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <AppointmentCard event={event} />
                </motion.div>
              ))}
            </AnimatePresence>
          </SectionCard>
        );

      case "overdue":
        return (
          <SectionCard
            title={SECTION_TITLE.overdue}
            badge={overdueTasks.length}
            variant="overdue"
            collapsed={collapseMap["overdue"] ?? false}
            onToggleCollapse={() => toggleCollapse("overdue")}
            onSnooze={handleSnoozeOverdue}
            dragHandleProps={dragHandleProps}
          >
            <AnimatePresence initial={false}>
              {overdueTasks.map((task) => {
                const days = daysOverdue(task.localDateKey!);
                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 40, height: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    <p
                      className="mb-1.5 ml-1 text-sm font-medium"
                      style={{ color: "var(--destructive)" }}
                    >
                      {fmtShortDate(task.localDateKey!)}
                      {days > 0 && (
                        <span className="ml-2 text-sm font-normal opacity-80">
                          {days} day{days === 1 ? "" : "s"} overdue
                        </span>
                      )}
                    </p>
                    <TaskCard
                      task={task}
                      onComplete={handleComplete}
                      onEdit={canManage ? (id) => openEditSheet(tasks.find((t) => t.id === id)!) : undefined}
                      onDelete={canManage ? handleDelete : undefined}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </SectionCard>
        );

      case "today":
        return (
          <SectionCard
            title={SECTION_TITLE.today}
            badge={todayTimedTasks.length + todayUntimedTasks.length}
            collapsed={collapseMap["today"] ?? false}
            onToggleCollapse={() => toggleCollapse("today")}
            dragHandleProps={dragHandleProps}
          >
            {/* Timed tasks — chronological */}
            <AnimatePresence initial={false}>
              {todayTimedTasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40, height: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <TaskCard
                    task={task}
                    onComplete={handleComplete}
                    onDelete={canManage ? handleDelete : undefined}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Divider between timed and untimed */}
            {todayTimedTasks.length > 0 && todayUntimedTasks.length > 0 && (
              <div className="flex items-center gap-2 py-1">
                <div className="h-px flex-1 bg-border/60" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  No time set
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>
            )}

            {/* Untimed tasks for today */}
            <AnimatePresence initial={false}>
              {todayUntimedTasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40, height: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <TaskCard
                    task={task}
                    onComplete={handleComplete}
                    onDelete={canManage ? handleDelete : undefined}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </SectionCard>
        );

      case "unscheduled":
        return (
          <SectionCard
            title={SECTION_TITLE.unscheduled}
            badge={unscheduledTasks.length}
            variant="dim"
            collapsed={collapseMap["unscheduled"] ?? false}
            onToggleCollapse={() => toggleCollapse("unscheduled")}
            dragHandleProps={dragHandleProps}
          >
            <DndContext
              sensors={taskSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleTaskDragEnd}
            >
              <SortableContext
                items={unscheduledTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2.5">
                  {unscheduledTasks.map((task) => (
                    <SortableTaskCard
                      key={task.id}
                      task={task}
                      onComplete={handleComplete}
                      onDelete={canManage ? handleDelete : undefined}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </SectionCard>
        );
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">

      {/* Page header */}
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {formatToday()}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">My Day</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? "Loading your day…"
              : !hasAnything
              ? "All clear — nothing on the schedule."
              : [
                  appointments.length > 0
                    ? `${appointments.length} appointment${appointments.length === 1 ? "" : "s"}`
                    : null,
                  totalTasks > 0
                    ? `${totalTasks} task${totalTasks === 1 ? "" : "s"} remaining`
                    : null,
                ].filter(Boolean).join(" · ")}
          </p>
        </div>
        {canManage && (
          <AddButton
            onClick={() => setActionSheetOpen(true)}
            disabled={!isOnline}
            label="Add task or appointment"
          />
        )}
      </header>

      {/* Progress ring — only when today has tasks */}
      {!isLoading && todayTotal > 0 && (
        <div className="mb-6 flex justify-center">
          <ProgressRing completed={completedToday} total={todayTotal} celebrate={celebrate} />
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-32 animate-pulse rounded-2xl bg-card/70" />
          ))}
        </div>
      )}

      {/* Section cards — drag-to-reorder at section level */}
      {!isLoading && visibleSections.length > 0 && (
        <DndContext
          sensors={sectionSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleSectionDragEnd}
        >
          <SortableContext items={visibleSections} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-5">
              {visibleSections.map((id) => (
                <SortableSection key={id} id={id}>
                  {(dragHandleProps) => renderSection(id, dragHandleProps)}
                </SortableSection>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Empty state */}
      {!isLoading && !hasAnything && (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">No tasks or appointments today. Well done.</p>
        </div>
      )}

      {/* Action type sheet */}
      <ActionTypeSheet
        open={actionSheetOpen}
        onOpenChange={setActionSheetOpen}
        onTask={() => setAddTaskSheetOpen(true)}
        onAppointment={openApptSheet}
      />

      {/* Add Appointment Sheet */}
      <Sheet open={apptSheetOpen} onOpenChange={setApptSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Appointment</SheetTitle>
          </SheetHeader>
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Title</label>
              <input
                type="text"
                value={apptTitle}
                onChange={(e) => setApptTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddAppt()}
                placeholder="e.g. Dr. Smith follow-up"
                className={INPUT}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Date</label>
              <input
                type="date"
                value={apptDate}
                onChange={(e) => setApptDate(e.target.value)}
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Time</label>
              <input
                type="time"
                value={apptTime}
                onChange={(e) => setApptTime(e.target.value)}
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Location
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                type="text"
                value={apptLocation}
                onChange={(e) => setApptLocation(e.target.value)}
                placeholder="e.g. Hoag Medical Center"
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Notes
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea
                value={apptNotes}
                onChange={(e) => setApptNotes(e.target.value)}
                placeholder="e.g. Bring insurance card"
                rows={3}
                className={`${INPUT} resize-none`}
              />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setApptSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleAddAppt} disabled={!apptTitle.trim() || !apptDate || submitting}>
              {submitting ? "Adding…" : "Add Appointment"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit Task Sheet — overdue tasks */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Task</SheetTitle>
          </SheetHeader>
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEditSave()}
                className={INPUT}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Date
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  (leave blank for unscheduled)
                </span>
              </label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Time
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                disabled={!editDate}
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Priority</label>
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value as UITask["priority"])}
                className={INPUT}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={!editTitle.trim() || editSubmitting}>
              {editSubmitting ? "Saving…" : "Save Changes"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Add Task Sheet — shared component, same form as Calendar */}
      <AddTaskSheet
        open={addTaskSheetOpen}
        onOpenChange={setAddTaskSheetOpen}
        defaultDate=""
        isOnline={isOnline}
        onSave={async (title, dueDate, priority) =>
          addTask(title, dueDate, priority, user?.id ?? "")
        }
      />

    </div>
  );
}
