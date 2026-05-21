import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFloorPlan } from '../../stores/floor-plan';
import { loadCatalog, pickItemName } from '../../lib/catalog';
import type { Item } from '../../lib/catalog';

/**
 * Sidebar overlay for 3D item placement (Phase 2 slice 3).
 * Rendered OUTSIDE the R3F `<Canvas>` as a plain DOM element.
 *
 * Allows the user to:
 *  1. Pick a zone from a dropdown.
 *  2. Pick a catalog item from a dropdown.
 *  3. Toggle placement mode on/off.
 *
 * While placement mode is on, clicking a zone box in the scene fires
 * `placeItemAt` with the selected item.
 */
export function ItemPlacementPanel() {
  const { t, i18n } = useTranslation();

  const zones = useFloorPlan((s) => s.zones);
  const placementMode = useFloorPlan((s) => s.placementMode);
  const setPlacementMode = useFloorPlan((s) => s.setPlacementMode);
  const setPendingPlacementItemId = useFloorPlan((s) => s.setPendingPlacementItemId);
  const selectZone = useFloorPlan((s) => s.selectZone);

  const [catalog, setCatalog] = useState<Item[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  useEffect(() => {
    loadCatalog().then(setCatalog).catch(() => undefined);
  }, []);

  // Sync dropdown to the first zone when zones load or change.
  useEffect(() => {
    if (zones.length > 0 && !selectedZoneId) {
      setSelectedZoneId(zones[0]!.id);
    }
  }, [zones, selectedZoneId]);

  // Sync dropdown to the first catalog item when catalog loads.
  useEffect(() => {
    if (catalog.length > 0 && !selectedItemId) {
      setSelectedItemId(catalog[0]!.id);
    }
  }, [catalog, selectedItemId]);

  // Derive the display name of the currently-selected item.
  const selectedItemName = useMemo(() => {
    const item = catalog.find((c) => c.id === selectedItemId);
    return item ? pickItemName(item, i18n.language) : '';
  }, [catalog, selectedItemId, i18n.language]);

  function handleTogglePlacement() {
    if (placementMode) {
      setPlacementMode(false);
      setPendingPlacementItemId(null);
    } else {
      // Select the chosen zone in the store so the scene highlights it.
      if (selectedZoneId) selectZone(selectedZoneId);
      setPendingPlacementItemId(selectedItemId || null);
      setPlacementMode(true);
    }
  }

  const canActivate = selectedZoneId !== '' && selectedItemId !== '';

  return (
    <div className="absolute left-4 top-4 z-10 w-56 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-black/70 p-3 text-white backdrop-blur-sm">
      <p className="mb-2 text-sm font-semibold">{t('tour.placement.title')}</p>

      {/* Zone picker */}
      {zones.length === 0 ? (
        <p className="mb-2 text-xs text-white/60">{t('tour.placement.noZones')}</p>
      ) : (
        <div className="mb-2">
          <label className="mb-0.5 block text-xs text-white/70">
            {t('tour.placement.selectZone')}
          </label>
          <select
            value={selectedZoneId}
            onChange={(e) => setSelectedZoneId(e.target.value)}
            className="w-full rounded bg-black/40 px-2 py-1 text-xs text-white focus:outline-none"
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Item picker */}
      {catalog.length === 0 ? (
        <p className="mb-2 text-xs text-white/60">{t('tour.placement.noCatalog')}</p>
      ) : (
        <div className="mb-3">
          <label className="mb-0.5 block text-xs text-white/70">
            {t('tour.placement.selectItem')}
          </label>
          <select
            value={selectedItemId}
            onChange={(e) => {
              setSelectedItemId(e.target.value);
              if (placementMode) setPendingPlacementItemId(e.target.value);
            }}
            className="w-full rounded bg-black/40 px-2 py-1 text-xs text-white focus:outline-none"
            title={selectedItemName}
          >
            {catalog.map((item) => (
              <option key={item.id} value={item.id}>
                {pickItemName(item, i18n.language)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Placement mode toggle */}
      <button
        type="button"
        onClick={handleTogglePlacement}
        disabled={!canActivate}
        data-testid="placement-mode-toggle"
        aria-pressed={placementMode}
        className="w-full rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          background: placementMode ? '#16a34a' : 'rgba(255,255,255,0.15)',
        }}
      >
        {placementMode
          ? t('tour.placement.deactivateMode')
          : t('tour.placement.activateMode')}
      </button>

      {/* Status hint */}
      {placementMode && (
        <p className="mt-2 text-[10px] leading-tight text-green-300">
          {t('tour.placement.modeActive')}
        </p>
      )}
    </div>
  );
}
