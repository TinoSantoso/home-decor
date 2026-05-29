import { createBrowserClient } from '@supabase/ssr';
import type { Session } from '@supabase/supabase-js';

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function createDisabledSupabaseClient(): BrowserSupabaseClient {
  const error = new Error('Supabase browser client is not configured.');
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null as Session | null }, error: null }),
      signInWithOtp: () => Promise.resolve({ data: { user: null, session: null }, error }),
      signInWithOAuth: () => Promise.resolve({ data: { provider: 'google', url: null }, error }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            id: 'disabled-supabase',
            callback: () => undefined,
            unsubscribe: () => undefined,
          },
        },
      }),
    },
  } as unknown as BrowserSupabaseClient;
}

/**
 * Browser Supabase client — safe to use in any client-side component.
 * This is the Vite/client-side entrypoint using @supabase/ssr.
 *
 * env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (from .env)
 */
export const supabase = supabaseUrl && supabaseAnonKey
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : createDisabledSupabaseClient();
