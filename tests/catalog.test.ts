import { describe, expect, it } from 'vitest';
import { filterItems, isInTier, pickItemName, type Item } from '../src/lib/catalog';

const SOFA: Item = {
  id: 'sofa-1',
  name: { id: 'Sofa Modular', en: 'Modular Sofa' },
  category: 'furniture',
  subcategory: 'sofa',
  styleTags: ['japandi', 'minimalis_skandinavia'],
  zoneTags: ['living_room'],
  indoorOk: true,
  outdoorOk: false,
  climateTags: [],
  dimensions: { widthCm: 240, depthCm: 95, heightCm: 78 },
  durabilityScore: 4,
  maintenanceScore: 2,
  priceIdr: { hemat: 3_500_000, standar: 7_500_000, premium: 15_000_000, mewah: 28_000_000 },
  thumbnailHint: 'oklch(88% 0.03 70)',
  alternatives: [],
};

const PALM: Item = {
  id: 'palm-1',
  name: { id: 'Palem Kuning', en: 'Areca Palm' },
  category: 'plant',
  subcategory: 'outdoor_plant',
  styleTags: ['tropical_modern'],
  zoneTags: ['garden', 'terrace'],
  indoorOk: false,
  outdoorOk: true,
  climateTags: ['tropical', 'humid'],
  dimensions: { widthCm: 150, depthCm: 150, heightCm: 250 },
  durabilityScore: 4,
  maintenanceScore: 2,
  priceIdr: { hemat: 200_000, standar: 500_000, premium: 1_100_000, mewah: 2_200_000 },
  thumbnailHint: 'oklch(60% 0.14 140)',
  alternatives: [],
};

const ITEMS = [SOFA, PALM];

describe('catalog filterItems', () => {
  it('returns everything when filter is empty', () => {
    expect(filterItems(ITEMS, {})).toHaveLength(2);
  });

  it('filters by category', () => {
    expect(filterItems(ITEMS, { category: 'plant' })).toEqual([PALM]);
  });

  it('filters by style tag', () => {
    expect(filterItems(ITEMS, { styleTag: 'japandi' })).toEqual([SOFA]);
    expect(filterItems(ITEMS, { styleTag: 'tropical_modern' })).toEqual([PALM]);
  });

  it('filters by zone type', () => {
    expect(filterItems(ITEMS, { zoneType: 'living_room' })).toEqual([SOFA]);
    expect(filterItems(ITEMS, { zoneType: 'garden' })).toEqual([PALM]);
  });

  it('filters by indoor / outdoor', () => {
    expect(filterItems(ITEMS, { indoor: true })).toEqual([SOFA]);
    expect(filterItems(ITEMS, { outdoor: true })).toEqual([PALM]);
  });

  it('filters by search text (case-insensitive) over id + en + subcategory', () => {
    expect(filterItems(ITEMS, { searchText: 'PALEM' })).toEqual([PALM]);
    expect(filterItems(ITEMS, { searchText: 'sofa' })).toEqual([SOFA]);
    expect(filterItems(ITEMS, { searchText: 'plant' })).toEqual([PALM]);
  });

  it('combines filters with AND semantics', () => {
    expect(
      filterItems(ITEMS, { category: 'plant', styleTag: 'tropical_modern' }),
    ).toEqual([PALM]);
    expect(
      filterItems(ITEMS, { category: 'plant', styleTag: 'japandi' }),
    ).toEqual([]);
  });
});

describe('catalog isInTier', () => {
  it('returns true for tiers with positive prices', () => {
    expect(isInTier(SOFA, 'hemat')).toBe(true);
    expect(isInTier(SOFA, 'mewah')).toBe(true);
  });
});

describe('catalog pickItemName', () => {
  it('picks Bahasa Indonesia when locale starts with id', () => {
    expect(pickItemName(SOFA, 'id')).toBe('Sofa Modular');
    expect(pickItemName(SOFA, 'id-ID')).toBe('Sofa Modular');
  });

  it('picks English otherwise', () => {
    expect(pickItemName(SOFA, 'en')).toBe('Modular Sofa');
    expect(pickItemName(SOFA, 'en-US')).toBe('Modular Sofa');
  });
});
