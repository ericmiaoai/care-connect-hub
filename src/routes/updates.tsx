import { createFileRoute } from "@tanstack/react-router";
import { UpdateCard } from "@/components/UpdateCard";
import { MOCK_UPDATES } from "@/lib/mock-data";

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

      <div className="flex flex-col gap-3">
        {MOCK_UPDATES.map((u, i) => (
          <UpdateCard key={u.id} update={u} index={i} />
        ))}
      </div>
    </div>
  );
}
