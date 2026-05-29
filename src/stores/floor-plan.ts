import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { type Zone, type ZoneType, metersToPx } from '../lib/zones';
import type { BudgetTier } from '../lib/cost-engine';
import type { StyleTag } from '../lib/catalog';
import type { PlacedItemRecord, ProjectRecord } from '../lib/db/types';
import { wallsFromArea } from '../lib/layout-v2/geometry';
import { migrateProjectToLayoutV2 } from '../lib/layout-v2/migration';
import type { LayoutV2TourFloorMode } from '../lib/layout-v2/tour-transform';
import {
  areaToCompatibilityZone,
  removeAreaFromLayout,
  upsertAreaFromZone,
} from '../lib/layout-v2/sync';
import type {
  LayoutPoint,
  LayoutV2,
  LayoutV2Opening,
  LayoutV2OpeningType,
} from '../lib/layout-v2/types';

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
  floorPlanImageUrl: string | null;
  zones: Zone[];
  selectedZoneId: string | null;
  placedItems: PlacedItemRecord[];
  layoutV2: LayoutV2 | null;
  layoutMode: 'classic' | 'advanced';
  selectedLayoutAreaId: string | null;
  selectedLayoutWallId: string | null;
  /** Whether drag/resize snaps to the 0.25 m grid. */
  snapEnabled: boolean;
  /** Camera mode for the 3D tour: orbital overview or first-person walk. */
  tourMode: 'orbit' | 'walk';
  layoutTourFloorMode: LayoutV2TourFloorMode;
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
  setFloorPlanImageUrl: (url: string | null) => void;
  setLayoutMode: (mode: 'classic' | 'advanced') => void;
  setActiveFloor: (floorId: string) => void;
  addLayoutArea: (type: ZoneType, name: string) => string;
  deleteLayoutArea: (areaId: string) => void;
  addFloor: () => string;
  selectLayoutArea: (areaId: string | null) => void;
  selectLayoutWall: (wallId: string | null) => void;
  updateAreaPoints: (areaId: string, points: LayoutPoint[]) => void;
  updateAreaMaterials: (
    areaId: string,
    patch: Partial<
      Pick<
        LayoutV2['areas'][number],
        'floorMaterial' | 'wallMaterial' | 'terrainMaterial'
      >
    >,
  ) => void;
  addOpening: (wallId: string, type: LayoutV2OpeningType) => string;
  updateOpening: (
    openingId: string,
    patch: Partial<Omit<LayoutV2Opening, 'id'>>,
  ) => void;
  removeOpening: (openingId: string) => void;
  addPlacedItem: (zoneId: string, itemId: string, quantity?: number) => string;
  updatePlacedItem: (
    id: string,
    patch: Partial<Omit<PlacedItemRecord, 'id'>>,
  ) => void;
  removePlacedItem: (id: string) => void;
  /**
   * Clone the given zone with the same dimensions, offset by 0.5 m, and
   * select the new zone. Returns the new zone id, or null if the source
   * zone does not exist. Locale controls the suffix ("(salinan)" vs "(copy)").
   */
  duplicateZone: (id: string, locale?: 'id' | 'en') => string | null;
  setTourMode: (mode: 'orbit' | 'walk') => void;
  setLayoutTourFloorMode: (mode: LayoutV2TourFloorMode) => void;
  setPlacementMode: (active: boolean) => void;
  setPendingPlacementItemId: (itemId: string | null) => void;
  /**
   * Place a catalog item at a 3D position inside a zone. Appends a new
   * PlacedItemRecord with position3d set. Returns the new record id.
   */
  placeItemAt: (
    zoneId: string,
    itemId: string,
    pos: [number, number, number],
  ) => string;
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
  | 'floorPlanImageUrl'
  | 'zones'
  | 'selectedZoneId'
  | 'placedItems'
  | 'layoutV2'
  | 'layoutMode'
  | 'selectedLayoutAreaId'
  | 'selectedLayoutWallId'
  | 'snapEnabled'
  | 'tourMode'
  | 'layoutTourFloorMode'
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
  floorPlanImageUrl: null,
  zones: [],
  selectedZoneId: null,
  placedItems: [],
  layoutV2: null,
  layoutMode: 'classic',
  selectedLayoutAreaId: null,
  selectedLayoutWallId: null,
  snapEnabled: true,
  tourMode: 'orbit',
  layoutTourFloorMode: 'all',
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
      floorPlanImageUrl: record.floorPlanImageUrl ?? null,
      zones: record.zones,
      placedItems: record.placedItems ?? [],
      layoutV2: migrateProjectToLayoutV2(record),
      layoutMode: 'classic',
      selectedLayoutAreaId: null,
      selectedLayoutWallId: null,
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
    set((s) => ({
      zones: [...s.zones, zone],
      selectedZoneId: id,
      ...(s.layoutV2 ? { layoutV2: upsertAreaFromZone(s.layoutV2, zone) } : {}),
    }));
    return id;
  },

  updateZone: (id, patch) =>
    set((s) => {
      const zones = s.zones.map((z) => (z.id === id ? { ...z, ...patch } : z));
      const changed = zones.find((zone) => zone.id === id);
      return {
        zones,
        ...(s.layoutV2 && changed
          ? { layoutV2: upsertAreaFromZone(s.layoutV2, changed) }
          : {}),
      };
    }),

  deleteZone: (id) =>
    set((s) => {
      const area = s.layoutV2?.areas.find(
        (candidate) => candidate.zoneId === id,
      );
      const selectedWallAreaId = s.layoutV2?.walls.find(
        (wall) => wall.id === s.selectedLayoutWallId,
      )?.areaId;
      return {
        zones: s.zones.filter((z) => z.id !== id),
        placedItems: s.placedItems.filter((p) => p.zoneId !== id),
        selectedZoneId: s.selectedZoneId === id ? null : s.selectedZoneId,
        selectedLayoutAreaId:
          area?.id === s.selectedLayoutAreaId ? null : s.selectedLayoutAreaId,
        selectedLayoutWallId:
          area?.id === selectedWallAreaId ? null : s.selectedLayoutWallId,
        ...(s.layoutV2 && area
          ? { layoutV2: removeAreaFromLayout(s.layoutV2, area.id) }
          : {}),
      };
    }),

  selectZone: (id) => set({ selectedZoneId: id }),

  setProjectName: (name) => set({ projectName: name }),

  setBudgetTier: (budgetTier) => set({ budgetTier }),

  setContingencyPct: (contingencyPct) =>
    set({ contingencyPct: Math.min(0.15, Math.max(0.05, contingencyPct)) }),

  setTaxEnabled: (taxEnabled) => set({ taxEnabled }),

  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),

  setStyleTag: (styleTag) => set({ styleTag }),

  setFloorPlanImageUrl: (floorPlanImageUrl) => set({ floorPlanImageUrl }),

  setLayoutMode: (layoutMode) => set({ layoutMode }),

  setActiveFloor: (floorId) =>
    set((s) =>
      s.layoutV2 ? { layoutV2: { ...s.layoutV2, activeFloorId: floorId } } : {},
    ),

  addFloor: () => {
    const layout = get().layoutV2;
    if (!layout) return '';
    const nextLevel =
      Math.max(...layout.floors.map((floor) => floor.level)) + 1;
    const id = `floor-${nextLevel}`;
    set({
      layoutV2: {
        ...layout,
        activeFloorId: id,
        floors: [
          ...layout.floors,
          {
            id,
            name: `Lantai ${nextLevel}`,
            level: nextLevel,
            elevationM: (nextLevel - 1) * 3.2,
          },
        ],
      },
    });
    return id;
  },

  selectLayoutArea: (selectedLayoutAreaId) =>
    set({ selectedLayoutAreaId, selectedLayoutWallId: null }),

  selectLayoutWall: (selectedLayoutWallId) =>
    set({ selectedLayoutWallId, selectedLayoutAreaId: null }),

  addLayoutArea: (type, name) => {
    const id = nanoid(8);
    const areaId = `area-${id}`;
    const zone: Zone = {
      id,
      type,
      name,
      x: 80 + Math.random() * 120,
      y: 80 + Math.random() * 120,
      width: DEFAULT_ZONE_SIZE,
      height: DEFAULT_ZONE_SIZE,
    };
    set((s) => ({
      zones: [...s.zones, zone],
      selectedZoneId: zone.id,
      selectedLayoutAreaId: areaId,
      selectedLayoutWallId: null,
      ...(s.layoutV2 ? { layoutV2: upsertAreaFromZone(s.layoutV2, zone) } : {}),
    }));
    return areaId;
  },

  deleteLayoutArea: (areaId) =>
    set((s) => {
      const area = s.layoutV2?.areas.find(
        (candidate) => candidate.id === areaId,
      );
      if (!s.layoutV2 || !area) return {};
      return {
        layoutV2: removeAreaFromLayout(s.layoutV2, areaId),
        zones: s.zones.filter((zone) => zone.id !== area.zoneId),
        placedItems: s.placedItems.filter(
          (item) => item.zoneId !== area.zoneId,
        ),
        selectedZoneId:
          s.selectedZoneId === area.zoneId ? null : s.selectedZoneId,
        selectedLayoutAreaId:
          s.selectedLayoutAreaId === areaId ? null : s.selectedLayoutAreaId,
        selectedLayoutWallId: null,
      };
    }),

  updateAreaPoints: (areaId, points) =>
    set((s) => {
      if (!s.layoutV2) return {};
      const areas = s.layoutV2.areas.map((area) =>
        area.id === areaId ? { ...area, points } : area,
      );
      const changed = areas.find((area) => area.id === areaId);
      const walls = changed
        ? [
            ...s.layoutV2.walls.filter((wall) => wall.areaId !== areaId),
            ...wallsFromArea(changed),
          ]
        : s.layoutV2.walls;
      const validWallIds = new Set(walls.map((wall) => wall.id));
      return {
        layoutV2: {
          ...s.layoutV2,
          areas,
          walls,
          openings: s.layoutV2.openings.filter((opening) =>
            validWallIds.has(opening.wallId),
          ),
        },
        selectedLayoutWallId:
          s.selectedLayoutWallId && !validWallIds.has(s.selectedLayoutWallId)
            ? null
            : s.selectedLayoutWallId,
        ...(changed
          ? {
              zones: s.zones.map((zone) =>
                zone.id === changed.zoneId
                  ? areaToCompatibilityZone(changed)
                  : zone,
              ),
            }
          : {}),
      };
    }),

  updateAreaMaterials: (areaId, patch) =>
    set((s) =>
      s.layoutV2
        ? {
            layoutV2: {
              ...s.layoutV2,
              areas: s.layoutV2.areas.map((area) =>
                area.id === areaId ? { ...area, ...patch } : area,
              ),
            },
          }
        : {},
    ),

  addOpening: (wallId, type) => {
    const layout = get().layoutV2;
    if (!layout) return '';
    const id = nanoid(10);
    const opening: LayoutV2Opening = {
      id,
      wallId,
      type,
      offsetM: 0.5,
      widthM: type === 'door' ? 0.9 : 1.2,
      heightM: type === 'door' ? 2.1 : 1.2,
      sillHeightM: type === 'door' ? 0 : 0.9,
    };
    set({ layoutV2: { ...layout, openings: [...layout.openings, opening] } });
    return id;
  },

  updateOpening: (openingId, patch) =>
    set((s) =>
      s.layoutV2
        ? {
            layoutV2: {
              ...s.layoutV2,
              openings: s.layoutV2.openings.map((opening) =>
                opening.id === openingId ? { ...opening, ...patch } : opening,
              ),
            },
          }
        : {},
    ),

  removeOpening: (openingId) =>
    set((s) =>
      s.layoutV2
        ? {
            layoutV2: {
              ...s.layoutV2,
              openings: s.layoutV2.openings.filter(
                (opening) => opening.id !== openingId,
              ),
            },
          }
        : {},
    ),

  addPlacedItem: (zoneId, itemId, quantity = 1) => {
    const id = nanoid(10);
    const record: PlacedItemRecord = {
      id,
      zoneId,
      itemId,
      quantity,
      notes: '',
    };
    set((s) => ({ placedItems: [...s.placedItems, record] }));
    return id;
  },

  updatePlacedItem: (id, patch) =>
    set((s) => ({
      placedItems: s.placedItems.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
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
    set((s) => ({
      zones: [...s.zones, dup],
      selectedZoneId: newId,
      ...(s.layoutV2 ? { layoutV2: upsertAreaFromZone(s.layoutV2, dup) } : {}),
    }));
    return newId;
  },

  setTourMode: (mode) => set({ tourMode: mode }),

  setLayoutTourFloorMode: (layoutTourFloorMode) => set({ layoutTourFloorMode }),

  setPlacementMode: (active) => set({ placementMode: active }),

  setPendingPlacementItemId: (itemId) =>
    set({ pendingPlacementItemId: itemId }),

  placeItemAt: (zoneId, itemId, pos) => {
    const id = nanoid(10);
    const record: PlacedItemRecord = {
      id,
      zoneId,
      itemId,
      quantity: 1,
      notes: '',
      position3d: pos,
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
      floorPlanImageUrl: s.floorPlanImageUrl,
      layoutV2: s.layoutV2,
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
