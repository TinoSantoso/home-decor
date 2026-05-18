import { create } from 'zustand';
import { nanoid } from 'nanoid';
import {
  type Zone,
  type ZoneType,
  metersToPx,
} from '../lib/zones';
import type { BudgetTier } from '../lib/cost-engine';
import type { ProjectRecord } from '../lib/db/types';

interface FloorPlanState {
  /** The id of the currently-open project, or null when no project is loaded. */
  projectId: string | null;
  projectName: string;
  templateId: string | null;
  budgetTier: BudgetTier;
  contingencyPct: number;
  taxEnabled: boolean;
  climateZone: string;
  zones: Zone[];
  selectedZoneId: string | null;

  loadProject: (record: ProjectRecord) => void;
  addZone: (type: ZoneType, name: string) => string;
  updateZone: (id: string, patch: Partial<Omit<Zone, 'id'>>) => void;
  deleteZone: (id: string) => void;
  selectZone: (id: string | null) => void;
  setProjectName: (name: string) => void;
  setBudgetTier: (tier: BudgetTier) => void;
  setContingencyPct: (pct: number) => void;
  setTaxEnabled: (enabled: boolean) => void;
  reset: () => void;
  toProjectRecord: () => ProjectRecord | null;
}

const DEFAULT_ZONE_SIZE = metersToPx(4);

const INITIAL: Omit<
  FloorPlanState,
  | 'loadProject'
  | 'addZone'
  | 'updateZone'
  | 'deleteZone'
  | 'selectZone'
  | 'setProjectName'
  | 'setBudgetTier'
  | 'setContingencyPct'
  | 'setTaxEnabled'
  | 'reset'
  | 'toProjectRecord'
> = {
  projectId: null,
  projectName: '',
  templateId: null,
  budgetTier: 'standar',
  contingencyPct: 0.1,
  taxEnabled: false,
  climateZone: 'tropical_indonesia',
  zones: [],
  selectedZoneId: null,
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
      zones: record.zones,
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
      selectedZoneId: s.selectedZoneId === id ? null : s.selectedZoneId,
    })),

  selectZone: (id) => set({ selectedZoneId: id }),

  setProjectName: (name) => set({ projectName: name }),

  setBudgetTier: (budgetTier) => set({ budgetTier }),

  setContingencyPct: (contingencyPct) =>
    set({ contingencyPct: Math.min(0.15, Math.max(0.05, contingencyPct)) }),

  setTaxEnabled: (taxEnabled) => set({ taxEnabled }),

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
      zones: s.zones,
      createdAt: 0,
      updatedAt: Date.now(),
    };
  },
}));
