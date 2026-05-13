/**
 * CareSync — Netlify Serverless Function: delete-account
 * =======================================================
 * Route: POST /.netlify/functions/delete-account
 *
 * Deletes the calling user's Supabase auth record.
 * Cascade rules in schema.sql handle all downstream cleanup:
 *   auth.users → profiles → care_circle_members
 *   tasks.assigned_to → SET NULL (tasks remain, unassigned)
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in Netlify environment variables.
 * The service role key must NEVER be exposed to the browser.
 */

import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient }               from "@supabase/supabase-js";

const SUPABASE_URL              = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY         = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP_URL                   = process.env.APP_URL!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !APP_URL) {
  throw new Error(
    "[delete-account] Missing required environment variables. " +
    "Ensure SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, " +
    "and APP_URL are set in the Netlify dashboard."
  );
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  APP_URL,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const handler: Handler = async (event: HandlerEvent) => {
  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // ── 1. Verify caller JWT ───────────────────────────────────────────────────
  const authHeader = event.headers["authorization"] ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!jwt) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Missing authorization token" }),
    };
  }

  // Use anon client to verify the JWT and extract the user id
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error: authError } = await anonClient.auth.getUser(jwt);

  if (authError || !user) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Invalid or expired token" }),
    };
  }

  // ── 2. Build admin client (bypasses RLS for ownership checks + deletion) ──
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 3. Inspect every circle this user belongs to (single pass) ───────────
  // We need three pieces of info per circle:
  //   • blocking?         user is sole Admin AND other members exist → 409
  //   • soleMemberCircle? user is the only member → mark for cleanup deletion
  //   • otherwise         normal — user's membership cascades away when deleted
  const { data: myMemberships, error: queryMembershipsErr } = await adminClient
    .from("care_circle_members")
    .select("care_circle_id, role, care_circles!inner(id, name)")
    .eq("user_id", user.id);

  if (queryMembershipsErr) {
    console.error("[delete-account] membership lookup failed:", queryMembershipsErr.message);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Failed to verify circle membership. Please try again." }),
    };
  }

  const myMembershipsArr = (myMemberships ?? []) as any[];
  const blockingCircles:     { id: string; name: string }[] = [];
  const soleMemberCircleIds: string[]                       = [];

  if (myMembershipsArr.length > 0) {
    const myCircleIds = myMembershipsArr.map((m) => m.care_circle_id);

    const { data: allMembers, error: queryMembersErr } = await adminClient
      .from("care_circle_members")
      .select("care_circle_id, user_id, role")
      .in("care_circle_id", myCircleIds);

    if (queryMembersErr) {
      console.error("[delete-account] member scan failed:", queryMembersErr.message);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Failed to verify circle membership. Please try again." }),
      };
    }

    const allMembersArr = (allMembers ?? []) as any[];

    for (const membership of myMembershipsArr) {
      const circleId   = membership.care_circle_id;
      const circleName = membership.care_circles?.name ?? "Unnamed Circle";
      const myRole     = membership.role;

      const allInCircle  = allMembersArr.filter((m) => m.care_circle_id === circleId);
      const otherMembers = allInCircle.filter((m) => m.user_id !== user.id);

      // Sole-member circle — flag for cleanup, no need to guardrail
      if (otherMembers.length === 0) {
        soleMemberCircleIds.push(circleId);
        continue;
      }

      // Other members exist — apply the sole-admin guardrail
      if (myRole === "admin") {
        const otherAdmins = otherMembers.filter((m) => m.role === "admin");
        if (otherAdmins.length === 0) {
          blockingCircles.push({ id: circleId, name: circleName });
        }
      }
    }
  }

  if (blockingCircles.length > 0) {
    return {
      statusCode: 409,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "sole_admin",
        message: "You are the only Admin of one or more Care Circles that still have other members. Please transfer the Admin role to another member, or remove the other members, before deleting your account.",
        circles: blockingCircles,
      }),
    };
  }

  // ── 4. Clean up sole-member orphan circles ──────────────────────────────
  // Delete circles where the user is the only member. CASCADE on
  // care_circles → tasks, calendar_events, broadcast_updates, avs_documents,
  // patients, and care_circle_members will wipe all dependent rows.
  if (soleMemberCircleIds.length > 0) {
    const { error: cleanupErr } = await adminClient
      .from("care_circles")
      .delete()
      .in("id", soleMemberCircleIds);

    if (cleanupErr) {
      console.error("[delete-account] orphan circle cleanup failed:", cleanupErr.message);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Failed to clean up Care Circles. Please try again." }),
      };
    }
  }

  // ── 5. Delete the user via admin API ─────────────────────────────────────
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

  if (deleteError) {
    console.error("[delete-account] deleteUser failed:", deleteError.message);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Failed to delete account. Please try again." }),
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ success: true }),
  };
};
