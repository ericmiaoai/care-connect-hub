import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { setChannelStatus } from "@/lib/realtimeSyncStore";

/**
 * Fires a toast whenever a new member joins the care circle.
 * Only active for admins — non-admins and unauthenticated users are no-ops.
 */
export function useNewMemberAlert(
  careCircleId: string | null | undefined,
  role:         string | null | undefined,
) {
  useEffect(() => {
    if (!careCircleId || role !== "admin") return;

    const channelKey = `new_member_alert_${careCircleId}`;
    const channel = supabase
      .channel(channelKey)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "care_circle_members",
          filter: `care_circle_id=eq.${careCircleId}`,
        },
        async (payload) => {
          const userId = (payload.new as { user_id?: string })?.user_id;
          if (!userId) return;

          const { data } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", userId)
            .single();

          const name = data
            ? `${(data as { first_name: string; last_name: string }).first_name} ${(data as { first_name: string; last_name: string }).last_name}`.trim()
            : "Someone";

          toast.success(`${name} joined your care circle`);
        },
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          setChannelStatus(channelKey, true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setChannelStatus(channelKey, false);
          console.error(`[useNewMemberAlert] Realtime channel error (${status}):`, err);
        }
      });

    return () => {
      setChannelStatus(channelKey, true);
      supabase.removeChannel(channel);
    };
  }, [careCircleId, role]);
}
