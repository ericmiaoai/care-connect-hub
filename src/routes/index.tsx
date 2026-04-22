import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { TaskCard } from "@/components/TaskCard";
import { useAuth } from "@/hooks/useAuth";
import { useCareCircle } from "@/hooks/useCareCircle";
import { useTasks } from "@/hooks/useTasks";

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

function MyDay() {
  const { user }                 = useAuth();
  const { careCircleId }         = useCareCircle(user?.id);
  const { tasks, isLoading, completeTask, restoreTask } = useTasks(careCircleId);

  const handleComplete = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    // Optimistic removal happens inside completeTask()
    await completeTask(id);

    toast.success("Task completed", {
      description: `${task.time} · ${task.title}`,
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => restoreTask(id),
      },
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="mb-6">
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
      </header>

      {/* Loading skeleton */}
      {isLoading && (
        <ol className="flex flex-col gap-2.5">
          {[1, 2, 3].map((n) => (
            <li key={n} className="h-16 animate-pulse rounded-xl bg-card" />
          ))}
        </ol>
      )}

      {/* Live task list */}
      {!isLoading && (
        <ol className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {tasks.map((task) => (
              <motion.li
                key={task.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40, height: 0, marginTop: 0, marginBottom: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <TaskCard task={task} onComplete={handleComplete} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}

      {/* Empty state */}
      {!isLoading && tasks.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">No more tasks today. Well done.</p>
        </div>
      )}
    </div>
  );
}
