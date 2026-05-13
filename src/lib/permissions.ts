import type { CareCircleRole } from "@/lib/database.types";

export type Permission =
  | "manage_tasks"
  | "manage_events"
  | "post_updates"
  | "delete_updates"
  | "scan_avs";

export function can(role: CareCircleRole | null, permission: Permission): boolean {
  if (!role) return false;
  switch (permission) {
    case "manage_tasks":
    case "manage_events":
    case "scan_avs":
      return role === "admin" || role === "collaborator";
    case "post_updates":
    case "delete_updates":
      return role === "admin";
  }
}
