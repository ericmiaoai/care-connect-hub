/**
 * supabaseClient.ts
 * =================
 * Singleton Supabase client instance for the entire CareSync app.
 *
 * Rules:
 * - Import ONLY this file when you need to query Supabase — never create
 *   a second client instance anywhere in the codebase.
 * - The anon key is safe here — all access is enforced by RLS server-side.
 * - The service_role key must NEVER appear in this file or anywhere in /src.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "[supabaseClient] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be " +
    "defined in your .env file. See .env.example for the required format."
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    // Persist login session across browser refreshes using localStorage
    persistSession: true,
    // Automatically refresh the JWT before it expires
    autoRefreshToken: true,
    // Detect OAuth redirects automatically (used for magic link / OAuth flows)
    detectSessionInUrl: true,
  },
});
