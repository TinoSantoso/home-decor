/**
 * Cost engine — plan §7.
 * Pure, isomorphic functions. No I/O. All amounts in IDR.
 */

export type BudgetTier = 'hemat' | 'standar' | 'premium' | 'mewah';

export type CostCategory =
  | 'furniture'
  | 'lighting'
  | 'paint'
  | 'flooring'
  | 'plant'
  | 'accessory'
  | 'fixture'
  | 'landscaping'
  | 'electrical'
  | 'masonry';

export interface PlacedItemInput {
  itemId: string;
  category: CostCategory;
  quantity: number;
  unitPriceByTier: Record<BudgetTier, number>;
  zoneId: string;
}

export interface SurfaceInput {
  surfaceId: string;
  category: Extract<CostCategory, 'paint' | 'flooring' | 'masonry'>;
  areaM2: number;
  unitPricePerM2ByTier: Record<BudgetTier, number>;
  zoneId: string;
}

export interface ProjectCostInput {
  budgetTier: BudgetTier;
  contingencyPct: number;
  taxEnabled: boolean;
  items: PlacedItemInput[];
  surfaces: SurfaceInput[];
  laborRates: Partial<Record<CostCategory, number>>;
}

export interface CategoryRollup {
  category: CostCategory;
  materials: number;
  labor: number;
  total: number;
}

export interface ZoneRollup {
  zoneId: string;
  materials: number;
  labor: number;
  total: number;
}

export interface CostEstimate {
  materialsTotal: number;
  laborTotal: number;
  contingency: number;
  tax: number;
  grandTotal: number;
  perCategory: CategoryRollup[];
  perZone: ZoneRollup[];
}

const TAX_RATE_PPN = 0.11;

const DEFAULT_LABOR_RATES: Record<CostCategory, number> = {
  furniture: 0.0,
  lighting: 0.4,
  paint: 0.3,
  flooring: 0.25,
  plant: 0.15,
  accessory: 0.0,
  fixture: 0.35,
  landscaping: 0.3,
  electrical: 0.4,
  masonry: 0.35,
};

export function calculateCost(input: ProjectCostInput): CostEstimate {
  const laborRates = { ...DEFAULT_LABOR_RATES, ...input.laborRates };

  const lines: Array<{
    category: CostCategory;
    zoneId: string;
    subtotal: number;
  }> = [];

  for (const item of input.items) {
    const unitPrice = item.unitPriceByTier[input.budgetTier];
    lines.push({
      category: item.category,
      zoneId: item.zoneId,
      subtotal: unitPrice * item.quantity,
    });
  }

  for (const surface of input.surfaces) {
    const unitPrice = surface.unitPricePerM2ByTier[input.budgetTier];
    lines.push({
      category: surface.category,
      zoneId: surface.zoneId,
      subtotal: unitPrice * surface.areaM2,
    });
  }

  const byCategory = new Map<CostCategory, number>();
  const byZone = new Map<string, { materials: number; labor: number }>();

  for (const line of lines) {
    byCategory.set(
      line.category,
      (byCategory.get(line.category) ?? 0) + line.subtotal,
    );
    const laborPct = laborRates[line.category] ?? 0;
    const zone = byZone.get(line.zoneId) ?? { materials: 0, labor: 0 };
    zone.materials += line.subtotal;
    zone.labor += line.subtotal * laborPct;
    byZone.set(line.zoneId, zone);
  }

  const perCategory: CategoryRollup[] = [...byCategory.entries()].map(
    ([category, materials]) => {
      const labor = materials * (laborRates[category] ?? 0);
      return { category, materials, labor, total: materials + labor };
    },
  );

  const perZone: ZoneRollup[] = [...byZone.entries()].map(
    ([zoneId, { materials, labor }]) => ({
      zoneId,
      materials,
      labor,
      total: materials + labor,
    }),
  );

  const materialsTotal = perCategory.reduce((s, c) => s + c.materials, 0);
  const laborTotal = perCategory.reduce((s, c) => s + c.labor, 0);
  const contingency = (materialsTotal + laborTotal) * input.contingencyPct;
  const subtotal = materialsTotal + laborTotal + contingency;
  const tax = input.taxEnabled ? subtotal * TAX_RATE_PPN : 0;
  const grandTotal = subtotal + tax;

  return {
    materialsTotal,
    laborTotal,
    contingency,
    tax,
    grandTotal,
    perCategory,
    perZone,
  };
}
