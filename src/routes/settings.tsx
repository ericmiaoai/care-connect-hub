import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Check, ChevronRight, Palette, Users, LogOut, Share2, Trash2, KeyRound, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { THEMES, type Theme } from "@/lib/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useCareCircle } from "@/hooks/useCareCircle";
import { useMembers } from "@/hooks/useMembers";
import { supabase } from "@/lib/supabaseClient";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CareSync" },
      { name: "description", content: "Customize your CareSync experience." },
    ],
  }),
  component: SettingsPage,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  admin:        "Admin",
  collaborator: "Caregiver",
  viewer:       "Viewer",
};

function expiresIn(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / 3_600_000);
  if (hours > 0) return `${hours}h remaining`;
  const mins = Math.floor(diff / 60_000);
  return `${mins}m remaining`;
}

function avatarColor(name: string): string {
  const colors = [
    "bg-[var(--user-mom)]",
    "bg-[var(--user-nurse)]",
    "bg-[var(--user-sister)]",
    "bg-[var(--user-dad)]",
    "bg-[var(--user-admin)]",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

// ── Theme swatch ──────────────────────────────────────────────────────────────

const SWATCH_STYLE: Record<Theme, React.CSSProperties> = {
  black: { background: "#0a0a0b" },
  gray:  { background: "radial-gradient(ellipse at 22% 20%, #3a3d47 0%, #22242c 50%, #111318 100%)" },
  light: { background: "#f5f5f6" },
  blue:  { background: "linear-gradient(175deg, #3d6dd0 0%, #1e3a9e 45%, #0d1462 100%)" },
};

function ThemeSwatch({ id, label }: { id: Theme; label: string }) {
  const { theme, setTheme } = useTheme();
  const isActive = theme === id;
  const isLight  = id === "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(id)}
      className={cn(
        "group flex flex-col items-center gap-2 rounded-xl p-2 transition-colors",
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive && "bg-accent",
      )}
    >
      <div
        className={cn(
          "relative h-20 w-full max-w-[88px] overflow-hidden rounded-lg border-2 transition-colors",
          isActive ? "border-primary" : "border-border",
        )}
        style={SWATCH_STYLE[id]}
      >
        <div className="absolute inset-x-3 top-3 flex flex-col gap-1.5">
          <div className="h-1.5 w-3/4 rounded-full opacity-30" style={{ background: isLight ? "#000" : "#fff" }} />
          <div className="h-1 w-1/2 rounded-full opacity-20"   style={{ background: isLight ? "#000" : "#fff" }} />
          <div className="mt-1 h-6 w-full rounded opacity-15"  style={{ background: isLight ? "#000" : "#fff" }} />
          <div className="h-4 w-full rounded opacity-10"        style={{ background: isLight ? "#000" : "#fff" }} />
        </div>
        {isActive && (
          <div className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow-sm">
            <Check className="h-3 w-3" style={{ color: isLight ? "#fff" : "#0a0a0b" }} />
          </div>
        )}
      </div>
      <span className={cn("text-xs font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
    </button>
  );
}

// ── Settings row ──────────────────────────────────────────────────────────────

function SettingsRow({
  icon, label, subtitle, onClick, destructive,
}: {
  icon:        React.ReactNode;
  label:       string;
  subtitle?:   string;
  onClick:     () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/50 active:bg-accent"
    >
      <span className={cn("shrink-0", destructive ? "text-destructive" : "text-muted-foreground")}>
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn("text-sm font-medium", destructive ? "text-destructive" : "text-foreground")}>
          {label}
        </span>
        {subtitle && (
          <span className="mt-0.5 text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>
      {!destructive && <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "oklch(0.62 0.13 74)" }} />}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const INVITE_INPUT = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function SettingsPage() {
  const { user, profile, signOut }        = useAuth();
  const { careCircleId, careCircleName, role } = useCareCircle(user?.id);
  const {
    members, pendingInvites, isLoading: membersLoading,
    generateInvite, revokeInvite, removeMember, updateMemberRole,
  } = useMembers(careCircleId);

  const isAdmin = role === "admin";

  // Sheet open states
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [membersOpen,    setMembersOpen]    = useState(false);
  const [inviteOpen,     setInviteOpen]     = useState(false);
  const [passwordOpen,   setPasswordOpen]   = useState(false);

  // Password change state
  const [currentPwd,     setCurrentPwd]     = useState("");
  const [newPwd,         setNewPwd]         = useState("");
  const [confirmPwd,     setConfirmPwd]     = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd,     setShowNewPwd]     = useState(false);
  const [passwordBusy,   setPasswordBusy]   = useState(false);

  const pwdChecks = {
    length:    newPwd.length >= 8,
    uppercase: /[A-Z]/.test(newPwd),
    number:    /[0-9]/.test(newPwd),
  };
  const pwdValid = Object.values(pwdChecks).every(Boolean) && newPwd === confirmPwd && currentPwd.length > 0;

  // Invite form state
  const [inviteRole,    setInviteRole]    = useState("collaborator");
  const [invitePin,     setInvitePin]     = useState("");
  const [inviteBusy,    setInviteBusy]    = useState(false);
  const [inviteToken,   setInviteToken]   = useState<string | null>(null);

  const fullName = profile ? `${profile.first_name} ${profile.last_name}` : "…";
  const initials = profile
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : "?";

  // ── Invite handlers ──────────────────────────────────────────────────────

  const handleGenerateInvite = async () => {
    if (invitePin.length !== 4) return;
    setInviteBusy(true);
    const { token, error } = await generateInvite(inviteRole, invitePin);
    setInviteBusy(false);
    if (error) {
      toast.error("Failed to generate invite", { description: error });
    } else {
      setInviteToken(token);
    }
  };

  const handleShareInvite = async () => {
    if (!inviteToken) return;
    const url = `${window.location.origin}/join?code=${inviteToken}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my care circle on CareSync",
          text:  `Use PIN: ${invitePin} to join my care circle. The link expires in 24 hours.`,
          url,
        });
      } catch {
        // User dismissed the share sheet — not an error
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  };

  const handleRevokeInvite = async (token: string) => {
    const { error } = await revokeInvite(token);
    if (error) toast.error("Failed to revoke invite", { description: error });
    else toast.success("Invite revoked");
  };

  const handleRemoveMember = async (memberId: string, name: string) => {
    const { error } = await removeMember(memberId);
    if (error) toast.error("Failed to remove member", { description: error });
    else toast.success(`${name} removed`);
  };

  const closeInviteSheet = () => {
    setInviteOpen(false);
    setInvitePin("");
    setInviteToken(null);
    setInviteRole("collaborator");
  };

  const handleChangePassword = async () => {
    if (!pwdValid || !user?.email) return;
    setPasswordBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email, password: currentPwd,
    });
    if (authError) {
      toast.error("Current password is incorrect");
      setPasswordBusy(false);
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPwd });
    setPasswordBusy(false);
    if (updateError) {
      toast.error("Failed to update password", { description: updateError.message });
    } else {
      toast.success("Password updated");
      setPasswordOpen(false);
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    const { error } = await updateMemberRole(memberId, newRole);
    if (error) toast.error("Failed to update role", { description: error });
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">

      {/* Page header */}
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      {/* Profile card — frosted glass */}
      <div className="mb-10 flex items-center gap-3 rounded-xl border border-white/10 bg-card/85 px-4 py-4 backdrop-blur-xl">
        <div className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
          avatarColor(fullName),
        )}>
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{fullName}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* Care Circle section — floating label */}
      <p className="mb-1.5 px-1 text-sm font-semibold uppercase tracking-wider" style={{ color: "oklch(0.62 0.13 74)" }}>
        Care Circle
      </p>
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card">
        <SettingsRow
          icon={<Users className="h-4 w-4" />}
          label={careCircleName ?? "Members"}
          subtitle={membersLoading ? "Loading…" : `${members.length} member${members.length === 1 ? "" : "s"}`}
          onClick={() => setMembersOpen(true)}
        />
      </div>

      {/* Preferences section — floating label */}
      <p className="mb-1.5 px-1 text-sm font-semibold uppercase tracking-wider" style={{ color: "oklch(0.62 0.13 74)" }}>
        Preferences
      </p>
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card">
        <SettingsRow
          icon={<Palette className="h-4 w-4" />}
          label="Appearance"
          subtitle={`${THEMES.length} themes`}
          onClick={() => setAppearanceOpen(true)}
        />
      </div>

      {/* Account section — floating label */}
      <p className="mb-1.5 px-1 text-sm font-semibold uppercase tracking-wider" style={{ color: "oklch(0.62 0.13 74)" }}>
        Account
      </p>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-card/85 backdrop-blur-xl">
        <SettingsRow
          icon={<KeyRound className="h-4 w-4" />}
          label="Change Password"
          onClick={() => setPasswordOpen(true)}
        />
        <SettingsRow
          icon={<LogOut className="h-4 w-4" />}
          label="Sign Out"
          onClick={signOut}
          destructive
        />
      </div>

      <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground/60">
        Theme preference is saved to this device.
      </p>

      {/* ── Appearance sheet ── */}
      <Sheet open={appearanceOpen} onOpenChange={setAppearanceOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Appearance</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <p className="mb-1 text-sm font-medium text-foreground">Theme</p>
            <p className="mb-4 text-xs text-muted-foreground">
              Choose a background style for CareSync.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {THEMES.map(({ id, label }) => (
                <ThemeSwatch key={id} id={id} label={label} />
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Members sheet ── */}
      <Sheet open={membersOpen} onOpenChange={setMembersOpen}>
        <SheetContent className="flex flex-col overflow-hidden">
          <SheetHeader>
            <SheetTitle>Care Circle</SheetTitle>
            {careCircleName && (
              <p className="text-xs text-muted-foreground">{careCircleName}</p>
            )}
          </SheetHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto py-4">

            {membersLoading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-14 animate-pulse rounded-xl bg-accent" />
                ))}
              </div>
            ) : (
              <>
                {/* Members list */}
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Members
                </p>
                <div className="mb-6 flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {members.map((m) => {
                    const name     = `${m.firstName} ${m.lastName}`.trim() || "Unknown";
                    const initials = name !== "Unknown"
                      ? `${m.firstName[0]}${m.lastName[0]}`.toUpperCase()
                      : "?";
                    const isSelf   = m.userId === user?.id;
                    return (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                        <div className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
                          avatarColor(name),
                        )}>
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {name}{isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                          </p>
                          {isAdmin && !isSelf ? (
                            <select
                              value={m.role}
                              onChange={(e) => handleUpdateRole(m.id, e.target.value)}
                              className="mt-0.5 rounded-md border border-border bg-transparent px-1.5 py-0.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              <option value="admin">Admin</option>
                              <option value="collaborator">Caregiver</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          ) : (
                            <p className="text-xs text-muted-foreground">{ROLE_LABEL[m.role] ?? m.role}</p>
                          )}
                        </div>
                        {isAdmin && !isSelf && (
                          <button
                            onClick={() => handleRemoveMember(m.id, name)}
                            title={`Remove ${name}`}
                            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Pending invites (admin only) */}
                {isAdmin && pendingInvites.length > 0 && (
                  <>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Pending Invites
                    </p>
                    <div className="mb-6 flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                      {pendingInvites.map((inv) => (
                        <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {ROLE_LABEL[inv.role] ?? inv.role} invite
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {expiresIn(inv.expiresAt)}
                              {inv.attemptCount > 0 && ` · ${inv.attemptCount} failed attempt${inv.attemptCount > 1 ? "s" : ""}`}
                            </p>
                          </div>
                          {/* Re-share this invite */}
                          <button
                            title="Share link again"
                            onClick={async () => {
                              const url = `${window.location.origin}/join?code=${inv.inviteToken}`;
                              if (navigator.share) {
                                try { await navigator.share({ url, title: "Join my care circle on CareSync" }); }
                                catch { /* dismissed */ }
                              } else {
                                await navigator.clipboard.writeText(url);
                                toast.success("Link copied to clipboard");
                              }
                            }}
                            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                          <button
                            title="Revoke invite"
                            onClick={() => handleRevokeInvite(inv.inviteToken)}
                            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Footer — invite button for admins */}
          {isAdmin && (
            <div className="shrink-0 border-t border-border px-4 py-4">
              <Button className="w-full" onClick={() => setInviteOpen(true)}>
                Invite Member
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Invite sheet (nested on top of members) ── */}
      <Sheet open={inviteOpen} onOpenChange={(o) => { if (!o) closeInviteSheet(); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Invite Someone New</SheetTitle>
          </SheetHeader>

          {inviteToken ? (
            /* ── Link generated — show share UI ── */
            <div className="mt-6 flex flex-col gap-5">
              <div className="rounded-xl border border-border bg-accent/40 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Invite link
                </p>
                <p className="break-all font-mono text-xs text-foreground">
                  {window.location.origin}/join?code={inviteToken}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-accent/40 p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  PIN (share privately)
                </p>
                <p className="font-mono text-2xl font-bold tracking-[0.4em] text-foreground">
                  {invitePin}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Share the link and PIN with your invitee separately — anyone with both can join your care circle.
                The link expires in 24 hours.
              </p>
              <Button className="w-full gap-2" onClick={handleShareInvite}>
                <Share2 className="h-4 w-4" />
                Share link
              </Button>
              <Button variant="outline" className="w-full" onClick={closeInviteSheet}>
                Done
              </Button>
            </div>
          ) : (
            /* ── Invite form ── */
            <div className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className={INVITE_INPUT}
                >
                  <option value="collaborator">Caregiver — can add, edit, and complete tasks</option>
                  <option value="viewer">Viewer — read-only access</option>
                  <option value="admin">Admin — full access including inviting others</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">PIN</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={4}
                  value={invitePin}
                  onChange={(e) => setInvitePin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="4 digits, e.g. 7391"
                  className={`${INVITE_INPUT} font-mono tracking-widest`}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Your invitee will need this PIN to join. Share it separately from the link.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={handleGenerateInvite}
                disabled={invitePin.length !== 4 || inviteBusy}
              >
                {inviteBusy ? "Generating…" : "Generate Invite Link"}
              </Button>
              <Button variant="outline" className="w-full" onClick={closeInviteSheet}>
                Cancel
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Change Password sheet ── */}
      <Sheet open={passwordOpen} onOpenChange={(o) => {
        if (!o) { setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); setShowCurrentPwd(false); setShowNewPwd(false); }
        setPasswordOpen(o);
      }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Change Password</SheetTitle>
          </SheetHeader>
          <div className="mt-6 flex flex-col gap-4">
            {/* Current password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPwd ? "text" : "password"}
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Enter current password"
                  className={`${INVITE_INPUT} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showCurrentPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">New Password</label>
              <div className="relative">
                <input
                  type={showNewPwd ? "text" : "password"}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Enter new password"
                  className={`${INVITE_INPUT} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Live complexity feedback */}
              {newPwd.length > 0 && (
                <ul className="mt-1 flex flex-col gap-1">
                  {([
                    [pwdChecks.length,    "At least 8 characters"],
                    [pwdChecks.uppercase, "At least one uppercase letter"],
                    [pwdChecks.number,    "At least one number"],
                  ] as [boolean, string][]).map(([ok, label]) => (
                    <li key={label} className={cn("flex items-center gap-1.5 text-xs", ok ? "text-green-500" : "text-muted-foreground")}>
                      <Check className={cn("h-3 w-3", !ok && "opacity-0")} />
                      {label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Confirm New Password</label>
              <input
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="Re-enter new password"
                className={INVITE_INPUT}
              />
              {confirmPwd.length > 0 && newPwd !== confirmPwd && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleChangePassword}
              disabled={!pwdValid || passwordBusy}
            >
              {passwordBusy ? "Updating…" : "Update Password"}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setPasswordOpen(false)}>
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
