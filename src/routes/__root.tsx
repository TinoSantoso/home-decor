import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router';
import { Suspense, type ReactNode, useEffect, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';
import globalsCss from '../styles/globals.css?url';
import { AuthModal } from '../components/auth/AuthModal';
import { planLocalProjectImports } from '../lib/project-migration';
import { importOwnedProjectFn, listOwnedProjectsFn } from '../server/projects';
import {
  loadSessionFromCookies,
  onAuthStateChange,
  useAuthStore,
} from '../stores/auth';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Tur Dekorasi Rumah' },
      {
        name: 'description',
        content:
          'Rancang dan estimasi proyek dekorasi rumah Anda — indoor dan outdoor.',
      },
    ],
    links: [{ rel: 'stylesheet', href: globalsCss }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <I18nextProvider i18n={i18n}>
        <RootShell />
      </I18nextProvider>
    </RootDocument>
  );
}

function RootShell() {
  const init = useAuthStore((s) => s.init);
  const loading = useAuthStore((s) => s.loading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authModalOpen = useAuthStore((s) => s.authModalOpen);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const closeAuthModal = useAuthStore((s) => s.closeAuthModal);
  const signOut = useAuthStore((s) => s.signOut);
  const { t } = useTranslation();
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'importing' | 'done' | 'error'>('idle');

  // Hydrate auth state from cookies on mount.
  useEffect(() => {
    void (async () => {
      const session = await loadSessionFromCookies();
      init(session);
    })();

    // Subscribe to auth changes (Google redirect, sign-out, etc.).
    const unsubscribe = onAuthStateChange(() => {});
    return () => {
      unsubscribe.data.subscription.unsubscribe();
    };
  }, [init]);

  useEffect(() => {
    if (loading || !isAuthenticated || migrationStatus !== 'idle') return;
    void (async () => {
      try {
        const { listProjects } = await import('../lib/db/projects');
        const [localProjects, cloudProjects] = await Promise.all([
          listProjects(),
          listOwnedProjectsFn(),
        ]);
        const projectsToImport = planLocalProjectImports({ localProjects, cloudProjects });
        if (projectsToImport.length === 0) {
          setMigrationStatus('done');
          return;
        }
        setMigrationStatus('importing');
        await Promise.all(
          projectsToImport.map((project) => importOwnedProjectFn({ data: project })),
        );
        setMigrationStatus('done');
      } catch (error) {
        console.error('Local project import failed:', error);
        setMigrationStatus('error');
      }
    })();
  }, [isAuthenticated, loading, migrationStatus]);

  return (
    <>
      {/* Global auth bar — visible after session hydration when not authenticated */}
      {!loading && !isAuthenticated && (
        <div className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-2">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <span className="text-sm text-[color:var(--color-text-muted)]">
              {t('auth.guardBody')}
            </span>
            <button
              type="button"
              onClick={openAuthModal}
              className="rounded-[var(--radius)] bg-[color:var(--color-accent)] px-3 py-1 text-sm font-medium text-[color:var(--color-accent-fg)] hover:opacity-90"
            >
              {t('auth.modalTitle')}
            </button>
          </div>
        </div>
      )}

      {/* Authenticated nav bar */}
      {!loading && isAuthenticated && (
        <div className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-2">
          <div className="mx-auto flex max-w-7xl items-center justify-end">
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-[var(--radius)] border border-[color:var(--color-border)] px-3 py-1 text-sm text-[color:var(--color-text-muted)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)]"
            >
              {t('auth.signOut')}
            </button>
          </div>
        </div>
      )}

      {migrationStatus === 'importing' && (
        <div className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-2 text-center text-sm text-[color:var(--color-text-muted)]">
          {t('migration.importing')}
        </div>
      )}

      {migrationStatus === 'error' && (
        <div role="alert" className="border-b border-[color:var(--color-danger)] bg-[color:var(--color-surface)] px-6 py-2 text-center text-sm text-[color:var(--color-danger)]">
          {t('migration.error')}
        </div>
      )}

      <Suspense fallback={<div className="p-8">Memuat…</div>}>
        <Outlet />
      </Suspense>

      <AuthModal
        open={authModalOpen}
        onOpenChange={(open) => {
          if (open) openAuthModal();
          else closeAuthModal();
        }}
      />
    </>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        <HeadContent />
      </head>
      <body>
        <div id="root">{children}</div>
        <Scripts />
      </body>
    </html>
  );
}
