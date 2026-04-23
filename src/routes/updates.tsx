import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { UpdateCard } from "@/components/UpdateCard";
import { useAuth } from "@/hooks/useAuth";
import { useCareCircle } from "@/hooks/useCareCircle";
import { useBroadcasts } from "@/hooks/useBroadcasts";
import { can } from "@/lib/permissions";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { UIBroadcast } from "@/lib/adapters";

export const Route = createFileRoute("/updates")({
  head: () => ({
    meta: [
      { title: "Updates — CareSync" },
      { name: "description", content: "Care coordinator updates and announcements." },
    ],
  }),
  component: UpdatesBoard,
});

const INPUT = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function UpdatesBoard() {
  const { user }               = useAuth();
  const { careCircleId, role } = useCareCircle(user?.id);
  const { broadcasts, isLoading, error, postBroadcast, deleteBroadcast } = useBroadcasts(careCircleId);

  const [sheetOpen,    setSheetOpen]    = useState(false);
  const [formTitle,    setFormTitle]    = useState("");
  const [formContent,  setFormContent]  = useState("");
  const [formSeverity, setFormSeverity] = useState<UIBroadcast["severity"]>("info");
  const [submitting,   setSubmitting]   = useState(false);

  const canPost   = can(role, "post_updates");
  const canDelete = can(role, "delete_updates");

  const openSheet = () => {
    setFormTitle("");
    setFormContent("");
    setFormSeverity("info");
    setSheetOpen(true);
  };

  const handlePost = async () => {
    if (!formTitle.trim() || !formContent.trim() || !user) return;
    setSubmitting(true);
    const { error: postError } = await postBroadcast(
      user.id, formTitle.trim(), formContent.trim(), formSeverity,
    );
    setSubmitting(false);
    if (postError) {
      toast.error("Failed to post update", { description: postError });
    } else {
      setSheetOpen(false);
      toast.success("Update posted");
    }
  };

  const handleDelete = async (id: string) => {
    await deleteBroadcast(id);
    toast.success("Update deleted");
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {canPost ? "Admin" : "Read only"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Updates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {canPost
              ? "Post and manage care circle announcements."
              : "Posts from the care coordinator."}
          </p>
        </div>
        {canPost && (
          <button
            type="button"
            onClick={openSheet}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-card px-3 py-2 text-sm font-medium text-foreground ring-1 ring-border transition-colors hover:bg-accent"
          >
            <Plus className="h-4 w-4" />
            Post Update
          </button>
        )}
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          Loading updates…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {!isLoading && !error && broadcasts.length === 0 && (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          No updates yet.
        </div>
      )}

      {!isLoading && !error && broadcasts.length > 0 && (
        <div className="flex flex-col gap-3">
          {broadcasts.map((u, i) => (
            <UpdateCard
              key={u.id}
              update={u}
              index={i}
              onDelete={canDelete ? () => handleDelete(u.id) : undefined}
            />
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Post Update</SheetTitle>
          </SheetHeader>
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Appointment rescheduled"
                className={INPUT}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Severity</label>
              <select
                value={formSeverity}
                onChange={(e) => setFormSeverity(e.target.value as UIBroadcast["severity"])}
                className={INPUT}
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Message</label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Write your update here…"
                rows={5}
                className={`${INPUT} resize-none`}
              />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button
              onClick={handlePost}
              disabled={!formTitle.trim() || !formContent.trim() || submitting}
            >
              {submitting ? "Posting…" : "Post Update"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
