import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type Item,
  type ItemCategory,
  type StyleTag,
  ITEM_CATEGORIES,
  STYLE_TAGS,
  filterItems,
  loadCatalog,
  pickItemName,
} from '../lib/catalog';
import type { BudgetTier } from '../lib/cost-engine';
import { ZONE_TYPES, type ZoneType } from '../lib/zones';
import { formatIDR } from '../lib/currency';

export const Route = createFileRoute('/catalog')({
  ssr: false,
  component: CatalogPage,
});

const TIERS: readonly BudgetTier[] = ['hemat', 'standar', 'premium', 'mewah'];

type IndoorMode = 'all' | 'indoor' | 'outdoor';

function CatalogPage() {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<Item[] | null>(null);
  const [category, setCategory] = useState<ItemCategory | null>(null);
  const [styleTag, setStyleTag] = useState<StyleTag | null>(null);
  const [zoneType, setZoneType] = useState<ZoneType | null>(null);
  const [indoorMode, setIndoorMode] = useState<IndoorMode>('all');
  const [tier, setTier] = useState<BudgetTier>('standar');
  const [search, setSearch] = useState('');

  useEffect(() => {
    void loadCatalog().then(setItems);
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    return filterItems(items, {
      ...(category ? { category } : {}),
      ...(styleTag ? { styleTag } : {}),
      ...(zoneType ? { zoneType } : {}),
      ...(indoorMode === 'indoor' ? { indoor: true } : {}),
      ...(indoorMode === 'outdoor' ? { outdoor: true } : {}),
      tier,
      searchText: search,
    });
  }, [items, category, styleTag, zoneType, indoorMode, tier, search]);

  const localeTag = i18n.language === 'id' ? 'id-ID' : 'en-US';

  const clearAllFilters = () => {
    setCategory(null);
    setStyleTag(null);
    setZoneType(null);
    setIndoorMode('all');
    setSearch('');
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <Link
            to="/dashboard"
            className="text-sm text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
          >
            ← {t('nav.dashboard')}
          </Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {t('catalog.title')}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
            {t('catalog.subtitle')}
          </p>
        </div>
        <div className="text-xs text-[color:var(--color-text-muted)]">
          {items === null
            ? t('catalog.loading')
            : t('catalog.countSummary', { count: filtered.length })}
        </div>
      </header>

      <section
        aria-labelledby="filters"
        className="mb-6 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] p-5"
      >
        <h2 id="filters" className="sr-only">
          {t('catalog.filters')}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label
              htmlFor="catalog-search"
              className="text-xs uppercase tracking-wide text-[color:var(--color-text-muted)]"
            >
              {t('catalog.search')}
            </label>
            <input
              id="catalog-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('catalog.searchPlaceholder')}
              className="mt-2 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[color:var(--color-accent)]"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-[color:var(--color-text-muted)]">
              {t('catalog.tier')}
            </label>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {TIERS.map((tt) => {
                const active = tt === tier;
                return (
                  <button
                    key={tt}
                    type="button"
                    onClick={() => setTier(tt)}
                    aria-pressed={active}
                    className={
                      'rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm transition ' +
                      (active
                        ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)]'
                        : 'border-[color:var(--color-border)] hover:border-[color:var(--color-accent)]')
                    }
                  >
                    {t(`budget.tier.${tt}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-[color:var(--color-text-muted)]">
              {t('catalog.location')}
            </label>
            <div className="mt-2 inline-flex rounded-[var(--radius-sm)] border border-[color:var(--color-border)] p-0.5">
              {(['all', 'indoor', 'outdoor'] as const).map((mode) => {
                const active = mode === indoorMode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setIndoorMode(mode)}
                    aria-pressed={active}
                    className={
                      'rounded-[var(--radius-sm)] px-3 py-1 text-xs transition ' +
                      (active
                        ? 'bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)]'
                        : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]')
                    }
                  >
                    {t(`catalog.location_${mode}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-[color:var(--color-text-muted)]">
            {t('catalog.category')}:
          </span>
          <FilterChip
            label={t('catalog.all')}
            active={category === null}
            onClick={() => setCategory(null)}
          />
          {ITEM_CATEGORIES.map((c) => (
            <FilterChip
              key={c}
              label={t(`costCategory.${c}`)}
              active={category === c}
              onClick={() => setCategory(category === c ? null : c)}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-[color:var(--color-text-muted)]">
            {t('catalog.style')}:
          </span>
          <FilterChip
            label={t('catalog.all')}
            active={styleTag === null}
            onClick={() => setStyleTag(null)}
          />
          {STYLE_TAGS.map((s) => (
            <FilterChip
              key={s}
              label={t(`style.${s}`)}
              active={styleTag === s}
              onClick={() => setStyleTag(styleTag === s ? null : s)}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-[color:var(--color-text-muted)]">
            {t('catalog.zone')}:
          </span>
          <select
            value={zoneType ?? ''}
            onChange={(e) =>
              setZoneType((e.target.value as ZoneType) || null)
            }
            className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-2 py-1 text-sm outline-none focus:border-[color:var(--color-accent)]"
          >
            <option value="">{t('catalog.all')}</option>
            {ZONE_TYPES.map((z) => (
              <option key={z} value={z}>
                {t(`zoneType.${z}`)}
              </option>
            ))}
          </select>

          {(category ||
            styleTag ||
            zoneType ||
            indoorMode !== 'all' ||
            search) && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-auto rounded-[var(--radius-sm)] border border-transparent px-2 py-1 text-xs text-[color:var(--color-text-muted)] hover:border-[color:var(--color-border)] hover:text-[color:var(--color-text)]"
            >
              {t('catalog.clear')}
            </button>
          )}
        </div>
      </section>

      {items !== null && filtered.length === 0 && (
        <section className="rounded-[var(--radius-lg)] border border-dashed border-[color:var(--color-border)] p-12 text-center">
          <p className="text-[color:var(--color-text-muted)]">
            {t('catalog.empty')}
          </p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="mt-4 text-sm text-[color:var(--color-accent)] hover:underline"
          >
            {t('catalog.clear')}
          </button>
        </section>
      )}

      {filtered.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <li
              key={item.id}
              className="overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
            >
              <Thumbnail item={item} locale={i18n.language} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium">
                      {pickItemName(item, i18n.language)}
                    </h3>
                    <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
                      {t(`costCategory.${item.category}`)} · {item.subcategory}
                    </p>
                  </div>
                  <span className="rounded-[var(--radius-sm)] bg-[color:var(--color-bg)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[color:var(--color-text-muted)]">
                    {t(`budget.tier.${tier}`)}
                  </span>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div className="text-lg font-semibold tabular-nums">
                    {formatIDR(item.priceIdr[tier], localeTag)}
                  </div>
                  <div className="text-right text-[10px] text-[color:var(--color-text-muted)]">
                    {item.dimensions.widthCm}×{item.dimensions.depthCm}×
                    {item.dimensions.heightCm} cm
                  </div>
                </div>
                {item.styleTags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {item.styleTags.map((s) => (
                      <span
                        key={s}
                        className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-1.5 py-0.5 text-[10px] text-[color:var(--color-text-muted)]"
                      >
                        {t(`style.${s}`)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function FilterChip({
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
      className={
        'rounded-full border px-3 py-1 text-xs transition ' +
        (active
          ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)]'
          : 'border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text)]')
      }
    >
      {label}
    </button>
  );
}

function Thumbnail({ item, locale }: { item: Item; locale: string }) {
  const initials = pickItemName(item, locale)
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const style = {
    background: `linear-gradient(135deg, ${item.thumbnailHint} 0%, color-mix(in oklch, ${item.thumbnailHint} 70%, black) 100%)`,
  };
  return (
    <div
      aria-hidden
      style={style}
      className="grid h-32 place-items-center text-2xl font-semibold tracking-wide text-white/90"
    >
      <span className="drop-shadow-sm">{initials}</span>
    </div>
  );
}
