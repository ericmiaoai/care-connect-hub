import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Users, Plus, ArrowRight, Heart } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------
const CreateCircleSchema = z.object({
  name: z
    .string()
    .min(2, "Care circle name must be at least 2 characters.")
    .max(60, "Keep the name under 60 characters."),
});
type CreateCircleForm = z.infer<typeof CreateCircleSchema>;

const PatientSchema = z.object({
  firstName:   z.string().min(1, "First name is required."),
  lastName:    z.string().min(1, "Last name is required."),
  dateOfBirth: z.string().optional(),
});
type PatientForm = z.infer<typeof PatientSchema>;

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Set Up Your Care Circle — CareSync" },
      { name: "description", content: "Create or join a care circle to get started." },
    ],
  }),
  component: OnboardingPage,
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
type Step = "choose" | "create" | "patient";

function OnboardingPage() {
  const { profile } = useAuth();
  const [step,        setStep]       = useState<Step>("choose");
  const [isLoading,   setIsLoading]  = useState(false);
  const [careCircleId, setCareCircleId] = useState<string | null>(null);

  const circleForm = useForm<CreateCircleForm>({
    resolver: zodResolver(CreateCircleSchema),
    defaultValues: { name: "" },
  });

  const patientForm = useForm<PatientForm>({
    resolver: zodResolver(PatientSchema),
    defaultValues: { firstName: "", lastName: "", dateOfBirth: "" },
  });

  // ── Step 2: Create the care circle ────────────────────────────────────────
  const onCreateSubmit = async (data: CreateCircleForm) => {
    setIsLoading(true);

    const { data: newCircleId, error } = await supabase
      .rpc("create_care_circle", { circle_name: data.name.trim() });

    if (error || !newCircleId) {
      toast.error("Failed to create care circle.", {
        description: error?.message ?? "Please try again.",
      });
      setIsLoading(false);
      return;
    }

    setCareCircleId(newCircleId);
    setIsLoading(false);
    setStep("patient");
  };

  // ── Step 3: Add the care recipient ────────────────────────────────────────
  const onPatientSubmit = async (data: PatientForm) => {
    if (!careCircleId) return;
    setIsLoading(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("patients") as any).insert({
      care_circle_id: careCircleId,
      first_name:     data.firstName.trim(),
      last_name:      data.lastName.trim(),
      date_of_birth:  data.dateOfBirth?.trim() || null,
    });

    if (error) {
      toast.error("Failed to save care recipient.", {
        description: error.message ?? "Please try again.",
      });
      setIsLoading(false);
      return;
    }

    toast.success("You're all set!", {
      description: "Your care circle is ready. Welcome to CareSync.",
    });

    // Hard redirect so useCareCircle reinitializes with fresh data.
    window.location.href = "/";
  };

  const firstName = profile?.first_name ?? "there";

  // ── Step 1: Choose ────────────────────────────────────────────────────────
  if (step === "choose") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--user-mom)] to-[var(--user-nurse)] shadow-lg">
              <Users className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Welcome, {firstName}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                CareSync organizes care within a shared circle.
                <br />
                Create a new one or join an existing circle.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              id="onboarding-create-btn"
              onClick={() => setStep("create")}
              className="group flex items-center justify-between rounded-xl border border-border bg-card px-4 py-4 transition-colors hover:border-border-strong hover:bg-accent"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Plus className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Create a new care circle</p>
                  <p className="text-xs text-muted-foreground">
                    You'll be the admin and can invite others
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>

            {/* Join — MVP stub */}
            <button
              id="onboarding-join-btn"
              disabled
              className="group flex cursor-not-allowed items-center justify-between rounded-xl border border-border bg-card/50 px-4 py-4 opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Join an existing circle</p>
                  <p className="text-xs text-muted-foreground">Invite links — coming soon</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Name the care circle ──────────────────────────────────────────
  if (step === "create") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <button
            onClick={() => setStep("choose")}
            className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back
          </button>

          {/* Step indicator */}
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Step 1 of 2
          </p>

          <div className="mb-8">
            <h1 className="text-xl font-semibold tracking-tight">Name your care circle</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Choose something that identifies the person receiving care.
              You can change this later.
            </p>
          </div>

          <form
            id="create-circle-form"
            onSubmit={circleForm.handleSubmit(onCreateSubmit)}
            className="flex flex-col gap-4"
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="circle-name" className="text-sm font-medium">
                Circle name
              </label>
              <input
                id="circle-name"
                type="text"
                placeholder="e.g. Dad's Care Circle"
                autoFocus
                disabled={isLoading}
                {...circleForm.register("name")}
                className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
              {circleForm.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {circleForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <button
              id="create-circle-submit"
              type="submit"
              disabled={isLoading}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? "Creating…" : "Continue"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Step 3: Who is receiving care? ────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Step indicator */}
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Step 2 of 2
        </p>

        <div className="mb-8 flex flex-col gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--user-mom)] to-[var(--user-nurse)] shadow-md">
            <Heart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Who are you caring for?</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              This helps CareSync personalize your care circle. You can update these details later.
            </p>
          </div>
        </div>

        <form
          id="patient-form"
          onSubmit={patientForm.handleSubmit(onPatientSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="patient-first-name" className="text-sm font-medium">
                First name
              </label>
              <input
                id="patient-first-name"
                type="text"
                autoComplete="off"
                placeholder="Robert"
                autoFocus
                disabled={isLoading}
                {...patientForm.register("firstName")}
                className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
              {patientForm.formState.errors.firstName && (
                <p className="text-xs text-destructive">
                  {patientForm.formState.errors.firstName.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="patient-last-name" className="text-sm font-medium">
                Last name
              </label>
              <input
                id="patient-last-name"
                type="text"
                autoComplete="off"
                placeholder="Smith"
                disabled={isLoading}
                {...patientForm.register("lastName")}
                className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
              {patientForm.formState.errors.lastName && (
                <p className="text-xs text-destructive">
                  {patientForm.formState.errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          {/* Date of birth — optional */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="patient-dob" className="text-sm font-medium">
              Date of birth{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="patient-dob"
              type="date"
              disabled={isLoading}
              {...patientForm.register("dateOfBirth")}
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>

          <button
            id="patient-submit"
            type="submit"
            disabled={isLoading}
            className="mt-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? "Saving…" : "Finish setup"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          No medical information is stored during setup.
        </p>
      </div>
    </div>
  );
}
