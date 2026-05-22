import type { Zone } from '../zones';
import type { BudgetTier } from '../cost-engine';
import type { StyleTag } from '../catalog';

export interface PlacedItemRecord {
  id: string;
  itemId: string;
  zoneId: string;
  quantity: number;
  notes: string;
  /** World-space position [x, y, z] in meters set when placed via the 3D tour. */
  position3d?: [number, number, number];
}

export interface ProjectRecord {
  id: string;
  name: string;
  templateId: string | null;
  budgetTier: BudgetTier;
  contingencyPct: number;
  taxEnabled: boolean;
  climateZone: string;
  styleTag: StyleTag | null;
  /** Public R2 URL of a user-uploaded floor-plan reference image (sketch/photo). */
  floorPlanImageUrl?: string | null;
  /**
   * Nanoid(16) token for shareable read-only links.
   * Optional for backwards-compat with pre-slice-5 records.
   */
  shareToken?: string | null;
  /**
   * Unix ms timestamp when the share token expires. Null if no active share.
   * Optional for backwards-compat with pre-slice-5 records.
   */
  shareTokenExpiry?: number | null;
  zones: Zone[];
  placedItems: PlacedItemRecord[];
  createdAt: number;
  updatedAt: number;
}

export type NewProjectInput = Pick<
  ProjectRecord,
  'name' | 'templateId' | 'budgetTier' | 'contingencyPct' | 'taxEnabled' | 'climateZone'
>;
