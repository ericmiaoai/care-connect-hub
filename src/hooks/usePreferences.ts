import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Theme } from "@/lib/theme";

export type PatientDisplay = "prominent" | "minimal" | "hidden";

export interface MyDayPrefs {
  sectionOrder?:   string[];
  collapsed?:      Record<string, boolean>;
  snoozedUntil?:   string | null;
  myDayFilter?:    "mine" | "all";
  theme?:          Theme;
  /**
   * How prominently the Care Recipient is displayed throughout the app.
   * - "prominent" (default): hero card on My Day + strip in the sidebar
   * - "minimal":             strip in the sidebar only
   * - "hidden":              not displayed in daily views (still editable in Settings)
   */
  patientDisplay?: PatientDisplay;
}

interface UsePreferencesReturn {
  prefs:       MyDayPrefs;
  isLoaded:    boolean;
  updatePrefs: (patch: Partial<MyDayPrefs>) => Promise<void>;
}

export function usePreferences(userId: string | null | undefined): UsePreferencesReturn {
  const [prefs,    setPrefs]    = useState<MyDayPrefs>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!userId) {
      setPrefs({});
      setIsLoaded(true);
      return;
    }
    // Reset before fetching so the transition false→true is always observable
    setIsLoaded(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("profiles") as any)
      .select("preferences")
      .eq("id", userId)
      .single()
      .then(({ data }: { data: { preferences?: unknown } | null }) => {
        if (data?.preferences && typeof data.preferences === "object") {
          setPrefs(data.preferences as MyDayPrefs);
        }
        setIsLoaded(true);
      });
  }, [userId]);

  const updatePrefs = useCallback(async (patch: Partial<MyDayPrefs>) => {
    if (!userId || !isLoaded) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("profiles") as any)
      .update({ preferences: next })
      .eq("id", userId);
  }, [userId, prefs, isLoaded]);

  return { prefs, isLoaded, updatePrefs };
}
