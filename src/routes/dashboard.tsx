import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listProjects, deleteProject } from '../lib/db/projects';
import type { ProjectRecord } from '../lib/db/types';
import { formatRelativeFromNow } from '../lib/relative-time';
import { useAuthStore } from '../stores/auth';
import { deleteOwnedProjectFn, listOwnedProjectsFn } from '../server/projects';

export const Route = createFileRoute('/dashboard')({
  ssr: false,
  component: DashboardPage,
});

function DashboardPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const loading = useAuthStore((s) => s.loading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [projects, setProjects] = useState<ProjectRecord[] | null>(null);

  useEffect(() => {
    if (loading) return;
    void (isAuthenticated ? listOwnedProjectsFn() : listProjects()).then(setProjects);
  }, [isAuthenticated, loading]);

  async function onDelete(id: string) {
    if (isAuthenticated) {
      await deleteOwnedProjectFn({ data: { id } });
    } else {
      await deleteProject(id);
    }
    const next = isAuthenticated ? await listOwnedProjectsFn() : await listProjects();
    setProjects(next);
  }

  const localeTag = i18n.language === 'id' ? 'id' : 'en';

  if (loading) return null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t('dashboard.title')}
          </h1>
          <p className="mt-2 text-[color:var(--color-text-muted)]">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/catalog"
            className="rounded-[var(--radius)] border border-[color:var(--color-border)] px-3 py-1.5 text-sm hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
          >
            {t('nav.catalog')}
          </Link>
          <Link
            to="/projects/new"
            className="rounded-[var(--radius)] bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-[color:var(--color-accent-fg)]"
          >
            {t('nav.newProject')}
          </Link>
        </div>
      </header>

      {projects === null && (
        <section className="mt-10 text-center text-sm text-[color:var(--color-text-muted)]">
          {t('dashboard.loading')}
        </section>
      )}

      {projects !== null && projects.length === 0 && (
        <section className="mt-10 rounded-[var(--radius-lg)] border border-dashed border-[color:var(--color-border)] p-12 text-center">
          <p className="text-[color:var(--color-text-muted)]">
            {t('dashboard.empty')}
          </p>
        </section>
      )}

      {projects !== null && projects.length > 0 && (
        <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <li
              key={p.id}
              className="group flex items-start justify-between rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
            >
              <button
                type="button"
                onClick={() =>
                  void navigate({
                    to: '/projects/$projectId/editor',
                    params: { projectId: p.id },
                  })
                }
                className="flex-1 text-left"
              >
                <div className="font-medium">
                  {p.name || t('dashboard.untitled')}
                </div>
                <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                  {t('dashboard.zoneSummary', { count: p.zones.length })} ·{' '}
                  {formatRelativeFromNow(p.updatedAt, localeTag)}
                </div>
              </button>
              <button
                type="button"
                aria-label={t('dashboard.delete')}
                onClick={() => void onDelete(p.id)}
                className="ml-2 rounded-[var(--radius-sm)] border border-transparent px-2 py-1 text-xs text-[color:var(--color-text-muted)] opacity-0 transition group-hover:opacity-100 hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)]"
              >
                {t('dashboard.delete')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
