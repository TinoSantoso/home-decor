import { createFileRoute, Link } from '@tanstack/react-router';
import { Suspense, lazy, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorToolbar } from '../components/editor/EditorToolbar';
import { useFloorPlan } from '../stores/floor-plan';

const FloorPlanCanvas = lazy(
  () => import('../components/editor/FloorPlanCanvas'),
);

export const Route = createFileRoute('/projects/$projectId/editor')({
  ssr: false,
  component: EditorPage,
});

function EditorPage() {
  const { projectId } = Route.useParams();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const reset = useFloorPlan((s) => s.reset);

  useEffect(() => {
    setMounted(true);
    return () => reset();
  }, [projectId, reset]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <Link
            to="/dashboard"
            className="text-sm text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
          >
            ← {t('nav.dashboard')}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {t('editor.title')}
          </h1>
          <p className="text-sm text-[color:var(--color-text-muted)]">
            {t('editor.projectId', { id: projectId })}
          </p>
        </div>
      </header>

      <EditorToolbar />

      <div className="mt-4">
        {mounted ? (
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
        ) : (
          <div className="grid h-[700px] place-items-center rounded-[var(--radius)] border border-[color:var(--color-border)]">
            <span className="text-sm text-[color:var(--color-text-muted)]">
              {t('editor.loadingCanvas')}
            </span>
          </div>
        )}
      </div>
    </main>
  );
}
