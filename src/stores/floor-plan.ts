import { create } from 'zustand';
import { nanoid } from 'nanoid';
import {
  type Zone,
  type ZoneType,
  metersToPx,
} from '../lib/zones';
import type { BudgetTier } from '../lib/cost-engine';
import type { StyleTag } from '../lib/catalog';
import type { PlacedItemRecord, ProjectRecord } from '../lib/db/types';

interface FloorPlanState {
  /** The id of the currently-open project, or null when no project is loaded. */
  projectId: string | null;
  projectName: string;
  templateId: string | null;
  budgetTier: BudgetTier;
  contingencyPct: number;
  taxEnabled: boolean;
  climateZone: string;
  styleTag: StyleTag | null;
  zones: Zone[];
  selectedZoneId: string | null;
  placedItems: PlacedItemRecord[];
  /** Whether drag/resize snaps to the 0.25 m grid. */
  snapEnabled: boolean;
  /** Camera mode for the 3D tour: orbital overview or first-person walk. */
  tourMode: 'orbit' | 'walk';
  /** Whether placement mode is active in the 3D tour — next zone click places the selected item. */
  placementMode: boolean;
  /** The catalog item id staged for placement when placementMode is true. */
  pendingPlacementItemId: string | null;

  loadProject: (record: ProjectRecord) => void;
  addZone: (type: ZoneType, name: string) => string;
  updateZone: (id: string, patch: Partial<Omit<Zone, 'id'>>) => void;
  deleteZone: (id: string) => void;
  selectZone: (id: string | null) => void;
  setProjectName: (name: string) => void;
  setBudgetTier: (tier: BudgetTier) => void;
  setContingencyPct: (pct: number) => void;
  setTaxEnabled: (enabled: boolean) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setStyleTag: (tag: StyleTag | null) => void;
  addPlacedItem: (zoneId: string, itemId: string, quantity?: number) => string;
  updatePlacedItem: (id: string, patch: Partial<Omit<PlacedItemRecord, 'id'>>) => void;
  removePlacedItem: (id: string) => void;
  /**
   * Clone the given zone with the same dimensions, offset by 0.5 m, and
   * select the new zone. Returns the new zone id, or null if the source
   * zone does not exist. Locale controls the suffix ("(salinan)" vs "(copy)").
   */
  duplicateZone: (id: string, locale?: 'id' | 'en') => string | null;
  setTourMode: (mode: 'orbit' | 'walk') => void;
  setPlacementMode: (active: boolean) => void;
  setPendingPlacementItemId: (itemId: string | null) => void;
  /**
   * Place a catalog item at a 3D position inside a zone. Appends a new
   * PlacedItemRecord with position3d set. Returns the new record id.
   */
  placeItemAt: (zoneId: string, itemId: string, pos: [number, number, number]) => string;
  reset: () => void;
  toProjectRecord: () => ProjectRecord | null;
}

const DEFAULT_ZONE_SIZE = metersToPx(4);

const INITIAL: Pick<
  FloorPlanState,
  | 'projectId'
  | 'projectName'
  | 'templateId'
  | 'budgetTier'
  | 'contingencyPct'
  | 'taxEnabled'
  | 'climateZone'
  | 'styleTag'
  | 'zones'
  | 'selectedZoneId'
  | 'placedItems'
  | 'snapEnabled'
  | 'tourMode'
  | 'placementMode'
  | 'pendingPlacementItemId'
> = {
  projectId: null,
  projectName: '',
  templateId: null,
  budgetTier: 'standar',
  contingencyPct: 0.1,
  taxEnabled: false,
  climateZone: 'tropical_indonesia',
  styleTag: null,
  zones: [],
  selectedZoneId: null,
  placedItems: [],
  snapEnabled: true,
  tourMode: 'orbit',
  placementMode: false,
  pendingPlacementItemId: null,
};

