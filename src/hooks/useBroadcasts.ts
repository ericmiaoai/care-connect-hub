import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { adaptBroadcast, type UIBroadcast, type DBBroadcastWithAuthor } from "@/lib/adapters";
import { setChannelStatus } from "@/lib/realtimeSyncStore";
import { useReportLoading } from "@/lib/routeReadiness";

interface UseBroadcastsReturn {
  broadcasts:      UIBroadcast[];
  isLoading:       boolean;
  error:           string | null;
  postBroadcast:   (userId: string, title: string, content: string, severity: UIBroadcast["severity"]) => Promise<{ error: string | null }>;
  deleteBroadcast: (id: string) => Promise<void>;
}

export function useBroadcasts(
  careCircleId: string | null | undefined,
): UseBroadcastsReturn {
  const [broadcasts, setBroadcasts] = useState<UIBroadcast[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  // Report loading state to the global readiness store so the route
  // transition logic in __root.tsx knows to hold the previous view
  // until this hook finishes its initial fetch.
  useReportLoading(isLoading);

  const fetchBroadcasts = useCallback(async () => {
    if (!careCircleId) {
      // Keep isLoading=true while the parent's useCareCircle hook is still
      // resolving. Setting it to false here would briefly flash the "No
      // updates yet" empty state during route mount, before careCircleId
      // arrives and the real fetch runs.
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data, error: sbError } = await supabase
      .from("broadcast_updates")
      .select("*, author:author_id(first_name, last_name, avatar_url)")
      .eq("care_circle_id", careCircleId)
      .order("created_at", { ascending: false });

    if (sbError) {
      setError(sbError.message);
      setBroadcasts([]);
    } else {
      setBroadcasts(
        (data ?? []).map((row) => adaptBroadcast(row as DBBroadcastWithAuthor)),
      );
    }

    setIsLoading(false);
  }, [careCircleId]);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  // Re-fetch when any member uploads a new profile photo
  useEffect(() => {
    const handler = () => fetchBroadcasts();
    window.addEventListener("caresync:profile-updated", handler);
    return () => window.removeEventListener("caresync:profile-updated", handler);
  }, [fetchBroadcasts]);

  useEffect(() => {
    if (!careCircleId) return;
    const channelKey = `broadcasts_rt_${careCircleId}`;
    const channel = supabase
      .channel(channelKey)
      .on("postgres_changes", { event: "*", schema: "public", table: "broadcast_updates", filter: `care_circle_id=eq.${careCircleId}` }, () => { fetchBroadcasts(); })
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          setChannelStatus(channelKey, true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setChannelStatus(channelKey, false);
          console.error(`[useBroadcasts] Realtime channel error (${status}):`, err);
        }
      });
    return () => {
      setChannelStatus(channelKey, true);
      supabase.removeChannel(channel);
    };
  }, [careCircleId, fetchBroadcasts]);

  const postBroadcast = useCallback(async (
    userId: string,
    title: string,
    content: string,
    severity: UIBroadcast["severity"],
  ): Promise<{ error: string | null }> => {
    if (!careCircleId) return { error: "No care circle" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sbError } = await (supabase.from("broadcast_updates") as any).insert({
      care_circle_id: careCircleId,
      author_id: userId,
      title,
      content,
      severity,
    });
    if (!sbError) await fetchBroadcasts();
    return { error: sbError?.message ?? null };
  }, [careCircleId, fetchBroadcasts]);

  const deleteBroadcast = useCallback(async (id: string): Promise<void> => {
    setBroadcasts((prev) => prev.filter((b) => b.id !== id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sbError } = await (supabase.from("broadcast_updates") as any).delete().eq("id", id);
    if (sbError) { setError(sbError.message); await fetchBroadcasts(); }
  }, [fetchBroadcasts]);

  return { broadcasts, isLoading, error, postBroadcast, deleteBroadcast };
}
