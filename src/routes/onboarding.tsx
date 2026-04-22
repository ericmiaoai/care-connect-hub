import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Users, Plus, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const CreateCircleSchema = z.object({
  name: z
    .string()
    .min(2, "Care circle name must be at least 2 characters.")
    .max(60, "Keep the name under 60 characters."),
});
type CreateCircleForm = z.infer<typeof CreateCircleSchema>;

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
type Step = "choose" | "create";

function OnboardingPage() {
  const { profile } = useAuth();
  const [step, setStep]    = useState<Step>("choose");
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<CreateCircleForm>({
    resolver: zodResolver(CreateCircleSchema),
    defaultValues: { name: "" },
  });

  // ── Create a new care circle ───────────────────────────────────────────────
  const onCreateSubmit = async (data: CreateCircleForm) => {
    setIsLoading(true);

    // Use a single RPC call that atomically creates the circle AND adds the
    // user as admin in one transaction. This avoids the circular RLS issue
    // where we can't SELECT the new circle until we're a member, but we
    // need the circle ID to become a member.
    const { data: newCircleId, error } = await supabase
      .rpc("create_care_circle", { circle_name: data.name.trim() });

    if (error || !newCircleId) {
      toast.error("Failed to create care circle.", {
        description: error?.message ?? "Please try again.",
      });
      setIsLoading(false);
      return;
    }

    toast.success(`"${data.name}" is ready!`, {
      description: "Your care circle has been created. Welcome to CareSync.",
    });

    // Hard redirect so the root component fully reinitializes and
    // useCareCircle fetches fresh data instead of returning its stale null.
    window.location.href = "/";
  };

  const firstName = profile?.first_name ?? "there";

  // ── Step: Choose ──────────────────────────────────────────────────────────
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
            {/* Create new circle */}
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

            {/* Join existing circle — MVP stub */}
            <button
              id="onboarding-join-btn"
              disabled
              className="group flex items-center justify-between rounded-xl border border-border bg-card/50 px-4 py-4 opacity-50 cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Join an existing circle</p>
                  <p className="text-xs text-muted-foreground">
                    Invite links — coming soon
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Create ──────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <button
          onClick={() => setStep("choose")}
          className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back
        </button>

        <div className="mb-8">
          <h1 className="text-xl font-semibold tracking-tight">Name your care circle</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Choose something that identifies the person receiving care.
            <br />
            You can change this later.
          </p>
        </div>

        <form
          id="create-circle-form"
          onSubmit={handleSubmit(onCreateSubmit)}
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
              {...register("name")}
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <button
            id="create-circle-submit"
            type="submit"
            disabled={isLoading}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? "Creating…" : "Create care circle"}
          </button>
        </form>
      </div>
    </div>
  );
}
