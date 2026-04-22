import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  AlertTriangle, Check, X, CalendarDays, ClipboardList,
  Stethoscope, CheckCircle2, ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { processAVSImage, type AVSContract } from "@/services/VLMService";
import { useAuth } from "@/hooks/useAuth";
import { useCareCircle } from "@/hooks/useCareCircle";
import { Dropzone } from "@/components/Dropzone";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scan AVS — CareSync" },
      {
        name: "description",
        content: "Extract follow-up appointments from an After Visit Summary into your calendar.",
      },
    ],
  }),
  component: ScanAVS,
});

type Phase = "idle" | "scanning" | "review" | "done" | "error";

interface ApprovalSummary {
  appointmentTitles: string[];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ScanAVS() {
  const { user }         = useAuth();
  const { careCircleId } = useCareCircle(user?.id);

  const [phase,     setPhase]     = useState<Phase>("idle");
  const [scanError, setScanError] = useState<string | null>(null);
  const [contract,  setContract]  = useState<AVSContract | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [summary,   setSummary]   = useState<ApprovalSummary | null>(null);

  useEffect(() => {
    if (!careCircleId) return;
    supabase
      .from("patients")
      .select("id")
      .eq("care_circle_id", careCircleId)
      .limit(1)
      .single()
      .then(({ data }) => setPatientId(data?.id ?? null));
  }, [careCircleId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFileSelect = async (file: File) => {
    setPhase("scanning");
    setScanError(null);

    try {
      const base64   = await fileToBase64(file);
      const mimeType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp";
      const result   = await processAVSImage(base64, mimeType);
      setContract(result);
      setPhase("review");
    } catch (err: unknown) {
      setScanError(
        err instanceof Error ? err.message : "Failed to parse AVS. Please try again.",
      );
      setPhase("error");
    }
  };

  const writeAuditRow = async (status: "approved" | "rejected") => {
    if (!careCircleId || !user?.id || !patientId) return;
    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("avs_documents") as any).insert({
      care_circle_id: careCircleId,
      patient_id:     patientId,
      document_label: `AVS Scan — ${contract?.avs_metadata.visit_date ?? now.slice(0, 10)}`,
      visit_date:     contract?.avs_metadata.visit_date ?? null,
      provider_name:  contract?.avs_metadata.provider_name ?? null,
      review_status:  status,
      reviewed_by:    user.id,
      reviewed_at:    now,
      scanned_by:     user.id,
      scanned_at:     now,
    });
  };

  const handleApprove = async () => {
    await writeAuditRow("approved");

    const appointmentTitles: string[] = [];

    if (careCircleId && user?.id && contract && contract.upcoming_appointments.length > 0) {
      const eventsToInsert = contract.upcoming_appointments
        .map((appt) => {
          const dateStr = appt.date_time.replace(/\s+at\s+/gi, " ").trim();
          const start   = new Date(dateStr);
          if (isNaN(start.getTime())) return null;
          const end = new Date(start.getTime() + 60 * 60 * 1000);
          return {
            care_circle_id: careCircleId,
            patient_id:     patientId ?? undefined,
            title:          appt.specialty_or_provider,
            description:    null as null,
            location:       appt.location ?? null,
            start_time:     start.toISOString(),
            end_time:       end.toISOString(),
            created_by:     user.id,
          };
        })
        .filter(Boolean);

      if (eventsToInsert.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("calendar_events") as any).insert(eventsToInsert);
        contract.upcoming_appointments.forEach((appt) =>
          appointmentTitles.push(appt.specialty_or_provider),
        );
      }
    }

    setSummary({ appointmentTitles });
    setPhase("done");
    toast.success("AVS review complete", { duration: 3000 });
  };

  const handleReject = async () => {
    await writeAuditRow("rejected");
    toast("Scan discarded", { duration: 3000 });
    reset();
  };

  const reset = () => {
    setPhase("idle");
    setContract(null);
    setScanError(null);
    setSummary(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Human-in-the-loop
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Scan AVS</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scans an After Visit Summary and adds follow-up appointments to your Calendar.
          Medications and care instructions are shown during review for your reference —
          they are <span className="font-medium text-foreground">not saved</span> to CareSync.
        </p>
      </header>

      {/* ── Done / post-approval summary ───────────────────────────────────── */}
      {phase === "done" && summary && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-400">
                {summary.appointmentTitles.length > 0
                  ? `${summary.appointmentTitles.length} appointment${summary.appointmentTitles.length === 1 ? "" : "s"} added to Calendar`
                  : "No upcoming appointments found in this AVS"}
              </p>
            </div>
            {summary.appointmentTitles.length > 0 && (
              <ul className="flex flex-col gap-1.5 pl-7">
                {summary.appointmentTitles.map((title, i) => (
                  <li key={i} className="text-sm text-foreground/80">
                    {title}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Medications and care instructions from this AVS were shown for reference only
            and were not saved.
          </p>

          <button
            type="button"
            onClick={reset}
            className="touch-target flex items-center justify-center gap-2 rounded-xl border border-border bg-transparent px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <ScanLine className="h-4 w-4" />
            Scan Another AVS
          </button>
        </div>
      )}

      {/* ── Idle / upload ──────────────────────────────────────────────────── */}
      {(phase === "idle" || phase === "scanning" || phase === "error") && (
        <>
          <Dropzone loading={phase === "scanning"} onFileSelect={handleFileSelect} />

          {phase === "error" && scanError && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-400">Parsing failed</p>
                <p className="mt-0.5 text-xs text-red-400/80">{scanError}</p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-2 text-xs text-red-400 underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Review ─────────────────────────────────────────────────────────── */}
      {phase === "review" && contract && (
        <>
          {/* HITL warning */}
          <div className="mt-6 mb-5 flex items-start gap-2 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
            <p className="text-xs leading-relaxed text-foreground/90">
              Verify appointments against the physical AVS before approving. CareSync does
              not validate clinical accuracy.
            </p>
          </div>

          {/* Metadata */}
          <div className="mb-5 rounded-xl border border-border bg-card p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Document metadata
            </p>
            <p className="text-sm font-medium text-foreground">
              {contract.avs_metadata.provider_name || "Provider not detected"}
            </p>
            <p className="text-xs text-muted-foreground">
              Visit date: {contract.avs_metadata.visit_date || "Not detected"}
            </p>
          </div>

          {/* Upcoming appointments — SAVED on approve */}
          {contract.upcoming_appointments.length > 0 && (
            <section className="mb-5">
              <div className="mb-2 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold tracking-tight">Upcoming Appointments</h2>
                <span className="ml-auto rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                  Saved to Calendar on approve
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {contract.upcoming_appointments.map((appt, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card px-4 py-3">
                    <p className="text-sm font-medium text-foreground">
                      {appt.specialty_or_provider}
                    </p>
                    <p className="text-xs text-muted-foreground">{appt.date_time}</p>
                    {appt.location && (
                      <p className="text-xs text-muted-foreground">{appt.location}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Medications — reference only, not saved */}
          {contract.medications.length > 0 && (
            <section className="mb-5">
              <div className="mb-2 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold tracking-tight">Medications</h2>
                <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Not saved to CareSync
                </span>
              </div>
              <ul className="rounded-xl border border-border bg-card divide-y divide-border">
                {contract.medications.map((med, i) => (
                  <li key={i} className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground">
                      {med.name}
                      {med.dosage && (
                        <span className="font-normal text-muted-foreground"> · {med.dosage}</span>
                      )}
                    </p>
                    {med.frequency && (
                      <p className="text-xs text-muted-foreground">{med.frequency}</p>
                    )}
                    {med.reason && (
                      <p className="text-xs text-muted-foreground">{med.reason}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Care instructions — reference only, not saved */}
          {contract.care_instructions.length > 0 && (
            <section className="mb-5">
              <div className="mb-2 flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold tracking-tight">Care Instructions</h2>
                <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Not saved to CareSync
                </span>
              </div>
              <ul className="rounded-xl border border-border bg-card divide-y divide-border">
                {contract.care_instructions.map((instruction, i) => (
                  <li key={i} className="px-4 py-2.5 text-sm text-foreground/90">
                    {instruction}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Action bar */}
          <div className="sticky bottom-20 mt-6 flex flex-col gap-2 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur md:bottom-4 md:flex-row">
            <button
              type="button"
              onClick={handleReject}
              className="touch-target flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-transparent px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <X className="h-4 w-4" />
              Reject
            </button>
            <button
              type="button"
              onClick={handleApprove}
              className="touch-target flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[var(--success)] px-4 text-base font-semibold text-[var(--success-foreground)] shadow-sm transition-opacity hover:opacity-90"
            >
              <Check className="h-5 w-5" />
              Approve & Add Appointments to Calendar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
