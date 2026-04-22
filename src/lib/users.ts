export type UserId = "mom" | "dad" | "nurse" | "sister" | "admin";

export interface User {
  id: UserId;
  name: string;
  role: string;
  /** Tailwind background utility for avatar dot — uses CSS var token */
  dotClass: string;
  /** Tailwind border-left utility for card accent */
  borderClass: string;
  /** Soft tint background */
  tintClass: string;
}

export const USERS: Record<UserId, User> = {
  mom: {
    id: "mom",
    name: "Mom",
    role: "Primary Caregiver",
    dotClass: "bg-[var(--user-mom)]",
    borderClass: "border-l-[var(--user-mom)]",
    tintClass: "bg-[var(--user-mom)]/10",
  },
  dad: {
    id: "dad",
    name: "Dad",
    role: "Patient",
    dotClass: "bg-[var(--user-dad)]",
    borderClass: "border-l-[var(--user-dad)]",
    tintClass: "bg-[var(--user-dad)]/10",
  },
  nurse: {
    id: "nurse",
    name: "Nurse Kim",
    role: "Home Health Nurse",
    dotClass: "bg-[var(--user-nurse)]",
    borderClass: "border-l-[var(--user-nurse)]",
    tintClass: "bg-[var(--user-nurse)]/10",
  },
  sister: {
    id: "sister",
    name: "Sister",
    role: "Family",
    dotClass: "bg-[var(--user-sister)]",
    borderClass: "border-l-[var(--user-sister)]",
    tintClass: "bg-[var(--user-sister)]/10",
  },
  admin: {
    id: "admin",
    name: "Admin",
    role: "Care Coordinator",
    dotClass: "bg-[var(--user-admin)]",
    borderClass: "border-l-[var(--user-admin)]",
    tintClass: "bg-[var(--user-admin)]/10",
  },
};

export const userList = Object.values(USERS);
