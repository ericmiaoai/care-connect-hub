import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface Member {
  id:        string;
  userId:    string;
  role:      string;
  joinedAt:  string;
  firstName: string;
  lastName:  string;
  avatarUrl: string | null;
}

export interface PendingInvite {
  id:           string;
  role:         string;
  inviteToken:  string;
  attemptCount: number;
  expiresAt:    string;
  createdAt:    string;
}

interface UseMembersReturn {
  members:          Member[];
  pendingInvites:   PendingInvite[];
  isLoading:        boolean;
  error:            string | null;
  generateInvite:   (role: string, pin: string) => Promise<{ token: string | null; error: string | null }>;
  revokeInvite:     (token: string) => Promise<{ error: string | null }>;
  removeMember:     (memberId: string) => Promise<{ error: string | null }>;
  updateMemberRole: (memberId: string, newRole: string) => Promise<{ error: string | null }>;
  refetch:          () => void;
}

export function useMembers(careCircleId: string | null | undefined): UseMembersReturn {
  const [members,        setMembers]        = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!careCircleId) {
      setMembers([]);
      setPendingInvites([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data: membersData, error: membersError } = await supabase
      .from("care_circle_members")
      .select(`
        id,
        user_id,
        role,
        joined_at,
        profiles (
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq("care_circle_id", careCircleId);

    if (membersError) {
      setError(membersError.message);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMembers((membersData ?? []).map((m: any) => ({
        id:        m.id,
        userId:    m.user_id,
        role:      m.role,
        joinedAt:  m.joined_at,
        firstName: m.profiles?.first_name ?? "",
        lastName:  m.profiles?.last_name  ?? "",
        avatarUrl: m.profiles?.avatar_url ?? null,
      })));
    }

    // list_pending_invites raises an exception for non-admins — treat errors as empty
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invitesData } = await (supabase as any)
      .rpc("list_pending_invites", { p_care_circle_id: careCircleId });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setPendingInvites((invitesData ?? []).map((i: any) => ({
      id:           i.id,
      role:         i.role,
      inviteToken:  i.invite_token,
      attemptCount: i.attempt_count,
      expiresAt:    i.expires_at,
      createdAt:    i.created_at,
    })));

    setIsLoading(false);
  }, [careCircleId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Re-fetch when any member uploads a new profile photo
  useEffect(() => {
    const handler = () => fetchAll();
    window.addEventListener("caresync:profile-updated", handler);
    return () => window.removeEventListener("caresync:profile-updated", handler);
  }, [fetchAll]);

  useEffect(() => {
    if (!careCircleId) return;
    const channel = supabase
      .channel(`members_rt_${careCircleId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "care_circle_members",
        filter: `care_circle_id=eq.${careCircleId}`,
      }, () => { fetchAll(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [careCircleId, fetchAll]);

  const generateInvite = useCallback(async (
    role: string,
    pin: string,
  ): Promise<{ token: string | null; error: string | null }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: rpcError } = await (supabase as any).rpc("generate_invite_link", {
      p_care_circle_id: careCircleId,
      p_role:           role,
      p_pin:            pin,
    });
    if (rpcError) return { token: null, error: rpcError.message };
    await fetchAll();
    return { token: data as string, error: null };
  }, [careCircleId, fetchAll]);

  const revokeInvite = useCallback(async (token: string): Promise<{ error: string | null }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabase as any)
      .rpc("revoke_invite_link", { p_token: token });
    if (!rpcError) await fetchAll();
    return { error: rpcError?.message ?? null };
  }, [fetchAll]);

  const removeMember = useCallback(async (memberId: string): Promise<{ error: string | null }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sbError } = await (supabase as any)
      .from("care_circle_members")
      .delete()
      .eq("id", memberId);
    if (!sbError) await fetchAll();
    return { error: sbError?.message ?? null };
  }, [fetchAll]);

  const updateMemberRole = useCallback(async (memberId: string, newRole: string): Promise<{ error: string | null }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sbError } = await (supabase as any)
      .from("care_circle_members")
      .update({ role: newRole })
      .eq("id", memberId);
    if (!sbError) await fetchAll();
    return { error: sbError?.message ?? null };
  }, [fetchAll]);

  return {
    members, pendingInvites, isLoading, error,
    generateInvite, revokeInvite, removeMember, updateMemberRole, refetch: fetchAll,
  };
}
