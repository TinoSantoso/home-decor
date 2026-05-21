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
      climateZone: 'tropical_indonesia',
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
      climateZone: 'tropical_indonesia',
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
      climateZone: 'tropical_indonesia',
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
      climateZone: 'tropical_indonesia',
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
      climateZone: 'tropical_indonesia',
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
      climateZone: 'tropical_indonesia',
    });
    for (const rec of out) {
      expect(rec.reasons).toContain('tier_fit');
    }
  });

  // ── Climate-aware ranking (Phase 3 slice 2) ────────────────────────────────

  it('outdoor item with matching climate tags outranks identical outdoor item with no tags', () => {
    const baseOutdoor = {
      outdoorOk: true,
      indoorOk: false,
      zoneTags: ['terrace' as const],
      durabilityScore: 3,
      maintenanceScore: 3,
    };
    const withTags = makeItem({ id: 'tagged', climateTags: ['tropical', 'humid'], ...baseOutdoor });
    const noTags = makeItem({ id: 'untagged', climateTags: [], ...baseOutdoor });
    const out = rankRecommendations([withTags, noTags], {
      zoneType: 'terrace',
      zoneIndoor: false,
      budgetTier: 'standar',
      styleTag: null,
      climateZone: 'tropical_indonesia',
    });
    const taggedScore = out.find((r) => r.item.id === 'tagged')!.score;
    const untaggedScore = out.find((r) => r.item.id === 'untagged')!.score;
    expect(taggedScore).toBeGreaterThan(untaggedScore);
  });

  it('outdoor item with more matching tags scores above item with fewer matches', () => {
    const baseOutdoor = {
      outdoorOk: true,
      indoorOk: false,
      zoneTags: ['terrace' as const],
      durabilityScore: 3,
      maintenanceScore: 3,
    };
    // Both items have tags that overlap tropical_indonesia's expected set;
    // the one with more overlap should rank higher.
    const goodMatch = makeItem({
      id: 'good',
      climateTags: ['tropical', 'humid'],
      ...baseOutdoor,
    });
    const poorMatch = makeItem({
      id: 'poor',
      climateTags: ['uv_resistant'],
      ...baseOutdoor,
    });
    const out = rankRecommendations([goodMatch, poorMatch], {
      zoneType: 'terrace',
      zoneIndoor: false,
      budgetTier: 'standar',
      styleTag: null,
      climateZone: 'tropical_indonesia',
    });
    const goodScore = out.find((r) => r.item.id === 'good')!.score;
    const poorScore = out.find((r) => r.item.id === 'poor')!.score;
    expect(goodScore).toBeGreaterThan(poorScore);
  });

  it('outdoor item with non-matching tags scores at or below item with empty tags', () => {
    const baseOutdoor = {
      outdoorOk: true,
      indoorOk: false,
      zoneTags: ['terrace' as const],
      durabilityScore: 3,
      maintenanceScore: 3,
    };
    // tropical_indonesia expects every valid ClimateTag, so we need to cast
    // a synthetic non-matching tag to exercise the zero-overlap branch.
    const arcticTag = 'arctic' as unknown as Item['climateTags'][number];
    const mismatched = makeItem({
      id: 'mismatched',
      climateTags: [arcticTag],
      ...baseOutdoor,
    });
    const empty = makeItem({
      id: 'empty',
      climateTags: [],
      ...baseOutdoor,
    });
    const out = rankRecommendations([mismatched, empty], {
      zoneType: 'terrace',
      zoneIndoor: false,
      budgetTier: 'standar',
      styleTag: null,
      climateZone: 'tropical_indonesia',
    });
    const mismatchedScore = out.find((r) => r.item.id === 'mismatched')!.score;
    const emptyScore = out.find((r) => r.item.id === 'empty')!.score;
    // Zero-overlap and empty-tags both fall to 0.5 in the climate formula,
    // so the mismatched item must not outrank the empty item on climate alone.
    expect(mismatchedScore).toBeLessThanOrEqual(emptyScore);
  });

  it('climate_fit reason fires for outdoor items with tags overlapping the expected set', () => {
    const item = makeItem({
      id: 'out',
      outdoorOk: true,
      indoorOk: false,
      climateTags: ['tropical', 'humid'],
      zoneTags: ['terrace'],
    });
    const out = rankRecommendations([item], {
      zoneType: 'terrace',
      zoneIndoor: false,
      budgetTier: 'standar',
      styleTag: null,
      climateZone: 'tropical_indonesia',
    });
    expect(out[0]?.reasons).toContain('climate_fit');
  });

  it('climate_fit reason does NOT fire for outdoor item with empty climateTags', () => {
    const item = makeItem({
      id: 'out',
      outdoorOk: true,
      indoorOk: false,
      climateTags: [],
      zoneTags: ['terrace'],
    });
    const out = rankRecommendations([item], {
      zoneType: 'terrace',
      zoneIndoor: false,
      budgetTier: 'standar',
      styleTag: null,
      climateZone: 'tropical_indonesia',
    });
    expect(out[0]?.reasons).not.toContain('climate_fit');
  });

  it('indoor anti_mold-tagged item outranks identical indoor item without the tag', () => {
    const baseIndoor = {
      outdoorOk: false,
      indoorOk: true,
      zoneTags: ['living_room' as const],
      durabilityScore: 3,
      maintenanceScore: 3,
    };
    const withMold = makeItem({ id: 'mold', climateTags: ['anti_mold'], ...baseIndoor });
    const noMold = makeItem({ id: 'nomold', climateTags: [], ...baseIndoor });
    const out = rankRecommendations([withMold, noMold], {
      zoneType: 'living_room',
      zoneIndoor: true,
      budgetTier: 'standar',
      styleTag: null,
      climateZone: 'tropical_indonesia',
    });
    const moldScore = out.find((r) => r.item.id === 'mold')!.score;
    const noMoldScore = out.find((r) => r.item.id === 'nomold')!.score;
    expect(moldScore).toBeGreaterThan(noMoldScore);
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
