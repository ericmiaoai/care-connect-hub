import { motion } from "framer-motion";
import type { UIBroadcast } from "@/lib/adapters";
import { cn } from "@/lib/utils";

const SEVERITY_BADGE: Record<UIBroadcast["severity"], string> = {
  info:     "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  warning:  "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  critical: "bg-red-500/10  text-red-400  border border-red-500/20",
};

const SEVERITY_LABEL: Record<UIBroadcast["severity"], string> = {
  info:     "Info",
  warning:  "Warning",
  critical: "Critical",
};

interface UpdateCardProps {
  update: UIBroadcast;
  index:  number;
}

function AuthorAvatar({ name }: { name: string | null }) {
  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
      {initials}
    </span>
  );
}

export function UpdateCard({ update, index }: UpdateCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25, ease: "easeOut" }}
      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <header className="mb-2 flex items-center gap-2">
        <AuthorAvatar name={update.authorName} />
        <span className="text-sm font-medium text-foreground">
          {update.authorName ?? "Care Coordinator"}
        </span>
        <span
          className={cn(
            "ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
            SEVERITY_BADGE[update.severity],
          )}
        >
          {SEVERITY_LABEL[update.severity]}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{update.timeAgo}</span>
      </header>
      <h3 className="mb-1 text-sm font-semibold text-foreground">{update.title}</h3>
      <p className="text-sm leading-relaxed text-foreground/80">{update.content}</p>
    </motion.article>
  );
}
