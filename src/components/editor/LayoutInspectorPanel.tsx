import { useTranslation } from 'react-i18next';
import { useFloorPlan } from '../../stores/floor-plan';
import type {
  LayoutV2FloorMaterial,
  LayoutV2TerrainMaterial,
} from '../../lib/layout-v2/types';

const FLOOR_MATERIALS: LayoutV2FloorMaterial[] = [
  'tile',
  'wood',
  'concrete',
  'stone',
  'outdoor',
];
const TERRAIN_MATERIALS: LayoutV2TerrainMaterial[] = [
  'grass',
  'paving',
  'gravel',
  'decking',
  'soil',
];

export function LayoutInspectorPanel() {
  const { t } = useTranslation();
  const layout = useFloorPlan((s) => s.layoutV2);
  const selectedAreaId = useFloorPlan((s) => s.selectedLayoutAreaId);
  const selectedWallId = useFloorPlan((s) => s.selectedLayoutWallId);
  const updateAreaMaterials = useFloorPlan((s) => s.updateAreaMaterials);
  const addLayoutArea = useFloorPlan((s) => s.addLayoutArea);
  const addOpening = useFloorPlan((s) => s.addOpening);
  const updateOpening = useFloorPlan((s) => s.updateOpening);
  const removeOpening = useFloorPlan((s) => s.removeOpening);

  if (!layout) return null;
  const area =
    layout.areas.find((candidate) => candidate.id === selectedAreaId) ?? null;
  const wall =
    layout.walls.find((candidate) => candidate.id === selectedWallId) ?? null;
  const wallOpenings = wall
    ? layout.openings.filter((opening) => opening.wallId === wall.id)
    : [];

  return (
    <aside className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <h2 className="font-semibold">{t('layoutV2.inspector')}</h2>
      {!area && !wall && (
        <>
          <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
            {t('layoutV2.selectHint')}
          </p>
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
              {t('layoutV2.quickAdd')}
            </p>
            <button
              type="button"
              onClick={() =>
                addLayoutArea('living_room', t('zoneType.living_room'))
              }
              className="w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 py-2 text-sm hover:border-[color:var(--color-accent)]"
            >
              {t('layoutV2.addLivingArea')}
            </button>
            <button
              type="button"
              onClick={() => addLayoutArea('terrace', t('zoneType.terrace'))}
              className="w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 py-2 text-sm hover:border-[color:var(--color-accent)]"
            >
              {t('layoutV2.addTerraceArea')}
            </button>
          </div>
        </>
      )}

      {area && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium">{area.name}</p>
          <label className="block text-xs uppercase tracking-wide text-[color:var(--color-text-muted)]">
            {t('layoutV2.floorMaterial')}
            <select
              value={area.floorMaterial}
              onChange={(event) =>
                updateAreaMaterials(area.id, {
                  floorMaterial: event.target.value as LayoutV2FloorMaterial,
                })
              }
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-2 py-1 text-sm"
            >
              {FLOOR_MATERIALS.map((value) => (
                <option key={value} value={value}>
                  {t(`layoutV2.floorMaterials.${value}`)}
                </option>
              ))}
            </select>
          </label>
          {area.kind === 'outdoor' && (
            <label className="block text-xs uppercase tracking-wide text-[color:var(--color-text-muted)]">
              {t('layoutV2.terrainMaterial')}
              <select
                value={area.terrainMaterial ?? 'grass'}
                onChange={(event) =>
                  updateAreaMaterials(area.id, {
                    terrainMaterial: event.target
                      .value as LayoutV2TerrainMaterial,
                  })
                }
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-2 py-1 text-sm"
              >
                {TERRAIN_MATERIALS.map((value) => (
                  <option key={value} value={value}>
                    {t(`layoutV2.terrainMaterials.${value}`)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {wall && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">{t('layoutV2.wallSelected')}</p>
          <button
            type="button"
            onClick={() => addOpening(wall.id, 'door')}
            className="w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 py-2 text-sm hover:border-[color:var(--color-accent)]"
          >
            {t('layoutV2.addDoor')}
          </button>
          <button
            type="button"
            onClick={() => addOpening(wall.id, 'window')}
            className="w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 py-2 text-sm hover:border-[color:var(--color-accent)]"
          >
            {t('layoutV2.addWindow')}
          </button>
          <div className="pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
              {t('layoutV2.openings')}
            </p>
            {wallOpenings.length === 0 && (
              <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
                {t('layoutV2.noOpenings')}
              </p>
            )}
            {wallOpenings.map((opening, index) => {
              const openingNumber = index + 1;
              const openingTypeLabel = t(`layoutV2.openingType.${opening.type}`);
              const offsetLabel =
                opening.type === 'door'
                  ? t('layoutV2.doorOffsetIndexed', { index: openingNumber })
                  : t('layoutV2.windowOffsetIndexed', {
                      index: openingNumber,
                    });
              return (
                <div
                  key={opening.id}
                  className="mt-3 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] p-3"
                >
                  <p className="text-xs font-medium capitalize text-[color:var(--color-text-muted)]">
                    {openingTypeLabel} {openingNumber}
                  </p>
                  <label className="mt-2 block text-xs text-[color:var(--color-text-muted)]">
                    {offsetLabel}
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={opening.offsetM}
                      onChange={(event) =>
                        updateOpening(opening.id, {
                          offsetM: Number(event.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="mt-2 block text-xs text-[color:var(--color-text-muted)]">
                    {t('layoutV2.openingWidthIndexed', {
                      index: openingNumber,
                    })}
                    <input
                      type="number"
                      min={0.3}
                      step={0.1}
                      value={opening.widthM}
                      onChange={(event) =>
                        updateOpening(opening.id, {
                          widthM: Number(event.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-2 py-1 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeOpening(opening.id)}
                    className="mt-2 text-xs text-red-600 hover:underline"
                  >
                    {t('layoutV2.removeOpeningIndexed', {
                      index: openingNumber,
                    })}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
