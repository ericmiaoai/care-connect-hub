import { createFileRoute } from "@tanstack/react-router";
import { UpdateCard } from "@/components/UpdateCard";
import { useAuth } from "@/hooks/useAuth";
import { useCareCircle } from "@/hooks/useCareCircle";
import { useBroadcasts } from "@/hooks/useBroadcasts";

export const Route = createFileRoute("/updates")({
  head: () => ({
    meta: [
      { title: "Updates — CareSync" },
      { name: "description", content: "Care coordinator updates and announcements." },
    ],
  }),
  component: UpdatesBoard,
});

function UpdatesBoard() {
  const { user }                       = useAuth();
  const { careCircleId }               = useCareCircle(user?.id);
  const { broadcasts, isLoading, error } = useBroadcasts(careCircleId);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Read only
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Updates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Posts from the care coordinator.
        </p>
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
            <UpdateCard key={u.id} update={u} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
