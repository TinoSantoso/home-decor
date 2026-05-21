/**
 * Pure builder for PDF estimate documents.
 * No React, no @react-pdf/renderer, no i18n — caller supplies pre-translated labels.
 * Returns a serializable EstimateDocument that the PDF component consumes.
 */

import type { CostEstimate, BudgetTier } from './cost-engine';
import type { Zone } from './zones';
import { zoneAreaM2 } from './zones';

export interface EstimateDocument {
  meta: {
    projectName: string;
    generatedAt: number;
    localeTag: 'id-ID' | 'en-US';
  };
  assumptions: {
    tier: BudgetTier;
    contingencyPct: number;
    taxEnabled: boolean;
  };
  totals: {
    materials: number;
    labor: number;
    contingency: number;
    tax: number;
    grandTotal: number;
  };
  zones: Array<{
    name: string;
    typeLabel: string;
    areaM2: number;
    total: number;
  }>;
  categories: Array<{
    label: string;
    materials: number;
    labor: number;
    total: number;
  }>;
}

export interface BuildInput {
  estimate: CostEstimate;
  /** All zones from the store — used to look up name, type, and area by zoneId. */
  zones: Zone[];
  projectName: string;
  budgetTier: BudgetTier;
  contingencyPct: number;
  taxEnabled: boolean;
  localeTag: 'id-ID' | 'en-US';
  /** Pre-translated zone-type labels keyed by zoneId, e.g. { z1: 'Living Room' } */
  zoneTypeLabels: Record<string, string>;
  /** Pre-translated category labels keyed by CostCategory string, e.g. { furniture: 'Furniture' } */
  categoryLabels: Record<string, string>;
}

export function buildEstimateDocument(input: BuildInput): EstimateDocument {
  const {
    estimate,
    zones,
    projectName,
    budgetTier,
    contingencyPct,
    taxEnabled,
    localeTag,
    zoneTypeLabels,
    categoryLabels,
  } = input;

  // Build a lookup map for zones by id for O(1) access.
  const zoneById = new Map<string, Zone>();
  for (const zone of zones) {
    zoneById.set(zone.id, zone);
  }

  // Per-zone rows: preserve the order from estimate.perZone (cost-engine insertion order).
  const zoneRows = estimate.perZone
    .map((row) => {
      const zone = zoneById.get(row.zoneId);
      // If a zoneId in the estimate has no corresponding zone, skip it silently.
      if (!zone) return null;
      return {
        name: zone.name,
        typeLabel: zoneTypeLabels[row.zoneId] ?? zone.type,
        areaM2: zoneAreaM2(zone),
        total: row.total,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  // Per-category rows: preserve the cost-engine's enumeration order.
  const categoryRows = estimate.perCategory.map((row) => ({
    label: categoryLabels[row.category] ?? row.category,
    materials: row.materials,
    labor: row.labor,
    total: row.total,
  }));

  return {
    meta: {
      projectName,
      generatedAt: Date.now(),
      localeTag,
    },
    assumptions: {
      tier: budgetTier,
      contingencyPct,
      taxEnabled,
    },
    totals: {
      materials: estimate.materialsTotal,
      labor: estimate.laborTotal,
      contingency: estimate.contingency,
      tax: estimate.tax,
      grandTotal: estimate.grandTotal,
    },
    zones: zoneRows,
    categories: categoryRows,
  };
}