export const useFloorPlan = create<FloorPlanState>((set, get) => ({
  ...INITIAL,

  loadProject: (record) =>
    set({
      projectId: record.id,
      projectName: record.name,
      templateId: record.templateId,
      budgetTier: record.budgetTier,
      contingencyPct: record.contingencyPct,
      taxEnabled: record.taxEnabled,
      climateZone: record.climateZone,
      styleTag: record.styleTag ?? null,
      zones: record.zones,
      placedItems: record.placedItems ?? [],
      selectedZoneId: null,
    }),

  addZone: (type, name) => {
    const id = nanoid(8);
    const zone: Zone = {
      id,
      type,
      name,
      x: 40 + Math.random() * 100,
      y: 40 + Math.random() * 100,
      width: DEFAULT_ZONE_SIZE,
      height: DEFAULT_ZONE_SIZE,
    };
    set((s) => ({ zones: [...s.zones, zone], selectedZoneId: id }));
    return id;
  },

  updateZone: (id, patch) =>
    set((s) => ({
      zones: s.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)),
    })),

  deleteZone: (id) =>
    set((s) => ({
      zones: s.zones.filter((z) => z.id !== id),
      // Remove orphaned placed items when their zone is deleted.
      placedItems: s.placedItems.filter((p) => p.zoneId !== id),
      selectedZoneId: s.selectedZoneId === id ? null : s.selectedZoneId,
    })),

  selectZone: (id) => set({ selectedZoneId: id }),

  setProjectName: (name) => set({ projectName: name }),

  setBudgetTier: (budgetTier) => set({ budgetTier }),

  setContingencyPct: (contingencyPct) =>
    set({ contingencyPct: Math.min(0.15, Math.max(0.05, contingencyPct)) }),

  setTaxEnabled: (taxEnabled) => set({ taxEnabled }),

  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),

  setStyleTag: (styleTag) => set({ styleTag }),

  addPlacedItem: (zoneId, itemId, quantity = 1) => {
    const id = nanoid(10);
    const record: PlacedItemRecord = { id, zoneId, itemId, quantity, notes: '' };
    set((s) => ({ placedItems: [...s.placedItems, record] }));
    return id;
  },

  updatePlacedItem: (id, patch) =>
    set((s) => ({
      placedItems: s.placedItems.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),

  removePlacedItem: (id) =>
    set((s) => ({ placedItems: s.placedItems.filter((p) => p.id !== id) })),

  duplicateZone: (id, locale = 'id') => {
    const source = get().zones.find((z) => z.id === id);
    if (!source) return null;
    const newId = nanoid(8);
    const suffix = locale === 'en' ? '(copy)' : '(salinan)';
    const offset = metersToPx(0.5);
    const dup: Zone = {
      ...source,
      id: newId,
      name: `${source.name} ${suffix}`,
      x: source.x + offset,
      y: source.y + offset,
    };
    set((s) => ({ zones: [...s.zones, dup], selectedZoneId: newId }));
    return newId;
  },

  setTourMode: (mode) => set({ tourMode: mode }),

  setPlacementMode: (active) => set({ placementMode: active }),

  setPendingPlacementItemId: (itemId) => set({ pendingPlacementItemId: itemId }),

  placeItemAt: (zoneId, itemId, pos) => {
    const id = nanoid(10);
    const record: PlacedItemRecord = {
      id,
      zoneId,
      itemId,
      quantity: 1,
      notes: '',
      ...(pos ? { position3d: pos } : {}),
    };
    set((s) => ({ placedItems: [...s.placedItems, record] }));
    return id;
  },

  reset: () => set(INITIAL),

  toProjectRecord: () => {
    const s = get();
    if (!s.projectId) return null;
    return {
      id: s.projectId,
      name: s.projectName,
      templateId: s.templateId,
      budgetTier: s.budgetTier,
      contingencyPct: s.contingencyPct,
      taxEnabled: s.taxEnabled,
      climateZone: s.climateZone,
      styleTag: s.styleTag,
      zones: s.zones,
      placedItems: s.placedItems,
      createdAt: 0,
      updatedAt: Date.now(),
    };
  },
}));

/**
 * Reset the singleton store to its initial data state. Test-only helper —
 * call from `beforeEach` so test cases don't leak state into each other.
 * Production code should never call this.
 *
 * Uses merge mode (no second arg) so the action functions stay attached
 * while only the data fields are reset.
 */
export function resetForTests(): void {
  useFloorPlan.setState(INITIAL);
}
