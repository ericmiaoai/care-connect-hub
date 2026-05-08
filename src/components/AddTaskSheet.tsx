import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { UITask } from "@/lib/adapters";

const INPUT = "rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export interface TaskMember {
  userId:    string;
  firstName: string;
  lastName:  string;
  avatarUrl: string | null;
}

interface AddTaskSheetProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
  isOnline?:    boolean;
  members?:     TaskMember[];
  onSave:       (title: string, dueDate: string | null, priority: UITask["priority"], assignedTo: string | null) => Promise<{ error: string | null }>;
}

export function AddTaskSheet({
  open, onOpenChange, defaultDate = "", isOnline = true, members = [], onSave,
}: AddTaskSheetProps) {
  const [title,      setTitle]      = useState("");
  const [date,       setDate]       = useState(defaultDate);
  const [time,       setTime]       = useState("");
  const [priority,   setPriority]   = useState<UITask["priority"]>("medium");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDate(defaultDate);
      setTime("");
      setPriority("medium");
      setAssignedTo("");
    }
  }, [open, defaultDate]);

  const handleSave = async () => {
    if (!isOnline) { toast.error("You're offline — reconnect to make changes."); return; }
    if (!title.trim()) return;
    setSubmitting(true);
    const dueDate: string | null = date
      ? (time ? new Date(`${date}T${time}:00`).toISOString() : date)
      : null;
    const { error } = await onSave(title.trim(), dueDate, priority, assignedTo || null);
    setSubmitting(false);
    if (error) toast.error("Failed to add task", { description: error });
    else { onOpenChange(false); toast.success("Task added"); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add Task</SheetTitle>
        </SheetHeader>
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="e.g. Morning medication"
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
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={!date}
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as UITask["priority"])}
              className={INPUT}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          {members.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Assign to
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className={INPUT}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.firstName} {m.lastName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim() || submitting}>
            {submitting ? "Adding…" : "Add Task"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
