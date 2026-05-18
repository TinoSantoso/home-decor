import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { nanoid } from 'nanoid';

export const Route = createFileRoute('/projects/new')({
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
              onClick={() => {
                const projectId = nanoid(8);
                void navigate({
                  to: '/projects/$projectId/editor',
                  params: { projectId },
                });
              }}
              className="block w-full rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-left transition hover:border-[color:var(--color-accent)]"
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
