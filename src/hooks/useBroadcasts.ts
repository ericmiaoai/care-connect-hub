/**
 * useBroadcasts.ts
 * ================
 * Fetches broadcast updates for the current care circle, newest first.
 * Joins the author profile so the UI can display the poster's name.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { adaptBroadcast, type UIBroadcast, type DBBroadcastWithAuthor } from "@/lib/adapters";

interface UseBroadcastsReturn {
  broadcasts: UIBroadcast[];
  isLoading:  boolean;
  error:      string | null;
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

  return { broadcasts, isLoading, error };
}
