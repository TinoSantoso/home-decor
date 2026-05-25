import { create } from 'zustand';
import { supabase } from '../lib/supabase/client';
import type { Session } from '@supabase/supabase-js';

/**
 * Auth state — mirrors the current Supabase session.
 * Updated on mount (from cookie) and whenever auth events fire.
 */
interface AuthState {
  session: Session | null;
  /** Loading = true from mount until the first session is known. */
  loading: boolean;
  /** Convenience: true when a user is authenticated. */
  isAuthenticated: boolean;
  /** Convenience: the current user id or null. */
  userId: string | null;
  /** Global auth modal visibility. */
  authModalOpen: boolean;

  /** Set after initial mount; called by root layout. */
  init: (session: Session | null) => void;
  /** Open the global auth prompt. */
  openAuthModal: () => void;
  /** Close the global auth prompt. */
  closeAuthModal: () => void;
  /** Sign in with email magic link. */
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>;
  /** Sign in with Google OAuth. */
  signInWithGoogle: () => Promise<void>;
  /** Sign out the current user. */
  signOut: () => Promise<void>;
}

/** Store — one instance per app lifetime. */
export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  loading: true,
  isAuthenticated: false,
  userId: null,
  authModalOpen: false,

  init(session) {
    set({
      session,
      loading: false,
      isAuthenticated: !!session,
      userId: session?.user.id ?? null,
      ...(session ? { authModalOpen: false } : {}),
    });
  },

  openAuthModal() {
    set({ authModalOpen: true });
  },

  closeAuthModal() {
    set({ authModalOpen: false });
  },

  async signInWithEmail(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    return { error: error as Error | null };
  },

  async signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  },

  async signOut() {
    await supabase.auth.signOut();
    set({ session: null, isAuthenticated: false, userId: null });
  },
}));

// ---------- Helpers ----------

/** Call once on app startup in the root layout to hydrate from cookies. */
export async function loadSessionFromCookies(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Subscribe to auth state changes — call once at app startup.
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(callback: (session: Session | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
    useAuthStore.getState().init(session);
  });
}
