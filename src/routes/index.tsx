import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useState } from "react";
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
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { can } from "@/lib/permissions";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { UITask } from "@/lib/adapters";

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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "My Day — CareSync" },
      { name: "description", content: "Today's medications, appointments, and care tasks." },
    ],
  }),
  component: MyDay,
});

function formatToday(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month:   "long",
    day:     "numeric",
  });
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const INPUT = "rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function MyDay() {
  const { user }               = useAuth();
  const { careCircleId, role } = useCareCircle(user?.id);
  const { tasks, isLoading, completeTask, restoreTask, addTask, deleteTask, reorderTasks } = useTasks(careCircleId);
  const isOnline = useOnlineStatus();

  const [sheetOpen,    setSheetOpen]    = useState(false);
  const [formTitle,    setFormTitle]    = useState("");
  const [formDate,     setFormDate]     = useState(todayISO());
  const [formPriority, setFormPriority] = useState<UITask["priority"]>("medium");
  const [submitting,   setSubmitting]   = useState(false);

  const canManage = can(role, "manage_tasks");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const timedTasks   = tasks
    .filter((t) => t.hasTime)
    .sort((a, b) => (a.rawDueDate ?? "").localeCompare(b.rawDueDate ?? ""));
  const untimedTasks = tasks
    .filter((t) => !t.hasTime)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!isOnline) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = untimedTasks.findIndex((t) => t.id === active.id);
    const newIndex  = untimedTasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(untimedTasks, oldIndex, newIndex);
    await reorderTasks(reordered.map((t) => t.id));
  };

  const handleComplete = async (id: string) => {
    if (!isOnline) { toast.error("You're offline — reconnect to make changes."); return; }
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    await completeTask(id);
    toast.success("Task completed", {
      description: `${task.time} · ${task.title}`,
      duration: 5000,
      action: { label: "Undo", onClick: () => restoreTask(id) },
    });
  };

  const handleDelete = async (id: string) => {
    if (!isOnline) { toast.error("You're offline — reconnect to make changes."); return; }
    const task = tasks.find((t) => t.id === id);
    await deleteTask(id);
    if (task) toast.success(`"${task.title}" deleted`);
  };

  const openSheet = () => {
    setFormTitle("");
    setFormDate(todayISO());
    setFormPriority("medium");
    setSheetOpen(true);
  };

  const handleAdd = async () => {
    if (!isOnline) { toast.error("You're offline — reconnect to make changes."); return; }
    if (!formTitle.trim()) return;
    setSubmitting(true);
    const { error } = await addTask(formTitle.trim(), formDate, formPriority, user?.id ?? "");
    setSubmitting(false);
    if (error) {
      toast.error("Failed to add task", { description: error });
    } else {
      setSheetOpen(false);
      toast.success("Task added");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {formatToday()}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">My Day</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? "Loading your tasks…"
              : tasks.length === 0
              ? "All clear. Take a breath."
              : `${tasks.length} task${tasks.length === 1 ? "" : "s"} remaining`}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openSheet}
            disabled={!isOnline}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-card px-3 py-2 text-sm font-medium text-foreground ring-1 ring-border transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            Add Task
          </button>
        )}
      </header>

      {isLoading && (
        <ol className="flex flex-col gap-2.5">
          {[1, 2, 3].map((n) => (
            <li key={n} className="h-16 animate-pulse rounded-xl bg-card" />
          ))}
        </ol>
      )}

      {!isLoading && (
        <div className="flex flex-col gap-2.5">

          {/* Timed tasks — fixed chronological order */}
          <AnimatePresence initial={false}>
            {timedTasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40, height: 0, marginTop: 0, marginBottom: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <TaskCard
                  task={task}
                  onComplete={handleComplete}
                  onDelete={canManage ? handleDelete : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Divider */}
          {timedTasks.length > 0 && untimedTasks.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Unscheduled</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}

          {/* Untimed tasks — drag-to-reorder */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={untimedTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2.5">
                {untimedTasks.map((task) => (
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

        </div>
      )}

      {!isLoading && tasks.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">No more tasks today. Well done.</p>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Task</SheetTitle>
          </SheetHeader>
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="e.g. Morning medication"
                className={INPUT}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Date</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Priority</label>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as UITask["priority"])}
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
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!formTitle.trim() || submitting}>
              {submitting ? "Adding…" : "Add Task"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
