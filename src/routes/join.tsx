import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Join CareSync" },
      { name: "description", content: "Accept your invitation to join a care circle." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : "",
  }),
  component: JoinPage,
});

type Step = "auth" | "pin";
type AuthMode = "register" | "login";

const INPUT = "w-full rounded-lg border border-border bg-card/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function JoinPage() {
  const { code }                     = Route.useSearch();
  const { user, isLoading: authLoading, signUp, signIn } = useAuth();

  const [step,          setStep]          = useState<Step>("auth");
  const [authMode,      setAuthMode]      = useState<AuthMode>("register");

  // Registration / login fields
  const [firstName,    setFirstName]    = useState("");
  const [lastName,     setLastName]     = useState("");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [authBusy,     setAuthBusy]     = useState(false);
  const [authError,    setAuthError]    = useState<string | null>(null);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  // PIN fields
  const [pin,          setPin]          = useState("");
  const [pinBusy,      setPinBusy]      = useState(false);
  const [pinError,     setPinError]     = useState<string | null>(null);

  // If user is already authenticated when the page loads, skip straight to PIN
  useEffect(() => {
    if (!authLoading && user) setStep("pin");
  }, [user, authLoading]);

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold text-foreground">Invalid invite link</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This link is missing a required code. Ask your admin to send you the invite link again.
          </p>
        </div>
      </div>
    );
  }

  // ── Auth step ──────────────────────────────────────────────────────────────

  const handleAuth = async () => {
    setAuthError(null);
    setAuthBusy(true);

    if (authMode === "register") {
      if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
        setAuthError("Please fill in all fields.");
        setAuthBusy(false);
        return;
      }
      const { error } = await signUp({ email: email.trim(), password, firstName: firstName.trim(), lastName: lastName.trim() });
      if (error) {
        setAuthError(error.message);
        setAuthBusy(false);
        return;
      }
      // If email confirmation is required, user won't be logged in yet
      // Watch for auth state change via useEffect; show waiting message
      setAwaitingConfirm(true);
      // Give the auth state change up to 3 seconds to resolve
      setTimeout(() => {
        setAuthBusy(false);
        // If still not logged in (email confirmation required), show message
        if (!user) setAwaitingConfirm(true);
      }, 3000);
    } else {
      const { error } = await signIn({ email: email.trim(), password });
      if (error) {
        setAuthError(error.message);
        setAuthBusy(false);
        return;
      }
      setAuthBusy(false);
      setStep("pin");
    }
  };

  // ── PIN step ───────────────────────────────────────────────────────────────

  const handleConsumePin = async () => {
    if (pin.length !== 4) return;
    setPinBusy(true);
    setPinError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabase as any)
      .rpc("consume_invite_link", { p_token: code, p_pin: pin });

    if (rpcError) {
      setPinError(rpcError.message);
      setPinBusy(false);
      return;
    }

    toast.success("Welcome to CareSync!");
    // Full page reload so the care circle state is freshly fetched
    window.location.assign("/");
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-foreground" />
      </div>
    );
  }

  // ── Email confirmation waiting state ───────────────────────────────────────

  if (awaitingConfirm && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
            <svg className="h-7 w-7 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Check your email</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
            Click it, then return to this page to enter your PIN.
          </p>
          <button
            type="button"
            onClick={() => { setAwaitingConfirm(false); setStep("pin"); }}
            className="mt-6 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            I've confirmed my email — continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">

      {/* Logo / brand */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <img src="/logo-icon.png" alt="CareSync" className="h-14 w-14 rounded-2xl object-cover" style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.25))" }} />
        <span className="text-lg font-semibold tracking-tight text-foreground">CareSync</span>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-card/60 p-6 shadow-sm backdrop-blur">

        {/* ── Auth step ── */}
        {step === "auth" && (
          <>
            <h1 className="text-base font-semibold text-foreground">
              You've been invited to join a care circle.
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create an account or sign in to accept the invitation.
            </p>

            {/* Toggle tabs */}
            <div className="mt-4 inline-flex w-full rounded-lg border border-border bg-background/40 p-0.5">
              {(["register", "login"] as AuthMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setAuthMode(m); setAuthError(null); }}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                    authMode === m
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "register" ? "New account" : "Sign in"}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {authMode === "register" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-foreground">First name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      className={INPUT}
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-foreground">Last name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Smith"
                      className={INPUT}
                    />
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={INPUT}
                  autoFocus={authMode === "login"}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                  placeholder="••••••••"
                  className={INPUT}
                />
              </div>
            </div>

            {authError && (
              <p className="mt-3 text-xs text-destructive">{authError}</p>
            )}

            <Button
              className="mt-4 w-full"
              onClick={handleAuth}
              disabled={authBusy}
            >
              {authBusy ? "Please wait…" : authMode === "register" ? "Create account" : "Sign in"}
            </Button>
          </>
        )}

        {/* ── PIN step ── */}
        {step === "pin" && (
          <>
            <h1 className="text-base font-semibold text-foreground">Enter your PIN</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your admin shared a 4-digit PIN along with this link. Enter it below to join.
            </p>

            <div className="mt-5 flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">4-digit PIN</label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setPin(v);
                  setPinError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && pin.length === 4 && handleConsumePin()}
                placeholder="0000"
                autoFocus
                className={`${INPUT} text-center text-xl tracking-[0.5em] font-mono`}
              />
            </div>

            {pinError && (
              <p className="mt-3 text-xs text-destructive">{pinError}</p>
            )}

            <Button
              className="mt-4 w-full"
              onClick={handleConsumePin}
              disabled={pin.length !== 4 || pinBusy}
            >
              {pinBusy ? "Verifying…" : "Join care circle"}
            </Button>

            {/* Let user go back if they need to switch accounts */}
            {!user && (
              <button
                type="button"
                onClick={() => setStep("auth")}
                className="mt-3 w-full text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Use a different account
              </button>
            )}
          </>
        )}
      </div>

      <p className="mt-6 text-center text-[11px] text-muted-foreground/60">
        CareSync is an organizational tool, not a substitute for professional medical advice.
      </p>
    </div>
  );
}
