import type { Zone } from '../zones';
import type { BudgetTier } from '../cost-engine';

export interface PlacedItemRecord {
  id: string;
  itemId: string;
  zoneId: string;
  quantity: number;
  notes: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  templateId: string | null;
  budgetTier: BudgetTier;
  contingencyPct: number;
  taxEnabled: boolean;
  climateZone: string;
  zones: Zone[];
  placedItems: PlacedItemRecord[];
  createdAt: number;
  updatedAt: number;
}

export type NewProjectInput = Pick<
  ProjectRecord,
  'name' | 'templateId' | 'budgetTier' | 'contingencyPct' | 'taxEnabled' | 'climateZone'
>;
