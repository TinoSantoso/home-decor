import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFloorPlan } from '../../stores/floor-plan';
import {
  ZONE_TYPES,
  type ZoneType,
  isIndoor,
  zoneAreaM2,
} from '../../lib/zones';
import {
  loadCatalog,
  pickItemName,
  type Item,
} from '../../lib/catalog';
import {
  rankRecommendations,
  topNPerCategory,
  type ScoredRecommendation,
} from '../../lib/recommendation';
import { formatIDR } from '../../lib/currency';
import { cn } from '../../lib/cn';

type Tab = 'properties' | 'recommendations' | 'placed';

export function ZoneDetailPanel() {
  const { t, i18n } = useTranslation();
  const selectedZoneId = useFloorPlan((s) => s.selectedZoneId);
  // Select raw slices; derive filtered views via useMemo so we never return
  // a fresh array from a Zustand selector (would trip React's getSnapshot
  // cache and produce an infinite re-render loop).
  const zones = useFloorPlan((s) => s.zones);
  const allPlacedItems = useFloorPlan((s) => s.placedItems);
  const zone = useMemo(
    () => zones.find((z) => z.id === selectedZoneId) ?? null,
    [zones, selectedZoneId],
  );
  const placedItems = useMemo(
    () => allPlacedItems.filter((p) => p.zoneId === selectedZoneId),
    [allPlacedItems, selectedZoneId],
  );
  const updateZone = useFloorPlan((s) => s.updateZone);
  const addPlacedItem = useFloorPlan((s) => s.addPlacedItem);
  const updatePlacedItem = useFloorPlan((s) => s.updatePlacedItem);
  const removePlacedItem = useFloorPlan((s) => s.removePlacedItem);
  const budgetTier = useFloorPlan((s) => s.budgetTier);
  const styleTag = useFloorPlan((s) => s.styleTag);

  const [tab, setTab] = useState<Tab>('properties');
  const [catalog, setCatalog] = useState<Item[] | null>(null);

  useEffect(() => {
    if (tab !== 'recommendations' && tab !== 'placed') return;
    if (catalog) return;
    void loadCatalog().then(setCatalog);
  }, [tab, catalog]);

  const recommendations = useMemo<ScoredRecommendation[]>(() => {
    if (!catalog || !zone) return [];
    const ranked = rankRecommendations(catalog, {
      zoneType: zone.type,
      zoneIndoor: isIndoor(zone.type),
      budgetTier,
      styleTag,
    });
    return topNPerCategory(ranked, 4);
  }, [catalog, zone, budgetTier, styleTag]);

  const placedDetail = useMemo(() => {
    if (!catalog) return placedItems.map((p) => ({ record: p, item: null as Item | null }));
    const byId = new Map(catalog.map((it) => [it.id, it]));
    return placedItems.map((p) => ({ record: p, item: byId.get(p.itemId) ?? null }));
  }, [placedItems, catalog]);

  if (!selectedZoneId || !zone) {
    return (
      <aside className="rounded-[var(--radius-lg)] border border-dashed border-[color:var(--color-border)] p-8 text-center text-sm text-[color:var(--color-text-muted)]">
        {t('editor.selectZoneHint')}
      </aside>
    );
  }

  const localeTag = i18n.language === 'id' ? 'id-ID' : 'en-US';

  return (
    <aside className="flex flex-col rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
      <header className="border-b border-[color:var(--color-border)] p-4">
        <p className="text-xs uppercase tracking-wide text-[color:var(--color-text-muted)]">
          {t(`zoneType.${zone.type}`)} · {zoneAreaM2(zone).toFixed(1)} m²
        </p>
        <input
          type="text"
          value={zone.name}
          onChange={(e) => updateZone(zone.id, { name: e.target.value })}
          aria-label={t('editor.zoneNameLabel')}
          className="mt-1 w-full bg-transparent text-lg font-semibold tracking-tight outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
        />
      </header>

      <nav className="flex border-b border-[color:var(--color-border)] text-sm">
        <TabButton active={tab === 'properties'} onClick={() => setTab('properties')}>
          {t('editor.tab.properties')}
        </TabButton>
        <TabButton active={tab === 'recommendations'} onClick={() => setTab('recommendations')}>
          {t('editor.tab.recommendations')}
        </TabButton>
        <TabButton active={tab === 'placed'} onClick={() => setTab('placed')}>
          {t('editor.tab.placed', { count: placedItems.length })}
        </TabButton>
      </nav>

      <div className="max-h-[640px] overflow-y-auto p-4">
        {tab === 'properties' && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="zone-type-select"
                className="text-xs uppercase tracking-wide text-[color:var(--color-text-muted)]"
              >
                {t('editor.zoneType')}
              </label>
              <select
                id="zone-type-select"
                value={zone.type}
                onChange={(e) => updateZone(zone.id, { type: e.target.value as ZoneType })}
                className="mt-2 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[color:var(--color-accent)]"
              >
                {ZONE_TYPES.map((z) => (
                  <option key={z} value={z}>
                    {t(`zoneType.${z}`)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                {isIndoor(zone.type)
                  ? t('editor.zoneTypeHintIndoor')
                  : t('editor.zoneTypeHintOutdoor')}
              </p>
            </div>
          </div>
        )}

        {tab === 'recommendations' && (
          <div>
            {catalog === null && (
              <p className="text-sm text-[color:var(--color-text-muted)]">
                {t('catalog.loading')}
              </p>
            )}
            {catalog !== null && recommendations.length === 0 && (
              <p className="text-sm text-[color:var(--color-text-muted)]">
                {t('editor.noRecommendations')}
              </p>
            )}
            {recommendations.length > 0 && (
              <ul className="space-y-2">
                {recommendations.map((rec) => (
                  <li
                    key={rec.item.id}
                    className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        aria-hidden
                        style={{ background: rec.item.thumbnailHint }}
                        className="h-10 w-10 shrink-0 rounded-[var(--radius-sm)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-medium">
                            {pickItemName(rec.item, i18n.language)}
                          </p>
                          <PriorityBadge priority={rec.priority} />
                        </div>
                        <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
                          {t(`costCategory.${rec.item.category}`)} ·{' '}
                          {formatIDR(rec.item.priceIdr[budgetTier], localeTag)}
                        </p>
                        {rec.reasons.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {rec.reasons.map((r) => (
                              <span
                                key={r}
                                className="rounded-[var(--radius-sm)] bg-[color:var(--color-bg)] px-1.5 py-0.5 text-[10px] text-[color:var(--color-text-muted)]"
                              >
                                {t(`reason.${r}`)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addPlacedItem(zone.id, rec.item.id)}
                      className="mt-3 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-accent)] px-3 py-1 text-xs text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)] hover:text-[color:var(--color-accent-fg)]"
                    >
                      + {t('editor.addToZone')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'placed' && (
          <div>
            {placedDetail.length === 0 && (
              <p className="text-sm text-[color:var(--color-text-muted)]">
                {t('editor.noPlacedItems')}
              </p>
            )}
            {placedDetail.length > 0 && (
              <ul className="space-y-2">
                {placedDetail.map(({ record, item }) => (
                  <li
                    key={record.id}
                    className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] p-2"
                  >
                    <div
                      aria-hidden
                      style={{ background: item?.thumbnailHint ?? 'oklch(80% 0 0)' }}
                      className="h-8 w-8 shrink-0 rounded-[var(--radius-sm)]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {item ? pickItemName(item, i18n.language) : record.itemId}
                      </p>
                      <p className="text-xs text-[color:var(--color-text-muted)]">
                        {item
                          ? formatIDR(item.priceIdr[budgetTier] * record.quantity, localeTag)
                          : t('editor.itemMissing')}
                      </p>
                    </div>
                    <QuantityControl
                      value={record.quantity}
                      onChange={(q) => updatePlacedItem(record.id, { quantity: q })}
                    />
                    <button
                      type="button"
                      aria-label={t('editor.removeItem')}
                      onClick={() => removePlacedItem(record.id)}
                      className="rounded-[var(--radius-sm)] border border-transparent px-2 py-1 text-xs text-[color:var(--color-text-muted)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)]"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex-1 border-b-2 px-3 py-2 transition',
        active
          ? 'border-[color:var(--color-accent)] text-[color:var(--color-text)]'
          : 'border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]',
      )}
    >
      {children}
    </button>
  );
}

function PriorityBadge({ priority }: { priority: ScoredRecommendation['priority'] }) {
  const { t } = useTranslation();
  const styles =
    priority === 'esensial'
      ? 'border-[color:var(--color-accent)] text-[color:var(--color-accent)]'
      : priority === 'direkomendasikan'
        ? 'border-[color:var(--color-success)] text-[color:var(--color-success)]'
        : 'border-[color:var(--color-border)] text-[color:var(--color-text-muted)]';
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide', styles)}>
      {t(`priority.${priority === 'esensial' ? 'essential' : priority === 'direkomendasikan' ? 'recommended' : 'optional'}`)}
    </span>
  );
}

function QuantityControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-2 leading-6 hover:border-[color:var(--color-accent)]"
        aria-label="decrement"
      >
        −
      </button>
      <span className="w-6 text-center tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-2 leading-6 hover:border-[color:var(--color-accent)]"
        aria-label="increment"
      >
        +
      </button>
    </div>
  );
}
