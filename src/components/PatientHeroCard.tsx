/**
 * PatientHeroCard.tsx
 * ===================
 * Editorial-style display of the Care Recipient at the top of My Day.
 * Intentionally NOT a card: no border, no fill, no shadow — just typography,
 * a softly-glowing photo, and a small "Caring for" label that disambiguates
 * "this is the patient, not you."
 *
 * Visual design notes:
 *   - Photo has a soft golden glow (boxShadow) instead of a ring or card edge,
 *     so it reads as a "framed family photo on a desk" rather than a UI tile
 *   - Name uses display-weight typography (text-2xl, tracking-tight)
 *   - About blurb is italic with curly quotes — reads as personality
 *   - Generous bottom margin separates from the task sections below
 *
 * Display modes (controlled by parent via `patientDisplay` preference):
 *   - "prominent": this hero is rendered
 *   - "minimal" / "hidden": this hero is NOT rendered (sidebar handles it)
 */

import { Pencil, ChevronUp, Heart } from "lucide-react";
import type { Patient } from "@/lib/database.types";

// Same gold accent used across CareSync section headers and the sidebar strip.
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
    <section className="mb-12 pt-4 sm:mb-14 sm:pt-6" aria-label="Care recipient">
      {/* ── Header strip: "Caring for" label + action buttons ──────────── */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4" fill={GOLD} style={{ color: GOLD }} />
          <span
            className="text-xs font-semibold uppercase tracking-[0.18em]"
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
            aria-label="Minimize care recipient"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Person: photo + name + relationship + about ────────────────── */}
      <div className="flex items-start gap-4">
        {/* Photo with a soft gold glow — no ring, no card edge */}
        <div className="shrink-0">
          {patient.avatar_url ? (
            <img
              src={patient.avatar_url}
              alt={displayName}
              className="h-20 w-20 rounded-full object-cover"
              style={{ boxShadow: "0 0 22px -2px oklch(0.62 0.13 74 / 0.35)" }}
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-xl font-semibold text-foreground"
              style={{ boxShadow: "0 0 22px -2px oklch(0.62 0.13 74 / 0.35)" }}
            >
              {initials}
            </div>
          )}
        </div>

        {/* Text content — typography is intentionally subordinate to the page
            greeting above ("Good morning, Eric"). The greeting uses
            text-2xl + font-semibold + tracking-tight; this uses smaller size,
            lighter weight, and default tracking to establish hierarchy. */}
        <div className="min-w-0 flex-1 pt-2">
          <h2 className="truncate text-lg font-medium text-foreground">
            {displayName}
          </h2>

          {(patient.relationship?.trim() || age !== null) && (
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {patient.relationship?.trim() && <span>{patient.relationship}</span>}
              {patient.relationship?.trim() && age !== null && <span className="opacity-50"> · </span>}
              {age !== null && <span>{age} years young</span>}
            </p>
          )}

          {patient.about?.trim() && (
            <p className="mt-3 text-sm italic leading-relaxed text-foreground/70 line-clamp-3">
              &ldquo;{patient.about}&rdquo;
            </p>
          )}

          {!hasAnyDetail && canEdit && (
            <p className="mt-2 text-xs text-muted-foreground/70">
              Tap the pencil to add a photo and a few warm details.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
