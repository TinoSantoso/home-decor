/**
 * Catalog domain types + helpers. The actual seed data lives in
 * `src/data/catalog.seed.json` and is fetched lazily via `loadCatalog()`
 * so it never lands in the main bundle.
 *
 * `Item.category` is intentionally a strict subset of `CostCategory` so
 * placed items flow into the engine's labor-rate buckets directly.
 */

import type { BudgetTier, CostCategory } from './cost-engine';
import type { ZoneType } from './zones';

export type ItemCategory = Extract<
  CostCategory,
  'furniture' | 'lighting' | 'plant' | 'accessory' | 'fixture'
>;

export const ITEM_CATEGORIES: readonly ItemCategory[] = [
  'furniture',
  'lighting',
  'plant',
  'accessory',
  'fixture',
];

export const STYLE_TAGS = [
  'japandi',
  'tropical_modern',
  'minimalis_skandinavia',
  'industrial',
] as const;
export type StyleTag = (typeof STYLE_TAGS)[number];

export const CLIMATE_TAGS = [
  'tropical',
  'humid',
  'uv_resistant',
  'monsoon',
  'anti_mold',
] as const;
export type ClimateTag = (typeof CLIMATE_TAGS)[number];

export interface ItemDimensions {
  widthCm: number;
  depthCm: number;
  heightCm: number;
}

export interface Item {
  id: string;
  name: { id: string; en: string };
  category: ItemCategory;
  subcategory: string;
  styleTags: StyleTag[];
  zoneTags: ZoneType[];
  indoorOk: boolean;
  outdoorOk: boolean;
  climateTags: ClimateTag[];
  dimensions: ItemDimensions;
  durabilityScore: number;
  maintenanceScore: number;
  /** Optional curated-popularity weight 0–100. Defaults to 50 in the recommendation engine. */
  popularityScore?: number;
  priceIdr: Record<BudgetTier, number>;
  thumbnailHint: string;
  /** Optional URL or bare R2 key for a real GLB mesh rendered in the tour scene. */
  asset3dUrl?: string;
  alternatives: string[];
}

export interface ItemFilter {
  category?: ItemCategory;
  styleTag?: StyleTag;
  zoneType?: ZoneType;
  indoor?: boolean;
  outdoor?: boolean;
  tier?: BudgetTier;
  searchText?: string;
}

let catalogPromise: Promise<Item[]> | null = null;

export function loadCatalog(): Promise<Item[]> {
  if (!catalogPromise) {
    catalogPromise = import('../data/catalog.seed.json').then(
      (mod) => mod.default as Item[],
    );
  }
  return catalogPromise;
}

/**
 * Reset the cached catalog promise. Test-only.
 */
export function __resetCatalogCache(): void {
  catalogPromise = null;
}

/**
 * Tier-aware price ceilings. An item is "in tier" if its price for that
 * tier exists — items always have all four prices, so this is currently
 * a no-op gate. The shape is here so we can later mark items as
 * tier-unavailable (e.g. true luxury pieces have no `hemat` price).
 */
export function isInTier(item: Item, tier: BudgetTier): boolean {
  const price = item.priceIdr[tier] ?? 0;
  return Number.isFinite(price) && price > 0;
}

export function filterItems(items: Item[], filter: ItemFilter): Item[] {
  const search = filter.searchText?.trim().toLowerCase() ?? '';
  return items.filter((item) => {
    if (filter.category && item.category !== filter.category) return false;
    if (filter.styleTag && !item.styleTags.includes(filter.styleTag)) return false;
    if (filter.zoneType && !item.zoneTags.includes(filter.zoneType)) return false;
    if (filter.indoor === true && !item.indoorOk) return false;
    if (filter.outdoor === true && !item.outdoorOk) return false;
    if (filter.tier && !isInTier(item, filter.tier)) return false;
    if (search) {
      const haystack = `${item.name.id} ${item.name.en} ${item.subcategory}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function pickItemName(item: Item, locale: string): string {
  return locale.startsWith('id') ? item.name.id : item.name.en;
}
