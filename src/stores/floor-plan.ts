import { create } from 'zustand';
import { nanoid } from 'nanoid';
import {
  type Zone,
  type ZoneType,
  metersToPx,
} from '../lib/zones';

interface FloorPlanState {
  zones: Zone[];
  selectedZoneId: string | null;
  addZone: (type: ZoneType, name: string) => string;
  updateZone: (id: string, patch: Partial<Omit<Zone, 'id'>>) => void;
  deleteZone: (id: string) => void;
  selectZone: (id: string | null) => void;
  reset: () => void;
}

const DEFAULT_ZONE_SIZE = metersToPx(4);

export const useFloorPlan = create<FloorPlanState>((set) => ({
  zones: [],
  selectedZoneId: null,

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

  reset: () => set({ zones: [], selectedZoneId: null }),
}));
