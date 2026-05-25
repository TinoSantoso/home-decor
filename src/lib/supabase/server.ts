import { createServerClient } from '@supabase/ssr';

/**
 * TanStack Start / Node.js server client — use in loaders, actions,
 * and any server-side context where cookies or headers are available.
 *
 * env: SUPABASE_URL, SUPABASE_ANON_KEY, plus runtime cookies/headers.
 */

/** Build the cookie header string from a cookie jar (for requests). */
export function parseCookies(
  cookieHeader: string | null,
): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const chunk of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = chunk.trim().split('=');
    if (!rawName || rawValue.length === 0) continue;
    const value = rawValue.join('=');
    try {
      out[rawName] = decodeURIComponent(value);
    } catch {
      out[rawName] = value;
    }
  }
  return out;
}

/** Create a server-side Supabase client for SSR loaders/actions. */
export function createServerSupabaseClient({
  supabaseUrl,
  supabaseAnonKey,
  cookieHeader,
}: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  cookieHeader: string | null;
}) {
  const cookies: Record<string, string> = parseCookies(cookieHeader);

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return Object.entries(cookies).map(([name, value]) => ({
          name,
          value,
        }));
      },
      setAll(cookiesToSet) {
        // In TanStack Start loaders/actions we set cookies via the Response
        // headers on return. This function stores them for the caller to apply.
        for (const cookie of cookiesToSet) {
          cookies[cookie.name] = cookie.value;
          void cookie.options;
        }
      },
    },
  });
}

/**
 * Wraps createServerClient for TanStack Start's `beforeLoad` / `onSuccess`
 * lifecycle, where the context carries `setHeaders`.
 */
export function createSupabaseServerClient(
  supabaseUrl: string,
  supabaseKey: string,
) {
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll(_cookiesToSet) {
        // Cookies are set via response headers in TanStack Start — handled
        // by the route beforeLoad / onSuccess callbacks.
      },
    },
  });
}
