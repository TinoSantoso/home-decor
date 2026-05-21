import { describe, expect, it } from 'vitest';
import { buildEstimateDocument, type BuildInput } from '../src/lib/pdf-estimate';
import { metersToPx } from '../src/lib/zones';
import type { CostEstimate } from '../src/lib/cost-engine';

function makeEstimate(overrides: Partial<CostEstimate> = {}): CostEstimate {
  return {
    materialsTotal: 10_000_000,
    laborTotal: 2_000_000,
    contingency: 1_200_000,
    tax: 1_452_000,
    grandTotal: 14_652_000,
    perCategory: [
      { category: 'furniture', materials: 6_000_000, labor: 0, total: 6_000_000 },
      { category: 'lighting', materials: 4_000_000, labor: 2_000_000, total: 6_000_000 },
    ],
    perZone: [
      { zoneId: 'z1', materials: 7_000_000, labor: 1_400_000, total: 8_400_000 },
      { zoneId: 'z2', materials: 3_000_000, labor: 600_000, total: 3_600_000 },
    ],
    ...overrides,
  };
}

function makeZone(id: string, name: string) {
  return {
    id,
    type: 'living_room' as const,
    name,
    x: 0,
    y: 0,
    width: metersToPx(4),
    height: metersToPx(5),
  };
}

function makeInput(overrides: Partial<BuildInput> = {}): BuildInput {
  return {
    estimate: makeEstimate(),
    zones: [makeZone('z1', 'Ruang Tamu'), makeZone('z2', 'Kamar Tidur')],
    projectName: 'Rumah Idaman',
    budgetTier: 'standar',
    contingencyPct: 0.1,
    taxEnabled: true,
    localeTag: 'id-ID',
    zoneTypeLabels: { z1: 'Ruang Tamu', z2: 'Kamar Tidur' },
    categoryLabels: { furniture: 'Furnitur', lighting: 'Pencahayaan' },
    ...overrides,
  };
}

describe('buildEstimateDocument', () => {
  it('returns all five top-level sections', () => {
    const doc = buildEstimateDocument(makeInput());

    expect(doc).toHaveProperty('meta');
    expect(doc).toHaveProperty('assumptions');
    expect(doc).toHaveProperty('totals');
    expect(doc).toHaveProperty('zones');
    expect(doc).toHaveProperty('categories');
  });

  it('populates meta with projectName, generatedAt timestamp, and localeTag', () => {
    const before = Date.now();
    const doc = buildEstimateDocument(makeInput({ localeTag: 'en-US' }));
    const after = Date.now();

    expect(doc.meta.projectName).toBe('Rumah Idaman');
    expect(doc.meta.localeTag).toBe('en-US');
    expect(doc.meta.generatedAt).toBeGreaterThanOrEqual(before);
    expect(doc.meta.generatedAt).toBeLessThanOrEqual(after);
  });

  it('locale-tag flows through unchanged to meta.localeTag', () => {
    const doc1 = buildEstimateDocument(makeInput({ localeTag: 'id-ID' }));
    const doc2 = buildEstimateDocument(makeInput({ localeTag: 'en-US' }));

    expect(doc1.meta.localeTag).toBe('id-ID');
    expect(doc2.meta.localeTag).toBe('en-US');
  });

  it('populates assumptions from input', () => {
    const doc = buildEstimateDocument(makeInput({
      budgetTier: 'premium',
      contingencyPct: 0.15,
      taxEnabled: false,
    }));

    expect(doc.assumptions.tier).toBe('premium');
    expect(doc.assumptions.contingencyPct).toBe(0.15);
    expect(doc.assumptions.taxEnabled).toBe(false);
  });

  it('maps totals directly from the cost estimate', () => {
    const estimate = makeEstimate();
    const doc = buildEstimateDocument(makeInput({ estimate }));

    expect(doc.totals.materials).toBe(estimate.materialsTotal);
    expect(doc.totals.labor).toBe(estimate.laborTotal);
    expect(doc.totals.contingency).toBe(estimate.contingency);
    expect(doc.totals.tax).toBe(estimate.tax);
    expect(doc.totals.grandTotal).toBe(estimate.grandTotal);
  });

  it('tax-disabled estimate sets totals.tax === 0', () => {
    const estimate = makeEstimate({ tax: 0 });
    const doc = buildEstimateDocument(makeInput({ estimate, taxEnabled: false }));

    expect(doc.totals.tax).toBe(0);
  });

  it('produces empty zones array when estimate.perZone is empty', () => {
    const estimate = makeEstimate({ perZone: [] });
    const doc = buildEstimateDocument(makeInput({ estimate, zones: [] }));

    expect(doc.zones).toEqual([]);
  });

  it('produces empty categories array when estimate.perCategory is empty', () => {
    const estimate = makeEstimate({ perCategory: [] });
    const doc = buildEstimateDocument(makeInput({ estimate }));

    expect(doc.categories).toEqual([]);
  });

  it('per-zone rows maintain the same order as estimate.perZone (input order)', () => {
    const input = makeInput();
    const doc = buildEstimateDocument(input);

    const docZoneIds = doc.zones.map((z) => z.name);
    // zones correspond to zoneIds z1, z2 from estimate.perZone in that order
    expect(docZoneIds[0]).toBe('Ruang Tamu');
    expect(docZoneIds[1]).toBe('Kamar Tidur');
  });

  it('per-category rows preserve cost-engine category enumeration order', () => {
    const input = makeInput();
    const doc = buildEstimateDocument(input);

    expect(doc.categories[0]?.label).toBe('Furnitur');
    expect(doc.categories[1]?.label).toBe('Pencahayaan');
  });

  it('pre-translated labels flow through without modification', () => {
    const input = makeInput({
      zoneTypeLabels: { z1: 'Living Room', z2: 'Bedroom' },
      categoryLabels: { furniture: 'Furniture', lighting: 'Lighting' },
    });
    const doc = buildEstimateDocument(input);

    expect(doc.zones[0]?.typeLabel).toBe('Living Room');
    expect(doc.categories[0]?.label).toBe('Furniture');
    expect(doc.categories[1]?.label).toBe('Lighting');
  });

  it('includes zone area in m² computed from zone dimensions', () => {
    const doc = buildEstimateDocument(makeInput());

    // zone width = metersToPx(4), height = metersToPx(5) → area = 4 * 5 = 20
    expect(doc.zones[0]?.areaM2).toBeCloseTo(20, 4);
  });
});
