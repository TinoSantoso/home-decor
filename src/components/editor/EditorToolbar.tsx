import { useTranslation } from 'react-i18next';
import { ZONE_TYPES, type ZoneType, isIndoor } from '../../lib/zones';
import { useFloorPlan } from '../../stores/floor-plan';
import { cn } from '../../lib/cn';

export function EditorToolbar() {
  const { t } = useTranslation();
  const addZone = useFloorPlan((s) => s.addZone);
  const zones = useFloorPlan((s) => s.zones);
  const selectedZoneId = useFloorPlan((s) => s.selectedZoneId);
  const deleteZone = useFloorPlan((s) => s.deleteZone);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
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
