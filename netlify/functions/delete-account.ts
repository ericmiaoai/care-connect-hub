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

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "[delete-account] Missing required environment variables. " +
    "Ensure SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY " +
    "are set in the Netlify dashboard."
  );
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  process.env.APP_URL ?? "*",
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

  // ── 2. Delete the user via admin API ──────────────────────────────────────
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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
