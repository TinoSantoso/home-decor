import { useTranslation } from 'react-i18next';
import { ZONE_TYPES, type ZoneType, isIndoor } from '../../lib/zones';
import { STYLE_TAGS } from '../../lib/catalog';
import { useFloorPlan } from '../../stores/floor-plan';
import { cn } from '../../lib/cn';

export function EditorToolbar() {
  const { t } = useTranslation();
  const addZone = useFloorPlan((s) => s.addZone);
  const zones = useFloorPlan((s) => s.zones);
  const selectedZoneId = useFloorPlan((s) => s.selectedZoneId);
  const deleteZone = useFloorPlan((s) => s.deleteZone);
  const snapEnabled = useFloorPlan((s) => s.snapEnabled);
  const setSnapEnabled = useFloorPlan((s) => s.setSnapEnabled);
  const styleTag = useFloorPlan((s) => s.styleTag);
  const setStyleTag = useFloorPlan((s) => s.setStyleTag);

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-[color:var(--color-text-muted)]">
          {t('editor.addZone')}:
        </span>
        {ZONE_TYPES.map((type) => (
          <ZoneButton key={type} type={type} onClick={() => addZone(type, t(`zoneType.${type}`))} />
        ))}
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-[color:var(--color-text-muted)]">
            {t('editor.zoneCount', { count: zones.length })}
          </span>
          <button
            type="button"
            disabled={!selectedZoneId}
            onClick={() => selectedZoneId && deleteZone(selectedZoneId)}
            className="rounded-[var(--radius)] border border-[color:var(--color-danger)] px-3 py-1 text-sm text-[color:var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('editor.deleteSelected')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--color-border)] pt-3">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={snapEnabled}
            onChange={(e) => setSnapEnabled(e.target.checked)}
            className="h-4 w-4 accent-[color:var(--color-accent)]"
          />
          <span>{t('editor.snapToGrid')}</span>
        </label>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[color:var(--color-text-muted)]">
            {t('editor.style')}:
          </span>
          <StyleChip
            label={t('catalog.all')}
            active={styleTag === null}
            onClick={() => setStyleTag(null)}
          />
          {STYLE_TAGS.map((s) => (
            <StyleChip
              key={s}
              label={t(`style.${s}`)}
              active={styleTag === s}
              onClick={() => setStyleTag(styleTag === s ? null : s)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ZoneButton({ type, onClick }: { type: ZoneType; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-[var(--radius-sm)] border px-2 py-1 text-xs',
        isIndoor(type)
          ? 'border-[color:var(--color-border)] bg-white'
          : 'border-[color:var(--color-success)] bg-[oklch(96%_0.02_140)]',
      )}
    >
      {t(`zoneType.${type}`)}
    </button>
  );
}

function StyleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-2 py-0.5 text-xs transition',
        active
          ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)]'
          : 'border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-accent)]',
      )}
    >
      {label}
    </button>
  );
}
