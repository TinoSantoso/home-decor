import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client — safe to use in any client-side component.
 * This is the Vite/client-side entrypoint using @supabase/ssr.
 *
 * env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (from .env)
 */
export const supabase = createBrowserClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
