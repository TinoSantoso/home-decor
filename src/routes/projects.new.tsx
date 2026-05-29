import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createProject } from '../lib/db/projects';
import { useAuthStore } from '../stores/auth';
import { createOwnedProjectFn } from '../server/projects';

export const Route = createFileRoute('/projects/new')({
  ssr: false,
  component: NewProjectPage,
});

const TEMPLATES = [
  { id: 'rumah-tapak-t36', area: 36 },
  { id: 'rumah-tapak-t45', area: 45 },
  { id: 'rumah-tapak-t70', area: 70 },
  { id: 'apartemen-studio', area: 28 },
  { id: 'apartemen-2br', area: 55 },
  { id: 'villa-kecil', area: 120 },
] as const;

function NewProjectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const loading = useAuthStore((s) => s.loading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (loading) return null;

  async function pickTemplate(templateId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const input = {
        name: t(`templates.${templateId}`),
        templateId,
        budgetTier: 'standar',
        contingencyPct: 0.1,
        taxEnabled: false,
        climateZone: 'tropical_indonesia',
      } as const;
      const project = isAuthenticated
        ? await createOwnedProjectFn({ data: input })
        : await createProject(input);
      await navigate({
        to: '/projects/$projectId/editor',
        params: { projectId: project.id },
      });
    } catch (err) {
      console.error(err);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t('newProject.title')}
      </h1>
      <p className="mt-2 text-[color:var(--color-text-muted)]">
        {t('newProject.subtitle')}
      </p>

      <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((tpl) => (
          <li key={tpl.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void pickTemplate(tpl.id)}
              className="block w-full rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-left transition hover:border-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="text-sm uppercase tracking-wide text-[color:var(--color-text-muted)]">
                {t('newProject.template')}
              </div>
              <div className="mt-1 text-xl font-medium">
                {t(`templates.${tpl.id}`)}
              </div>
              <div className="mt-3 text-sm text-[color:var(--color-text-muted)]">
                {t('newProject.areaLabel', { area: tpl.area })}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
