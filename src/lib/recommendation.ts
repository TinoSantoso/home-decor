/**
 * Recommendation engine — plan §8.
 *
 * Pure, isomorphic functions. No I/O. The catalog is passed in; the engine
 * decides what is `esensial / direkomendasikan / opsional` for a given
 * (zone, style, tier) tuple.
 *
 * Scoring (0–100):
 *   style match (tag overlap)               40
 *   durability + climate fit                20
 *   price-fit (distance from category-tier median)  20
 *   popularity / curated weight             10
 *   maintenance ease                        10
 */

import type { Item, ItemCategory, StyleTag } from './catalog';
import type { BudgetTier } from './cost-engine';
import type { ZoneType } from './zones';

export type Priority = 'esensial' | 'direkomendasikan' | 'opsional';

export type ReasonTag =
  | 'style_match'
  | 'climate_fit'
  | 'durable'
  | 'low_maintenance'
  | 'tier_fit'
  | 'essential_for_zone';

export interface RecommendationInput {
  zoneType: ZoneType;
  zoneIndoor: boolean;
  budgetTier: BudgetTier;
  styleTag: StyleTag | null;
}

export interface ScoredRecommendation {
  item: Item;
  score: number;
  priority: Priority;
  reasons: ReasonTag[];
}

/**
 * Categories that are typically essential for each zone type.
 * Items in these categories get `esensial` priority for that zone.
 */
const ESSENTIAL_CATEGORIES_BY_ZONE: Record<ZoneType, ItemCategory[]> = {
  living_room: ['furniture', 'lighting'],
  bedroom: ['furniture', 'lighting'],
  kitchen: ['fixture', 'lighting'],
  bathroom: ['fixture'],
  dining: ['furniture', 'lighting'],
  office: ['furniture', 'lighting'],
  terrace: ['furniture', 'lighting'],
  garden: ['plant', 'lighting'],
  carport: ['lighting'],
  facade: ['lighting'],
  balcony: ['furniture'],
  backyard: ['plant', 'furniture'],
};

const DEFAULT_POPULARITY = 50;

interface CategoryTierMedian {
  category: ItemCategory;
  tier: BudgetTier;
  median: number;
}

function computeMedians(catalog: Item[]): Map<string, number> {
  const groups = new Map<string, number[]>();
  for (const item of catalog) {
    for (const tier of ['hemat', 'standar', 'premium', 'mewah'] as BudgetTier[]) {
      const key = `${item.category}:${tier}`;
      const price = item.priceIdr[tier];
      if (!Number.isFinite(price) || price <= 0) continue;
      const bucket = groups.get(key) ?? [];
      bucket.push(price);
      groups.set(key, bucket);
    }
  }
  const out = new Map<string, number>();
  for (const [key, prices] of groups) {
    prices.sort((a, b) => a - b);
    const mid = prices.length === 0 ? 0 : (prices[Math.floor(prices.length / 2)] ?? 0);
    out.set(key, mid);
  }
  return out;
}

function styleScore(item: Item, styleTag: StyleTag | null): number {
  if (!styleTag) return 0.5;
  return item.styleTags.includes(styleTag) ? 1 : 0.25;
}

function climateScore(item: Item, indoor: boolean): number {
  if (indoor) return item.indoorOk ? 1 : 0;
  if (!item.outdoorOk) return 0;
  return item.climateTags.length > 0 ? 1 : 0.6;
}

function priceFitScore(item: Item, tier: BudgetTier, medians: Map<string, number>): number {
  const itemPrice = item.priceIdr[tier];
  const median = medians.get(`${item.category}:${tier}`) ?? itemPrice;
  if (median <= 0 || itemPrice <= 0) return 0.5;
  return Math.min(itemPrice, median) / Math.max(itemPrice, median);
}

function durabilityFactor(item: Item): number {
  return Math.max(0, Math.min(1, item.durabilityScore / 5));
}

function maintenanceFactor(item: Item): number {
  // maintenanceScore: 1 (easy) – 5 (hard). Lower is better.
  return Math.max(0, Math.min(1, (6 - item.maintenanceScore) / 5));
}

function popularityFactor(item: Item): number {
  const raw = item.popularityScore ?? DEFAULT_POPULARITY;
  return Math.max(0, Math.min(1, raw / 100));
}

function collectReasons(
  item: Item,
  input: RecommendationInput,
  priceFit: number,
  isEssential: boolean,
): ReasonTag[] {
  const reasons: ReasonTag[] = [];
  if (input.styleTag && item.styleTags.includes(input.styleTag)) reasons.push('style_match');
  if (!input.zoneIndoor && item.outdoorOk && item.climateTags.length > 0) reasons.push('climate_fit');
  if (item.durabilityScore >= 4) reasons.push('durable');
  if (item.maintenanceScore <= 2) reasons.push('low_maintenance');
  if (priceFit >= 0.8) reasons.push('tier_fit');
  if (isEssential) reasons.push('essential_for_zone');
  return reasons;
}

export function rankRecommendations(
  catalog: Item[],
  input: RecommendationInput,
): ScoredRecommendation[] {
  const medians = computeMedians(catalog);
  const essentials = ESSENTIAL_CATEGORIES_BY_ZONE[input.zoneType] ?? [];

  const candidates = catalog.filter((item) => {
    if (input.zoneIndoor && !item.indoorOk) return false;
    if (!input.zoneIndoor && !item.outdoorOk) return false;
    if (!item.zoneTags.includes(input.zoneType)) return false;
    const price = item.priceIdr[input.budgetTier];
    if (!Number.isFinite(price) || price <= 0) return false;
    return true;
  });

  const scored: ScoredRecommendation[] = candidates.map((item) => {
    const style = styleScore(item, input.styleTag);                  // 0–1
    const climate = climateScore(item, input.zoneIndoor);             // 0–1
    const durability = durabilityFactor(item);                        // 0–1
    const priceFit = priceFitScore(item, input.budgetTier, medians);  // 0–1
    const maintenance = maintenanceFactor(item);                      // 0–1
    const popularity = popularityFactor(item);                        // 0–1

    const score =
      style * 40 +
      ((climate + durability) / 2) * 20 +
      priceFit * 20 +
      popularity * 10 +
      maintenance * 10;

    const isEssential = essentials.includes(item.category);
    const priority: Priority = isEssential
      ? 'esensial'
      : score >= 70
        ? 'direkomendasikan'
        : 'opsional';

    return {
      item,
      score: Math.round(score * 10) / 10,
      priority,
      reasons: collectReasons(item, input, priceFit, isEssential),
    };
  });

  return scored.sort((a, b) => {
    if (a.priority !== b.priority) return priorityRank(a.priority) - priorityRank(b.priority);
    return b.score - a.score;
  });
}

function priorityRank(p: Priority): number {
  return p === 'esensial' ? 0 : p === 'direkomendasikan' ? 1 : 2;
}

export function topNPerCategory(
  scored: ScoredRecommendation[],
  n: number,
): ScoredRecommendation[] {
  const grouped = new Map<ItemCategory, ScoredRecommendation[]>();
  for (const rec of scored) {
    const bucket = grouped.get(rec.item.category) ?? [];
    if (bucket.length < n) bucket.push(rec);
    grouped.set(rec.item.category, bucket);
  }
  return [...grouped.values()].flat();
}

// Exported for tests.
export const __testing = {
  computeMedians,
  ESSENTIAL_CATEGORIES_BY_ZONE,
};
export type { CategoryTierMedian };
