import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
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
        <Link
          to="/projects/new"
          className="rounded-[var(--radius)] bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-[color:var(--color-accent-fg)]"
        >
          {t('nav.newProject')}
        </Link>
      </header>

      <section className="mt-10 rounded-[var(--radius-lg)] border border-dashed border-[color:var(--color-border)] p-12 text-center">
        <p className="text-[color:var(--color-text-muted)]">
          {t('dashboard.empty')}
        </p>
      </section>
    </main>
  );
}
