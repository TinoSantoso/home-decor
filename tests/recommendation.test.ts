import { describe, expect, it } from 'vitest';
import type { Item } from '../src/lib/catalog';
import {
  rankRecommendations,
  topNPerCategory,
  __testing,
} from '../src/lib/recommendation';

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: 'x',
    name: { id: 'x', en: 'x' },
    category: 'furniture',
    subcategory: 'sofa',
    styleTags: [],
    zoneTags: ['living_room'],
    indoorOk: true,
    outdoorOk: false,
    climateTags: [],
    dimensions: { widthCm: 100, depthCm: 100, heightCm: 100 },
    durabilityScore: 3,
    maintenanceScore: 3,
    priceIdr: { hemat: 1_000_000, standar: 2_000_000, premium: 4_000_000, mewah: 8_000_000 },
    thumbnailHint: 'oklch(80% 0 0)',
    alternatives: [],
    ...overrides,
  };
}

describe('rankRecommendations', () => {
  it('filters out items missing the zone tag', () => {
    const items = [
      makeItem({ id: 'a', zoneTags: ['bedroom'] }),
      makeItem({ id: 'b', zoneTags: ['living_room'] }),
    ];
    const out = rankRecommendations(items, {
      zoneType: 'living_room',
      zoneIndoor: true,
      budgetTier: 'standar',
      styleTag: null,
    });
    expect(out.map((r) => r.item.id)).toEqual(['b']);
  });

  it('filters indoor items out of outdoor zones', () => {
    const items = [
      makeItem({ id: 'indoor', indoorOk: true, outdoorOk: false, zoneTags: ['garden'] }),
      makeItem({
        id: 'outdoor',
        category: 'plant',
        indoorOk: false,
        outdoorOk: true,
        climateTags: ['tropical'],
        zoneTags: ['garden'],
      }),
    ];
    const out = rankRecommendations(items, {
      zoneType: 'garden',
      zoneIndoor: false,
      budgetTier: 'standar',
      styleTag: null,
    });
    expect(out.map((r) => r.item.id)).toEqual(['outdoor']);
  });

  it('assigns esensial priority when item.category is in the zone essentials', () => {
    const sofa = makeItem({ id: 'sofa', category: 'furniture', zoneTags: ['living_room'] });
    const rug = makeItem({ id: 'rug', category: 'accessory', zoneTags: ['living_room'] });
    const out = rankRecommendations([sofa, rug], {
      zoneType: 'living_room',
      zoneIndoor: true,
      budgetTier: 'standar',
      styleTag: null,
    });
    expect(out.find((r) => r.item.id === 'sofa')?.priority).toBe('esensial');
    expect(out.find((r) => r.item.id === 'rug')?.priority).not.toBe('esensial');
  });

  it('ranks style-matching items higher than non-matching ones', () => {
    const matching = makeItem({
      id: 'match',
      styleTags: ['japandi'],
      durabilityScore: 3,
    });
    const offStyle = makeItem({
      id: 'off',
      styleTags: ['industrial'],
      durabilityScore: 3,
    });
    const out = rankRecommendations([matching, offStyle], {
      zoneType: 'living_room',
      zoneIndoor: true,
      budgetTier: 'standar',
      styleTag: 'japandi',
    });
    const matchScore = out.find((r) => r.item.id === 'match')!.score;
    const offScore = out.find((r) => r.item.id === 'off')!.score;
    expect(matchScore).toBeGreaterThan(offScore);
  });

  it('sorts essentials before non-essentials regardless of raw score', () => {
    const lowScoreEssential = makeItem({
      id: 'ess',
      category: 'furniture',
      durabilityScore: 1,
      maintenanceScore: 5,
      styleTags: [],
    });
    const highScoreOptional = makeItem({
      id: 'opt',
      category: 'accessory',
      durabilityScore: 5,
      maintenanceScore: 1,
      styleTags: ['japandi'],
      popularityScore: 90,
    });
    const out = rankRecommendations([highScoreOptional, lowScoreEssential], {
      zoneType: 'living_room',
      zoneIndoor: true,
      budgetTier: 'standar',
      styleTag: 'japandi',
    });
    expect(out[0]?.item.id).toBe('ess');
  });

  it('flags `tier_fit` reason when price is near category-tier median', () => {
    const items = [
      makeItem({ id: 'a', priceIdr: { hemat: 1_000_000, standar: 2_000_000, premium: 4_000_000, mewah: 8_000_000 } }),
      makeItem({ id: 'b', priceIdr: { hemat: 1_100_000, standar: 2_100_000, premium: 4_200_000, mewah: 8_200_000 } }),
      makeItem({ id: 'c', priceIdr: { hemat: 900_000, standar: 1_900_000, premium: 3_800_000, mewah: 7_800_000 } }),
    ];
    const out = rankRecommendations(items, {
      zoneType: 'living_room',
      zoneIndoor: true,
      budgetTier: 'standar',
      styleTag: null,
    });
    for (const rec of out) {
      expect(rec.reasons).toContain('tier_fit');
    }
  });
});

describe('topNPerCategory', () => {
  it('limits results to n items per category', () => {
    const ranked = [
      { item: makeItem({ id: 'f1', category: 'furniture' }), score: 90, priority: 'esensial' as const, reasons: [] },
      { item: makeItem({ id: 'f2', category: 'furniture' }), score: 80, priority: 'esensial' as const, reasons: [] },
      { item: makeItem({ id: 'f3', category: 'furniture' }), score: 70, priority: 'direkomendasikan' as const, reasons: [] },
      { item: makeItem({ id: 'l1', category: 'lighting' }), score: 65, priority: 'esensial' as const, reasons: [] },
      { item: makeItem({ id: 'l2', category: 'lighting' }), score: 60, priority: 'direkomendasikan' as const, reasons: [] },
    ];
    const out = topNPerCategory(ranked, 2);
    expect(out.map((r) => r.item.id)).toEqual(['f1', 'f2', 'l1', 'l2']);
  });
});

describe('zone essential categories', () => {
  it('treats lighting + furniture as essential for living rooms', () => {
    expect(__testing.ESSENTIAL_CATEGORIES_BY_ZONE.living_room).toEqual(
      expect.arrayContaining(['furniture', 'lighting']),
    );
  });

  it('treats plants as essential for gardens', () => {
    expect(__testing.ESSENTIAL_CATEGORIES_BY_ZONE.garden).toContain('plant');
  });
});
