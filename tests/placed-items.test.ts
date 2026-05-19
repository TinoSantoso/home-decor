import { describe, expect, it } from 'vitest';
import type { Item } from '../src/lib/catalog';
import { toPlacedItemInputs } from '../src/lib/placed-items';
import type { PlacedItemRecord } from '../src/lib/db/types';

const SOFA: Item = {
  id: 'sofa-1',
  name: { id: 'Sofa', en: 'Sofa' },
  category: 'furniture',
  subcategory: 'sofa',
  styleTags: ['japandi'],
  zoneTags: ['living_room'],
  indoorOk: true,
  outdoorOk: false,
  climateTags: [],
  dimensions: { widthCm: 240, depthCm: 95, heightCm: 78 },
  durabilityScore: 4,
  maintenanceScore: 2,
  priceIdr: { hemat: 3_000_000, standar: 6_000_000, premium: 12_000_000, mewah: 24_000_000 },
  thumbnailHint: 'oklch(80% 0 0)',
  alternatives: [],
};

const LAMP: Item = {
  ...SOFA,
  id: 'lamp-1',
  name: { id: 'Lampu', en: 'Lamp' },
  category: 'lighting',
  subcategory: 'pendant',
  priceIdr: { hemat: 400_000, standar: 900_000, premium: 2_000_000, mewah: 4_000_000 },
};

describe('toPlacedItemInputs', () => {
  it('maps records to cost-engine inputs using catalog prices', () => {
    const records: PlacedItemRecord[] = [
      { id: 'p1', itemId: 'sofa-1', zoneId: 'z1', quantity: 1, notes: '' },
      { id: 'p2', itemId: 'lamp-1', zoneId: 'z1', quantity: 2, notes: '' },
    ];
    const out = toPlacedItemInputs(records, [SOFA, LAMP]);
    expect(out).toEqual([
      {
        itemId: 'sofa-1',
        category: 'furniture',
        quantity: 1,
        unitPriceByTier: SOFA.priceIdr,
        zoneId: 'z1',
      },
      {
        itemId: 'lamp-1',
        category: 'lighting',
        quantity: 2,
        unitPriceByTier: LAMP.priceIdr,
        zoneId: 'z1',
      },
    ]);
  });

  it('drops records that reference catalog entries that no longer exist', () => {
    const records: PlacedItemRecord[] = [
      { id: 'p1', itemId: 'sofa-1', zoneId: 'z1', quantity: 1, notes: '' },
      { id: 'p2', itemId: 'gone', zoneId: 'z1', quantity: 1, notes: '' },
    ];
    const out = toPlacedItemInputs(records, [SOFA]);
    expect(out).toHaveLength(1);
    expect(out[0]?.itemId).toBe('sofa-1');
  });

  it('returns empty when no records', () => {
    expect(toPlacedItemInputs([], [SOFA])).toEqual([]);
  });
});
