import { describe, expect, it } from 'vitest';
import { calculateCost, type ProjectCostInput } from '../src/lib/cost-engine';

describe('cost engine', () => {
  it('sums items and applies labor + contingency on standar tier without tax', () => {
    const input: ProjectCostInput = {
      budgetTier: 'standar',
      contingencyPct: 0.1,
      taxEnabled: false,
      items: [
        {
          itemId: 'sofa-1',
          category: 'furniture',
          quantity: 1,
          unitPriceByTier: {
            hemat: 3_000_000,
            standar: 6_000_000,
            premium: 12_000_000,
            mewah: 25_000_000,
          },
          zoneId: 'living',
        },
        {
          itemId: 'pendant-1',
          category: 'lighting',
          quantity: 2,
          unitPriceByTier: {
            hemat: 250_000,
            standar: 500_000,
            premium: 1_000_000,
            mewah: 2_500_000,
          },
          zoneId: 'living',
        },
      ],
      surfaces: [
        {
          surfaceId: 'wall-living',
          category: 'paint',
          areaM2: 40,
          unitPricePerM2ByTier: {
            hemat: 35_000,
            standar: 70_000,
            premium: 140_000,
            mewah: 250_000,
          },
          zoneId: 'living',
        },
      ],
      laborRates: {},
    };

    const result = calculateCost(input);

    // furniture: 6_000_000 (no labor)
    // lighting: 1_000_000 (40% labor = 400_000)
    // paint: 40 * 70_000 = 2_800_000 (30% labor = 840_000)
    expect(result.materialsTotal).toBe(9_800_000);
    expect(result.laborTotal).toBe(1_240_000);
    expect(result.contingency).toBeCloseTo(1_104_000);
    expect(result.tax).toBe(0);
    expect(result.grandTotal).toBeCloseTo(12_144_000);
    expect(result.perCategory).toHaveLength(3);
    expect(result.perZone).toHaveLength(1);
  });

  it('applies 11% PPN when taxEnabled', () => {
    const result = calculateCost({
      budgetTier: 'hemat',
      contingencyPct: 0,
      taxEnabled: true,
      items: [
        {
          itemId: 'x',
          category: 'furniture',
          quantity: 1,
          unitPriceByTier: { hemat: 1_000_000, standar: 0, premium: 0, mewah: 0 },
          zoneId: 'z',
        },
      ],
      surfaces: [],
      laborRates: {},
    });

    expect(result.materialsTotal).toBe(1_000_000);
    expect(result.tax).toBeCloseTo(110_000);
    expect(result.grandTotal).toBeCloseTo(1_110_000);
  });
});
