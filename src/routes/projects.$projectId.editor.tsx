import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorToolbar } from '../components/editor/EditorToolbar';
import { useFloorPlan } from '../stores/floor-plan';
import { getProject, saveProject } from '../lib/db/projects';
import { debounce } from '../lib/debounce';

const FloorPlanCanvas = lazy(
  () => import('../components/editor/FloorPlanCanvas'),
);

export const Route = createFileRoute('/projects/$projectId/editor')({
  ssr: false,
  component: EditorPage,
});

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'not_found' };

function EditorPage() {
  const { projectId } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const loadProject = useFloorPlan((s) => s.loadProject);
  const reset = useFloorPlan((s) => s.reset);
  const projectName = useFloorPlan((s) => s.projectName);
  const setProjectName = useFloorPlan((s) => s.setProjectName);

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

  const persistRef = useRef<ReturnType<typeof debounce<[]>> | null>(null);
  useEffect(() => {
    if (load.kind !== 'ready') return;
    const persist = debounce(() => {
      const record = useFloorPlan.getState().toProjectRecord();
      if (!record) return;
      setSaveStatus('saving');
      void saveProject(record).then(() => setSaveStatus('saved'));
    }, 400);
    persistRef.current = persist;

    const unsubscribe = useFloorPlan.subscribe((state, prev) => {
      const watched: Array<keyof typeof state> = [
        'zones',
        'projectName',
        'budgetTier',
        'contingencyPct',
        'taxEnabled',
        'placedItems',
      ];
      if (watched.some((k) => state[k] !== prev[k])) persist();
    });

    return () => {
      unsubscribe();
      persist.flush();
      persistRef.current = null;
    };
  }, [load.kind]);

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
            to="/dashboard"
            className="text-sm text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
          >
            ← {t('nav.dashboard')}
          </Link>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            aria-label={t('editor.projectNameLabel')}
            className="mt-1 w-full bg-transparent text-2xl font-semibold tracking-tight outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
          />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[color:var(--color-text-muted)]">
            {saveStatus === 'saving' && t('editor.saving')}
            {saveStatus === 'saved' && t('editor.saved')}
          </span>
          <Link
            to="/projects/$projectId/estimate"
            params={{ projectId }}
            className="rounded-[var(--radius)] border border-[color:var(--color-border)] px-3 py-1.5 text-sm hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
          >
            {t('estimate.viewEstimate')}
          </Link>
        </div>
      </header>

      <EditorToolbar />

      <div className="mt-4">
        <Suspense
          fallback={
            <div className="grid h-[700px] place-items-center rounded-[var(--radius)] border border-[color:var(--color-border)]">
              <span className="text-sm text-[color:var(--color-text-muted)]">
                {t('editor.loadingCanvas')}
              </span>
            </div>
          }
        >
          <FloorPlanCanvas />
        </Suspense>
      </div>
    </main>
  );
}
