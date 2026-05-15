/**
 * PatientHeroCard.tsx
 * ===================
 * Displays the Care Recipient as a warm, framed-photo-style hero card on
 * My Day. Visually distinct from task/section cards: soft golden wash,
 * heart-icon "Caring for" header, larger photo with warm halo, italicized
 * about blurb.
 *
 * Display modes (controlled by parent via `patientDisplay` preference):
 *   - "prominent": this card is rendered
 *   - "minimal" / "hidden": this card is NOT rendered
 */

import { Pencil, ChevronUp, Heart } from "lucide-react";
import type { Patient } from "@/lib/database.types";

// Same gold accent used across CareSync section headers.
const GOLD = "oklch(0.62 0.13 74)";

interface PatientHeroCardProps {
  patient:    Patient;
  canEdit:    boolean;
  onEdit:     () => void;
  onMinimize: () => void;
}

/** Years-old from an ISO date string. Returns null if dob is missing or invalid. */
function calculateAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 && age < 150 ? age : null;
}

export function PatientHeroCard({ patient, canEdit, onEdit, onMinimize }: PatientHeroCardProps) {
  const displayName = patient.preferred_name?.trim()
    ? patient.preferred_name.trim()
    : `${patient.first_name} ${patient.last_name}`;

  const initials = `${patient.first_name[0] ?? ""}${patient.last_name[0] ?? ""}`.toUpperCase();
  const age      = calculateAge(patient.date_of_birth);
  const hasAnyDetail =
    patient.preferred_name?.trim() ||
    patient.relationship?.trim() ||
    patient.about?.trim() ||
    patient.avatar_url;

  return (
    <div
      className="relative mb-6 overflow-hidden rounded-2xl p-4 backdrop-blur-xl sm:p-5"
      style={{
        background:  "linear-gradient(135deg, oklch(0.62 0.13 74 / 0.10) 0%, var(--card) 65%)",
        border:      "1px solid oklch(0.62 0.13 74 / 0.28)",
        boxShadow:   "0 10px 28px -10px oklch(0.62 0.13 74 / 0.22), var(--card-shadow)",
      }}
    >
      {/* ── Header strip: "Caring for" label + action buttons ───────────── */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Heart className="h-3 w-3" fill={GOLD} style={{ color: GOLD }} />
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: GOLD }}
          >
            Caring for
          </span>
        </div>

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

      {/* ── Main content: photo + person info ──────────────────────────── */}
      <div className="flex items-start gap-4">
        {/* Photo with warm halo (background-coloured separator ring, then gold) */}
        <div className="shrink-0">
          {patient.avatar_url ? (
            <img
              src={patient.avatar_url}
              alt={displayName}
              className="h-20 w-20 rounded-full object-cover"
              style={{
                boxShadow: "0 0 0 2px var(--background), 0 0 0 4px oklch(0.62 0.13 74 / 0.45)",
              }}
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-xl font-semibold text-foreground"
              style={{
                boxShadow: "0 0 0 2px var(--background), 0 0 0 4px oklch(0.62 0.13 74 / 0.45)",
              }}
            >
              {initials}
            </div>
          )}
        </div>

        {/* Text content */}
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-xl font-semibold tracking-tight text-foreground">
            {displayName}
          </p>

          {(patient.relationship?.trim() || age !== null) && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {patient.relationship?.trim() && <span>{patient.relationship}</span>}
              {patient.relationship?.trim() && age !== null && <span className="opacity-50"> · </span>}
              {age !== null && <span>{age} years young</span>}
            </p>
          )}

          {patient.about?.trim() && (
            <p className="mt-2 text-sm italic leading-relaxed text-foreground/75 line-clamp-3">
              &ldquo;{patient.about}&rdquo;
            </p>
          )}

          {!hasAnyDetail && canEdit && (
            <p className="mt-1.5 text-xs text-muted-foreground/70">
              Tap the pencil to add a photo and a few warm details.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
