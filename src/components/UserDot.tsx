import { USERS, type UserId } from "@/lib/users";
import { cn } from "@/lib/utils";

interface UserDotProps {
  userId: UserId;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
};

export function UserDot({ userId, size = "md", showName, className }: UserDotProps) {
  const user = USERS[userId];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        aria-hidden
        className={cn("rounded-full ring-2 ring-background", sizeMap[size], user.dotClass)}
      />
      {showName && <span className="text-xs text-muted-foreground">{user.name}</span>}
    </span>
  );
}
