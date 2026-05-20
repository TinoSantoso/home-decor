import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Suspense, lazy, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFloorPlan } from '../stores/floor-plan';
import { getProject } from '../lib/db/projects';

const TourScene = lazy(() => import('../components/tour/TourScene'));
const BeforeAfterCompare = lazy(() =>
  import('../components/tour/BeforeAfterCompare').then((m) => ({
    default: m.BeforeAfterCompare,
  })),
);

export const Route = createFileRoute('/projects/$projectId/tour')({
  ssr: false,
  component: TourPage,
});

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'not_found' };

function TourPage() {
  const { projectId } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [compareMode, setCompareMode] = useState(false);

  const loadProject = useFloorPlan((s) => s.loadProject);
  const reset = useFloorPlan((s) => s.reset);
  const projectName = useFloorPlan((s) => s.projectName);
  const zones = useFloorPlan((s) => s.zones);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const record = await getProject(projectId);
      if (cancelled) return;
      if (!record) {
        setLoad({ kind: 'not_found' });
        return;
      }
      loadProject(record);
      setLoad({ kind: 'ready' });
    })();
    return () => {
      cancelled = true;
      reset();
    };
  }, [projectId, loadProject, reset]);

  if (load.kind === 'loading') {
    return (
      <main className="mx-auto max-w-7xl px-6 py-16 text-center text-[color:var(--color-text-muted)]">
        {t('editor.loading')}
      </main>
    );
  }

  if (load.kind === 'not_found') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">{t('editor.notFound')}</h1>
        <p className="mt-2 text-[color:var(--color-text-muted)]">
          {t('editor.notFoundHelp')}
        </p>
        <button
          type="button"
          onClick={() => void navigate({ to: '/dashboard' })}
          className="mt-6 rounded-[var(--radius)] bg-[color:var(--color-accent)] px-4 py-2 text-sm text-[color:var(--color-accent-fg)]"
        >
          {t('nav.dashboard')}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            to="/projects/$projectId/editor"
            params={{ projectId }}
            className="text-sm text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
          >
            ← {t('tour.backToEditor')}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {projectName || t('dashboard.untitled')}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
            {t('tour.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {zones.length > 0 && (
            <button
              type="button"
              data-testid="tour-compare-toggle"
              onClick={() => setCompareMode((v) => !v)}
              aria-pressed={compareMode}
              aria-label={compareMode ? t('tour.compareExit') : t('tour.compare')}
              className="rounded-[var(--radius)] border border-[color:var(--color-border)] px-3 py-1.5 text-sm hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] aria-pressed:bg-[color:var(--color-accent)] aria-pressed:text-[color:var(--color-accent-fg)]"
            >
              {compareMode ? t('tour.compareExit') : t('tour.compare')}
            </button>
          )}
          <Link
            to="/projects/$projectId/estimate"
            params={{ projectId }}
            className="rounded-[var(--radius)] border border-[color:var(--color-border)] px-3 py-1.5 text-sm hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
          >
            {t('estimate.viewEstimate')}
          </Link>
        </div>
      </header>

      {zones.length === 0 ? (
        <section className="rounded-[var(--radius-lg)] border border-dashed border-[color:var(--color-border)] p-12 text-center text-sm text-[color:var(--color-text-muted)]">
          {t('tour.noZones')}
        </section>
      ) : (
        <Suspense
          fallback={
            <div className="grid h-[700px] place-items-center rounded-[var(--radius)] border border-[color:var(--color-border)]">
              <span className="text-sm text-[color:var(--color-text-muted)]">
                {t('tour.loadingScene')}
              </span>
            </div>
          }
        >
          {compareMode ? <BeforeAfterCompare /> : <TourScene />}
        </Suspense>
      )}

      <p className="mt-3 text-xs text-[color:var(--color-text-muted)]">
        {t('tour.controlsHint')}
      </p>
    </main>
  );
}
