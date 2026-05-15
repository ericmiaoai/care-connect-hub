/**
 * PatientHeroCard.tsx
 * ===================
 * Displays the Care Recipient (photo, name, relationship, about) as a warm,
 * emotionally-anchoring hero card on My Day. Tap the card or the pencil icon
 * to open the edit sheet (admin only).
 *
 * Display modes are controlled by the user's `patientDisplay` preference:
 *   - "prominent": this full card is rendered
 *   - "minimal":   this card is NOT rendered (sidebar strip handles it)
 *   - "hidden":    this card is NOT rendered
 *
 * Rendering decisions live in the parent (index.tsx) — this component just
 * shows the data when asked.
 */

import { Pencil, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Patient } from "@/lib/database.types";

interface PatientHeroCardProps {
  patient:    Patient;
  canEdit:    boolean;
  onEdit:     () => void;
  onMinimize: () => void;
}

export function PatientHeroCard({ patient, canEdit, onEdit, onMinimize }: PatientHeroCardProps) {
  const displayName = patient.preferred_name?.trim()
    ? patient.preferred_name.trim()
    : `${patient.first_name} ${patient.last_name}`;

  const initials = `${patient.first_name[0] ?? ""}${patient.last_name[0] ?? ""}`.toUpperCase();

  return (
    <div
      className="relative mb-6 overflow-hidden rounded-2xl border border-border/60 bg-card/85 px-4 py-4 backdrop-blur-xl"
      style={{ boxShadow: "var(--card-shadow-lg)" }}
    >
      <div className="flex items-start gap-4">
        {/* Photo */}
        <div className="shrink-0">
          {patient.avatar_url ? (
            <img
              src={patient.avatar_url}
              alt={displayName}
              className="h-16 w-16 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-lg font-semibold text-foreground ring-2 ring-border">
              {initials}
            </div>
          )}
        </div>

        {/* Text content */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-foreground">{displayName}</p>
          {patient.relationship?.trim() && (
            <p className="truncate text-sm text-muted-foreground">{patient.relationship}</p>
          )}
          {patient.about?.trim() && (
            <p className={cn(
              "mt-1.5 text-xs leading-relaxed text-foreground/70",
              "line-clamp-3",
            )}>
              {patient.about}
            </p>
          )}
          {/* Gentle prompt when admin hasn't filled anything in yet */}
          {!patient.preferred_name && !patient.relationship && !patient.about && !patient.avatar_url && canEdit && (
            <p className="mt-1 text-xs text-muted-foreground/70">
              Tap the pencil to add a photo and a few warm details.
            </p>
          )}
        </div>

        {/* Action buttons — minimize + edit */}
        <div className="flex shrink-0 items-center gap-0.5">
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              title="Edit care recipient"
              aria-label="Edit care recipient"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onMinimize}
            title="Minimize"
            aria-label="Minimize care recipient card"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
