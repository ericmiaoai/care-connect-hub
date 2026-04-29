/**
 * useCareCircle.ts
 * ================
 * Provides the current user's active Care Circle context.
 * Every data query in the app depends on the careCircleId returned here.
 *
 * Returns null for careCircleId when the user has not yet joined or
 * created a Care Circle — this triggers the onboarding redirect in __root.tsx.
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { CareCircleRole } from "@/lib/database.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CareCircleContext {
  careCircleId:   string | null;
  careCircleName: string | null;
  role:           CareCircleRole | null;
  isLoading:      boolean;
  refetch:        () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useCareCircle(userId: string | null | undefined): CareCircleContext {
  const [careCircleId,   setCareCircleId]   = useState<string | null>(null);
  const [careCircleName, setCareCircleName] = useState<string | null>(null);
  const [role,           setRole]           = useState<CareCircleRole | null>(null);
  const [isLoading,      setIsLoading]      = useState(true);

  const fetchCareCircle = useCallback(async () => {
    if (!userId) {
      setCareCircleId(null);
      setCareCircleName(null);
      setRole(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Find the first care circle this user belongs to.
    // We join care_circle_members → care_circles in one query.
    const { data, error } = await supabase
      .from("care_circle_members")
      .select(`
        role,
        care_circles (
          id,
          name
        )
      `)
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (error || !data) {
      // No membership found — user needs onboarding
      setCareCircleId(null);
      setCareCircleName(null);
      setRole(null);
    } else {
      // Supabase can't infer nested join types without Relationships in Database — cast explicitly
      const row = data as unknown as { role: CareCircleRole; care_circles: { id: string; name: string } | null };
      const circle = row.care_circles;
      setCareCircleId(circle?.id ?? null);
      setCareCircleName(circle?.name ?? null);
      setRole(row.role);
    }

    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchCareCircle();
  }, [fetchCareCircle]);

  return { careCircleId, careCircleName, role, isLoading, refetch: fetchCareCircle };
}
