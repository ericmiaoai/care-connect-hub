import { CalendarDays, ClipboardList } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface ActionTypeSheetProps {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  onTask:        () => void;
  onAppointment: () => void;
}

export function ActionTypeSheet({ open, onOpenChange, onTask, onAppointment }: ActionTypeSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-10">
        <SheetHeader className="mb-6 text-left">
          <SheetTitle>What would you like to add?</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => { onOpenChange(false); onTask(); }}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">New Task</p>
              <p className="text-sm text-muted-foreground">Add a medication, errand, or care to-do</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { onOpenChange(false); onAppointment(); }}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">New Appointment</p>
              <p className="text-sm text-muted-foreground">Schedule a doctor visit or follow-up</p>
            </div>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
