import { useTranslation } from 'react-i18next';
import { useFloorPlan } from '../../stores/floor-plan';

export function FloorSelector() {
  const { t } = useTranslation();
  const layout = useFloorPlan((s) => s.layoutV2);
  const setActiveFloor = useFloorPlan((s) => s.setActiveFloor);
  const addFloor = useFloorPlan((s) => s.addFloor);

  if (!layout) return null;

  return (
    <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[color:var(--color-border)] px-3 py-2 text-sm">
      <label htmlFor="layout-floor-select" className="text-[color:var(--color-text-muted)]">
        {t('layoutV2.floor')}
      </label>
      <select
        id="layout-floor-select"
        value={layout.activeFloorId}
        onChange={(event) => setActiveFloor(event.target.value)}
        className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-2 py-1"
      >
        {layout.floors.map((floor) => (
          <option key={floor.id} value={floor.id}>
            {floor.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => addFloor()}
        className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-2 py-1 hover:border-[color:var(--color-accent)]"
      >
        {t('layoutV2.addFloor')}
      </button>
    </div>
  );
}
