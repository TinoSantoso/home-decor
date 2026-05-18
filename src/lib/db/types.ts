import type { Zone } from '../zones';
import type { BudgetTier } from '../cost-engine';

export interface ProjectRecord {
  id: string;
  name: string;
  templateId: string | null;
  budgetTier: BudgetTier;
  contingencyPct: number;
  taxEnabled: boolean;
  climateZone: string;
  zones: Zone[];
  createdAt: number;
  updatedAt: number;
}

export type NewProjectInput = Pick<
  ProjectRecord,
  'name' | 'templateId' | 'budgetTier' | 'contingencyPct' | 'taxEnabled' | 'climateZone'
>;
