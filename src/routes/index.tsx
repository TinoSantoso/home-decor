import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  const { t, i18n } = useTranslation();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">
        {t('landing.title')}
      </h1>
      <p className="mt-4 text-lg text-[color:var(--color-text-muted)]">
        {t('landing.subtitle')}
      </p>

      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={() => i18n.changeLanguage(i18n.language === 'id' ? 'en' : 'id')}
          className="rounded-[var(--radius)] border border-[color:var(--color-border)] px-4 py-2 text-sm"
        >
          {i18n.language === 'id' ? 'English' : 'Bahasa Indonesia'}
        </button>
      </div>
    </main>
  );
}
