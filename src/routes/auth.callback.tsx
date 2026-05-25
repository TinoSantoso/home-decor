import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase/client';
import { useAuthStore } from '../stores/auth';

export const Route = createFileRoute('/auth/callback')({
  ssr: false,
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const init = useAuthStore((s) => s.init);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');

      if (code) {
        const { data, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeError) {
          setError(exchangeError.message);
          init(null);
          return;
        }
        init(data.session);
      } else {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        init(data.session);
      }

      await navigate({ to: '/dashboard', replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [init, navigate]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-center">
      {error ? (
        <>
          <h1 className="text-2xl font-semibold">{t('auth.callbackFailed')}</h1>
          <p className="mt-2 text-sm text-[color:var(--color-danger)]">
            {error}
          </p>
        </>
      ) : (
        <p className="text-sm text-[color:var(--color-text-muted)]">
          {t('auth.callbackProcessing')}
        </p>
      )}
    </main>
  );
}
