import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const LoginSchema = z.object({
  email:    z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});
type LoginForm = z.infer<typeof LoginSchema>;

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — CareSync" },
      { name: "description", content: "Sign in to your CareSync care circle." },
    ],
  }),
  component: LoginPage,
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
function LoginPage() {
  const { signIn }   = useAuth();
  const navigate     = useNavigate();
  const [isLoading, setIsLoading]             = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [loginError, setLoginError]           = useState<string | null>(null);
  const [resending, setResending]             = useState(false);
  // Cooldown countdown in seconds (0 = can resend)
  const [resendCooldown, setResendCooldown]   = useState(0);

  // Count down the cooldown timer each second
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = useCallback(async () => {
    if (!unverifiedEmail || resendCooldown > 0) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type:  "signup",
      email: unverifiedEmail,
    });
    setResending(false);
    if (error) {
      toast.error("Could not resend", { description: error.message });
    } else {
      toast.success("Verification email sent!", {
        description: `A fresh link has been sent to ${unverifiedEmail}.`,
      });
      // Start 60-second cooldown to prevent spam
      setResendCooldown(60);
    }
  }, [unverifiedEmail, resendCooldown]);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setUnverifiedEmail(null);
    setLoginError(null);
    const { error } = await signIn({ email: data.email, password: data.password });
    setIsLoading(false);

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";

      // Unconfirmed email
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        setUnverifiedEmail(data.email);
        return;
      }

      // Wrong email or password
      if (msg.includes("invalid login credentials") || msg.includes("invalid email or password")) {
        setLoginError("Incorrect email or password. Please try again.");
        return;
      }

      // Unexpected error — fall back to toast
      toast.error("Sign in failed", {
        description: error.message ?? "Something went wrong. Please try again.",
      });
      return;
    }

    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <img src="/logo-icon.png" alt="CareSync" className="h-14 w-14 rounded-2xl object-cover" style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.25))" }} />
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">CareSync</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to your care circle</p>
          </div>
        </div>

        {/* Form */}
        {/* Unverified email banner */}
        {unverifiedEmail && (
          <div
            id="unverified-email-banner"
            role="alert"
            className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3"
          >
            <p className="text-sm font-medium text-warning">Check your inbox</p>
            <p className="mt-1 text-xs text-warning/80">
              We sent a confirmation link to{" "}
              <span className="font-medium">{unverifiedEmail}</span>.
              Please click that link to verify your account, then try signing in again.
            </p>
            <p className="mt-1 text-[11px] text-warning/60">
              Confirmation links expire after 15 minutes.
            </p>
            {/* Resend button */}
            <button
              id="resend-verification-btn"
              type="button"
              onClick={handleResend}
              disabled={resending || resendCooldown > 0}
              className="mt-2.5 text-xs font-medium text-warning underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resending
                ? "Sending…"
                : resendCooldown > 0
                ? `Resend available in ${resendCooldown}s`
                : "Resend the verification link"}
            </button>
          </div>
        )}

        {/* Invalid credentials banner */}
        {loginError && (
          <div
            id="login-error-banner"
            role="alert"
            className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3"
          >
            <p className="text-sm font-medium text-destructive">Incorrect email or password</p>
            <p className="mt-0.5 text-xs text-destructive/80">
              Please double-check your email address and password and try again.
            </p>
          </div>
        )}

        <form
          id="login-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              disabled={isLoading}
              {...register("email")}
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={isLoading}
              {...register("password")}
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {/* Submit */}
          <button
            id="login-submit"
            type="submit"
            disabled={isLoading}
            className="mt-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to CareSync?{" "}
          <Link to="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>

        {/* Disclaimer */}
        <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground/70">
          CareSync is an organizational tool, not a substitute for professional medical advice.
        </p>
      </div>
    </div>
  );
}
