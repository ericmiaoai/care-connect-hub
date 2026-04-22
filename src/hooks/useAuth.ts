/**
 * useAuth.ts
 * ==========
 * Central authentication hook for the entire CareSync app.
 * Wraps Supabase Auth and exposes a clean, typed API.
 *
 * Usage:
 *   const { user, profile, isLoading, signIn, signUp, signOut } = useAuth();
 */

import { useEffect, useState, useCallback } from "react";
import type { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "@/lib/database.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AuthState {
  user:      User | null;
  session:   Session | null;
  profile:   Profile | null;
  isLoading: boolean;
}

interface SignUpOptions {
  email:     string;
  password:  string;
  firstName: string;
  lastName:  string;
}

interface SignInOptions {
  email:    string;
  password: string;
}

interface AuthActions {
  signUp:   (opts: SignUpOptions)  => Promise<{ error: AuthError | null }>;
  signIn:   (opts: SignInOptions)  => Promise<{ error: AuthError | null }>;
  signOut:  ()                     => Promise<void>;
}

export type UseAuthReturn = AuthState & AuthActions;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useAuth(): UseAuthReturn {
  const [user,      setUser]      = useState<User | null>(null);
  const [session,   setSession]   = useState<Session | null>(null);
  const [profile,   setProfile]   = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch the profile row for the currently logged-in user
  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    // Retrieve initial session (handles page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setIsLoading(false);
    });

    // Subscribe to auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const signUp = useCallback(
    async ({ email, password, firstName, lastName }: SignUpOptions) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // These are passed to the handle_new_user() trigger
          data: { first_name: firstName, last_name: lastName },
        },
      });
      return { error };
    },
    []
  );

  const signIn = useCallback(async ({ email, password }: SignInOptions) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { user, session, profile, isLoading, signUp, signIn, signOut };
}
