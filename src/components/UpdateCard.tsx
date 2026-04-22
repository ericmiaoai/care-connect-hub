import { motion } from "framer-motion";
import type { StatusUpdate } from "@/lib/mock-data";
import { UserDot } from "./UserDot";

interface UpdateCardProps {
  update: StatusUpdate;
  index: number;
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
        <UserDot userId={update.author} size="md" />
        <span className="text-sm font-medium text-foreground">{update.authorName}</span>
        <span className="ml-auto text-xs text-muted-foreground">{update.timeAgo}</span>
      </header>
      <p className="text-sm leading-relaxed text-foreground/90">{update.body}</p>
    </motion.article>
  );
}
