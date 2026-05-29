/**
 * Server-side auth middleware for TanStack Start.
 *
 * Reads the Supabase session cookie from the incoming request and injects
 * `session` (Supabase Session | null) into the middleware context so downstream
 * server functions can access `context.session`.
 *
 * Usage:
 *   export const myFn = createServerFn({ method: 'POST' })
 *     .middleware([serverAuthMiddleware])
 *     .handler(async ({ context }) => {
 *       // context.session is Supabase Session | null
 *     });
 */
import { createMiddleware } from '@tanstack/react-start';
import { createServerSupabaseClient } from '../lib/supabase/server';

/** Context shape injected by this middleware. */
export interface AuthContext {
  session: import('@supabase/supabase-js').Session | null;
}

export const serverAuthMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const supabase = createServerSupabaseClient({
      supabaseUrl: process.env['SUPABASE_URL'] ?? process.env['VITE_SUPABASE_URL'] ?? '',
      supabaseAnonKey:
        process.env['SUPABASE_ANON_KEY'] ?? process.env['VITE_SUPABASE_ANON_KEY'] ?? '',
      cookieHeader: request.headers.get('cookie'),
    });

    const { data: sessionData } = await supabase.auth.getSession();
    const { data: userData, error } = sessionData.session
      ? await supabase.auth.getUser()
      : { data: { user: null }, error: null };
    const session = error || !userData.user ? null : sessionData.session;

    return next({ context: { session } satisfies AuthContext });
  },
);
