import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { adaptBroadcast, type UIBroadcast, type DBBroadcastWithAuthor } from "@/lib/adapters";

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

  const fetchBroadcasts = useCallback(async () => {
    if (!careCircleId) {
      setBroadcasts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data, error: sbError } = await supabase
      .from("broadcast_updates")
      .select("*, author:author_id(first_name, last_name)")
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

  useEffect(() => {
    if (!careCircleId) return;
    const channel = supabase
      .channel(`broadcasts_rt_${careCircleId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "broadcast_updates", filter: `care_circle_id=eq.${careCircleId}` }, () => { fetchBroadcasts(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
