import { useTranslation } from 'react-i18next';
import { useFloorPlan } from '../../stores/floor-plan';

export function LayoutModeToggle() {
  const { t } = useTranslation();
  const layoutMode = useFloorPlan((s) => s.layoutMode);
  const setLayoutMode = useFloorPlan((s) => s.setLayoutMode);

  return (
    <div className="inline-flex rounded-[var(--radius)] border border-[color:var(--color-border)] p-1 text-sm">
      <button
        type="button"
        aria-pressed={layoutMode === 'classic'}
        onClick={() => setLayoutMode('classic')}
        className="rounded-[var(--radius-sm)] px-3 py-1.5 aria-pressed:bg-[color:var(--color-accent)] aria-pressed:text-[color:var(--color-accent-fg)]"
      >
        {t('layoutV2.modeClassic')}
      </button>
      <button
        type="button"
        aria-pressed={layoutMode === 'advanced'}
        onClick={() => setLayoutMode('advanced')}
        className="rounded-[var(--radius-sm)] px-3 py-1.5 aria-pressed:bg-[color:var(--color-accent)] aria-pressed:text-[color:var(--color-accent-fg)]"
      >
        {t('layoutV2.modeAdvanced')}
      </button>
    </div>
  );
}
