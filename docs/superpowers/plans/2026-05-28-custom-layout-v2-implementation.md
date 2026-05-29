# Custom Layout v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Layout Core v2: polygon/wall/floor layout editing with door/window markers, multi-floor support, outdoor terrain materials, and a first-class 3D rendering upgrade while keeping existing rectangular projects working.

**Architecture:** Add a versioned `layoutV2` JSON model alongside existing `zones` in `ProjectRecord`. Keep geometry/migration/3D transform logic in pure `src/lib/layout-v2/` modules, extend the Zustand floor-plan store with focused layout actions, add opt-in editor UI components, then teach the 3D tour to render polygon floors, wall segments, openings, and outdoor materials. Existing rectangle zones remain the compatibility bridge for estimates, recommendations, and old projects.

**Tech Stack:** TypeScript, Zustand, TanStack Start routes, IndexedDB/Prisma JSON persistence, Konva, React Three Fiber, Vitest, Playwright.

---

## File Structure

### Create pure layout-v2 modules

- Create `src/lib/layout-v2/types.ts` — serializable layout model types and constants.
- Create `src/lib/layout-v2/geometry.ts` — polygon area/bounds, point snapping, rectangle conversion, wall generation, wall length helpers.
- Create `src/lib/layout-v2/materials.ts` — 2D and 3D material color maps for indoor floors, walls, and outdoor terrain.
- Create `src/lib/layout-v2/migration.ts` — convert existing `ProjectRecord.zones` into layout-v2 floors/areas/walls.
- Create `src/lib/layout-v2/tour-transform.ts` — convert layout-v2 areas/walls/openings into R3F-friendly geometry/transforms.

### Modify persistence and store

- Modify `src/lib/db/types.ts` — add optional `layoutV2?: LayoutV2 | null` to `ProjectRecord`.
- Modify `src/server/projects.ts` — extend `projectRecordSchema` with `layoutV2` validation.
- Modify `src/stores/floor-plan.ts` — add `layoutV2`, layout editor state, and layout-v2 actions.

### Add editor UI

- Create `src/components/editor/LayoutModeToggle.tsx` — switch between classic rectangle zones and advanced layout.
- Create `src/components/editor/FloorSelector.tsx` — active floor selector plus add-floor action.
- Create `src/components/editor/LayoutCanvas.tsx` — Konva polygon/wall/opening editor.
- Create `src/components/editor/LayoutInspectorPanel.tsx` — selected area/wall/opening inspector.
- Modify `src/routes/projects.$projectId.editor.tsx` — persist `layoutV2`, show the advanced layout UI when selected.
- Modify `src/locales/id/common.json` and `src/locales/en/common.json` — add layout-v2 labels.

### Add 3D rendering

- Create `src/components/tour/LayoutAreaMesh.tsx` — render polygon floor/terrain meshes.
- Create `src/components/tour/LayoutWallMesh.tsx` — render wall segment meshes.
- Create `src/components/tour/LayoutOpeningMarker.tsx` — render door/window markers on walls.
- Modify `src/components/tour/TourScene.tsx` — render layout-v2 scene when `layoutV2` exists, fallback to current zone boxes otherwise.

### Add tests

- Create `tests/lib/layout-v2.geometry.test.ts`.
- Create `tests/lib/layout-v2.migration.test.ts`.
- Create `tests/lib/layout-v2.tour-transform.test.ts`.
- Create `tests/stores/floor-plan.layout-v2.test.ts`.
- Create `tests/components/layout-v2-controls.test.tsx`.
- Modify `tests-e2e/happy-path.spec.ts` or create `tests-e2e/custom-layout-v2.spec.ts` for a smoke flow.

---

### Task 1: Add layout-v2 model types

**Files:**
- Create: `src/lib/layout-v2/types.ts`
- Modify: `src/lib/db/types.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Create serializable layout-v2 types**

Create `src/lib/layout-v2/types.ts`:

```ts
import type { ZoneType } from '../zones';

export const LAYOUT_V2_VERSION = 2 as const;

export const LAYOUT_V2_TERRAIN_MATERIALS = [
  'grass',
  'paving',
  'gravel',
  'decking',
  'soil',
] as const;

export const LAYOUT_V2_FLOOR_MATERIALS = [
  'tile',
  'wood',
  'concrete',
  'stone',
  'outdoor',
] as const;

export const LAYOUT_V2_WALL_MATERIALS = [
  'paint',
  'brick',
  'wood_panel',
  'concrete',
] as const;

export const LAYOUT_V2_OPENING_TYPES = ['door', 'window'] as const;

export type LayoutV2AreaKind = 'indoor' | 'outdoor';
export type LayoutV2TerrainMaterial = (typeof LAYOUT_V2_TERRAIN_MATERIALS)[number];
export type LayoutV2FloorMaterial = (typeof LAYOUT_V2_FLOOR_MATERIALS)[number];
export type LayoutV2WallMaterial = (typeof LAYOUT_V2_WALL_MATERIALS)[number];
export type LayoutV2OpeningType = (typeof LAYOUT_V2_OPENING_TYPES)[number];

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutV2Floor {
  id: string;
  name: string;
  level: number;
  elevationM: number;
}

export interface LayoutV2Area {
  id: string;
  zoneId: string;
  floorId: string;
  name: string;
  zoneType: ZoneType;
  kind: LayoutV2AreaKind;
  points: LayoutPoint[];
  floorMaterial: LayoutV2FloorMaterial;
  wallMaterial: LayoutV2WallMaterial;
  terrainMaterial?: LayoutV2TerrainMaterial;
}

export interface LayoutV2Wall {
  id: string;
  areaId: string;
  floorId: string;
  start: LayoutPoint;
  end: LayoutPoint;
  heightM: number;
  thicknessM: number;
  material: LayoutV2WallMaterial;
  exterior: boolean;
}

export interface LayoutV2Opening {
  id: string;
  wallId: string;
  type: LayoutV2OpeningType;
  offsetM: number;
  widthM: number;
  heightM: number;
  sillHeightM: number;
}

export interface LayoutV2 {
  version: typeof LAYOUT_V2_VERSION;
  activeFloorId: string;
  floors: LayoutV2Floor[];
  areas: LayoutV2Area[];
  walls: LayoutV2Wall[];
  openings: LayoutV2Opening[];
}
```

- [ ] **Step 2: Extend `ProjectRecord`**

Modify `src/lib/db/types.ts` by importing `LayoutV2` and adding the optional field:

```ts
import type { Zone } from '../zones';
import type { BudgetTier } from '../cost-engine';
import type { StyleTag } from '../catalog';
import type { LayoutV2 } from '../layout-v2/types';
```

Inside `ProjectRecord`, add this after `shareTokenExpiry?: number | null;`:

```ts
  /** Advanced polygon/wall/floor layout model. Optional for old rectangular projects. */
  layoutV2?: LayoutV2 | null;
```

- [ ] **Step 3: Verify type compatibility**

Run:

```bash
npm run typecheck
```

Expected: PASS. Optional field should not require existing project creation code to change yet.

---

### Task 2: Add pure geometry helpers with TDD

**Files:**
- Create: `tests/lib/layout-v2.geometry.test.ts`
- Create: `src/lib/layout-v2/geometry.ts`

- [ ] **Step 1: Write failing geometry tests**

Create `tests/lib/layout-v2.geometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { metersToPx } from '../../src/lib/zones';
import {
  polygonAreaM2,
  polygonBounds,
  rectZoneToPoints,
  wallLengthM,
  wallsFromArea,
} from '../../src/lib/layout-v2/geometry';
import type { LayoutV2Area } from '../../src/lib/layout-v2/types';

const area: LayoutV2Area = {
  id: 'area-1',
  zoneId: 'zone-1',
  floorId: 'floor-1',
  name: 'Ruang Tamu',
  zoneType: 'living_room',
  kind: 'indoor',
  points: [
    { x: 0, y: 0 },
    { x: metersToPx(4), y: 0 },
    { x: metersToPx(4), y: metersToPx(3) },
    { x: 0, y: metersToPx(3) },
  ],
  floorMaterial: 'tile',
  wallMaterial: 'paint',
};

describe('layout-v2 geometry', () => {
  it('converts a rectangular zone into clockwise polygon points', () => {
    expect(
      rectZoneToPoints({ x: 10, y: 20, width: 80, height: 60 }),
    ).toEqual([
      { x: 10, y: 20 },
      { x: 90, y: 20 },
      { x: 90, y: 80 },
      { x: 10, y: 80 },
    ]);
  });

  it('computes polygon area in square meters', () => {
    expect(polygonAreaM2(area.points)).toBe(12);
  });

  it('computes polygon bounds in pixels', () => {
    expect(polygonBounds(area.points)).toEqual({ x: 0, y: 0, width: 80, height: 60 });
  });

  it('generates one wall segment per polygon edge', () => {
    const walls = wallsFromArea(area);
    expect(walls).toHaveLength(4);
    expect(walls[0]).toMatchObject({
      id: 'wall-area-1-0',
      areaId: 'area-1',
      floorId: 'floor-1',
      heightM: 2.7,
      thicknessM: 0.12,
      material: 'paint',
      exterior: true,
    });
  });

  it('computes wall length in meters', () => {
    const [wall] = wallsFromArea(area);
    expect(wallLengthM(wall!)).toBe(4);
  });
});
```

- [ ] **Step 2: Run red test**

Run:

```bash
npm test -- tests/lib/layout-v2.geometry.test.ts
```

Expected: FAIL because `src/lib/layout-v2/geometry.ts` does not exist.

- [ ] **Step 3: Implement geometry helpers**

Create `src/lib/layout-v2/geometry.ts`:

```ts
import { pxToMeters, snapPx, type Zone } from '../zones';
import type { LayoutPoint, LayoutV2Area, LayoutV2Wall } from './types';

export function rectZoneToPoints(zone: Pick<Zone, 'x' | 'y' | 'width' | 'height'>): LayoutPoint[] {
  return [
    { x: zone.x, y: zone.y },
    { x: zone.x + zone.width, y: zone.y },
    { x: zone.x + zone.width, y: zone.y + zone.height },
    { x: zone.x, y: zone.y + zone.height },
  ];
}

export function snapPoint(point: LayoutPoint): LayoutPoint {
  return { x: snapPx(point.x), y: snapPx(point.y) };
}

export function polygonAreaM2(points: LayoutPoint[]): number {
  if (points.length < 3) return 0;
  let twiceAreaPx = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]!;
    const next = points[(i + 1) % points.length]!;
    twiceAreaPx += current.x * next.y - next.x * current.y;
  }
  const areaPx = Math.abs(twiceAreaPx) / 2;
  return pxToMeters(Math.sqrt(areaPx)) ** 2;
}

export function polygonBounds(points: LayoutPoint[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function wallsFromArea(area: LayoutV2Area): LayoutV2Wall[] {
  return area.points.map((start, index) => ({
    id: `wall-${area.id}-${index}`,
    areaId: area.id,
    floorId: area.floorId,
    start,
    end: area.points[(index + 1) % area.points.length]!,
    heightM: area.kind === 'indoor' ? 2.7 : 0.35,
    thicknessM: area.kind === 'indoor' ? 0.12 : 0.08,
    material: area.wallMaterial,
    exterior: true,
  }));
}

export function wallLengthM(wall: Pick<LayoutV2Wall, 'start' | 'end'>): number {
  const dxM = pxToMeters(wall.end.x - wall.start.x);
  const dyM = pxToMeters(wall.end.y - wall.start.y);
  return Math.hypot(dxM, dyM);
}
```

- [ ] **Step 4: Run green test**

Run:

```bash
npm test -- tests/lib/layout-v2.geometry.test.ts
```

Expected: PASS.

---

### Task 3: Add rectangle-to-layout migration

**Files:**
- Create: `tests/lib/layout-v2.migration.test.ts`
- Create: `src/lib/layout-v2/migration.ts`

- [ ] **Step 1: Write failing migration tests**

Create `tests/lib/layout-v2.migration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ProjectRecord } from '../../src/lib/db/types';
import { migrateProjectToLayoutV2 } from '../../src/lib/layout-v2/migration';

const project: ProjectRecord = {
  id: 'project-1',
  name: 'Rumah',
  templateId: null,
  budgetTier: 'standar',
  contingencyPct: 0.1,
  taxEnabled: false,
  climateZone: 'tropical_indonesia',
  styleTag: null,
  floorPlanImageUrl: null,
  shareToken: null,
  shareTokenExpiry: null,
  zones: [
    { id: 'z1', type: 'living_room', name: 'Ruang Tamu', x: 0, y: 0, width: 80, height: 60 },
    { id: 'z2', type: 'garden', name: 'Taman', x: 100, y: 0, width: 80, height: 60 },
  ],
  placedItems: [],
  createdAt: 1,
  updatedAt: 2,
};

describe('migrateProjectToLayoutV2', () => {
  it('returns existing layout when project already has layout v2', () => {
    const layout = migrateProjectToLayoutV2(project);
    expect(migrateProjectToLayoutV2({ ...project, layoutV2: layout })).toBe(layout);
  });

  it('creates one default floor and polygon areas from zones', () => {
    const layout = migrateProjectToLayoutV2(project);
    expect(layout.version).toBe(2);
    expect(layout.floors).toEqual([
      { id: 'floor-1', name: 'Lantai 1', level: 1, elevationM: 0 },
    ]);
    expect(layout.activeFloorId).toBe('floor-1');
    expect(layout.areas.map((area) => [area.zoneId, area.kind])).toEqual([
      ['z1', 'indoor'],
      ['z2', 'outdoor'],
    ]);
  });

  it('generates wall/boundary segments for every area edge', () => {
    const layout = migrateProjectToLayoutV2(project);
    expect(layout.walls).toHaveLength(8);
    expect(layout.walls.filter((wall) => wall.areaId === 'area-z1')).toHaveLength(4);
    expect(layout.walls.filter((wall) => wall.areaId === 'area-z2')).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run red test**

Run:

```bash
npm test -- tests/lib/layout-v2.migration.test.ts
```

Expected: FAIL because migration module does not exist.

- [ ] **Step 3: Implement migration**

Create `src/lib/layout-v2/migration.ts`:

```ts
import type { ProjectRecord } from '../db/types';
import { isIndoor } from '../zones';
import { rectZoneToPoints, wallsFromArea } from './geometry';
import type { LayoutV2, LayoutV2Area } from './types';

const DEFAULT_FLOOR_ID = 'floor-1';

export function migrateProjectToLayoutV2(project: ProjectRecord): LayoutV2 {
  if (project.layoutV2?.version === 2) return project.layoutV2;

  const areas: LayoutV2Area[] = project.zones.map((zone) => {
    const indoor = isIndoor(zone.type);
    return {
      id: `area-${zone.id}`,
      zoneId: zone.id,
      floorId: DEFAULT_FLOOR_ID,
      name: zone.name,
      zoneType: zone.type,
      kind: indoor ? 'indoor' : 'outdoor',
      points: rectZoneToPoints(zone),
      floorMaterial: indoor ? 'tile' : 'outdoor',
      wallMaterial: indoor ? 'paint' : 'concrete',
      ...(indoor ? {} : { terrainMaterial: 'grass' as const }),
    };
  });

  return {
    version: 2,
    activeFloorId: DEFAULT_FLOOR_ID,
    floors: [{ id: DEFAULT_FLOOR_ID, name: 'Lantai 1', level: 1, elevationM: 0 }],
    areas,
    walls: areas.flatMap(wallsFromArea),
    openings: [],
  };
}
```

- [ ] **Step 4: Run green test**

Run:

```bash
npm test -- tests/lib/layout-v2.migration.test.ts
```

Expected: PASS.

---

### Task 4: Extend server validation for `layoutV2`

**Files:**
- Modify: `src/server/projects.ts`
- Test: `tests/server/projects.test.ts`

- [ ] **Step 1: Add failing service test for layout persistence**

In `tests/server/projects.test.ts`, add inside `describe('createProjectService', ...)`:

```ts
  it('preserves layout v2 data when saving a project', async () => {
    const layoutV2 = {
      version: 2 as const,
      activeFloorId: 'floor-1',
      floors: [{ id: 'floor-1', name: 'Lantai 1', level: 1, elevationM: 0 }],
      areas: [],
      walls: [],
      openings: [],
    };
    vi.mocked(db.project.findFirst).mockResolvedValue(row());
    vi.mocked(db.project.update).mockResolvedValue(row({ data: record({ layoutV2 }) }));
    const service = createProjectService(db, { now: () => now });

    const result = await service.saveProject('user-1', record({ layoutV2 }));

    expect(result?.layoutV2).toEqual(layoutV2);
    expect(db.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: expect.objectContaining({ data: expect.objectContaining({ layoutV2 }) }),
    });
  });
```

- [ ] **Step 2: Run red test**

Run:

```bash
npm test -- tests/server/projects.test.ts -t "preserves layout v2"
```

Expected: FAIL because server-side project schema strips or rejects `layoutV2`.

- [ ] **Step 3: Add zod schema for layout-v2**

In `src/server/projects.ts`, add schemas before `projectRecordSchema`:

```ts
const layoutPointSchema = z.object({ x: z.number(), y: z.number() });

const layoutV2Schema = z.object({
  version: z.literal(2),
  activeFloorId: z.string(),
  floors: z.array(z.object({
    id: z.string(),
    name: z.string(),
    level: z.number(),
    elevationM: z.number(),
  })),
  areas: z.array(z.object({
    id: z.string(),
    zoneId: z.string(),
    floorId: z.string(),
    name: z.string(),
    zoneType: z.enum(ZONE_TYPES),
    kind: z.enum(['indoor', 'outdoor']),
    points: z.array(layoutPointSchema).min(3),
    floorMaterial: z.enum(['tile', 'wood', 'concrete', 'stone', 'outdoor']),
    wallMaterial: z.enum(['paint', 'brick', 'wood_panel', 'concrete']),
    terrainMaterial: z.enum(['grass', 'paving', 'gravel', 'decking', 'soil']).optional(),
  })),
  walls: z.array(z.object({
    id: z.string(),
    areaId: z.string(),
    floorId: z.string(),
    start: layoutPointSchema,
    end: layoutPointSchema,
    heightM: z.number(),
    thicknessM: z.number(),
    material: z.enum(['paint', 'brick', 'wood_panel', 'concrete']),
    exterior: z.boolean(),
  })),
  openings: z.array(z.object({
    id: z.string(),
    wallId: z.string(),
    type: z.enum(['door', 'window']),
    offsetM: z.number(),
    widthM: z.number(),
    heightM: z.number(),
    sillHeightM: z.number(),
  })),
});
```

Extend `projectRecordSchema`:

```ts
  layoutV2: layoutV2Schema.nullable().optional(),
```

Extend `normalizeProjectRecord` return object:

```ts
    layoutV2: record.layoutV2 ?? null,
```

Extend `recordFromRow` fallback object:

```ts
    layoutV2: null,
```

- [ ] **Step 4: Run green test and project tests**

Run:

```bash
npm test -- tests/server/projects.test.ts
```

Expected: PASS.

---

### Task 5: Extend floor-plan store with layout-v2 actions

**Files:**
- Create: `tests/stores/floor-plan.layout-v2.test.ts`
- Modify: `src/stores/floor-plan.ts`

- [ ] **Step 1: Write failing store tests**

Create `tests/stores/floor-plan.layout-v2.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { resetForTests, useFloorPlan } from '../../src/stores/floor-plan';
import type { ProjectRecord } from '../../src/lib/db/types';

const project: ProjectRecord = {
  id: 'project-1',
  name: 'Rumah',
  templateId: null,
  budgetTier: 'standar',
  contingencyPct: 0.1,
  taxEnabled: false,
  climateZone: 'tropical_indonesia',
  styleTag: null,
  floorPlanImageUrl: null,
  shareToken: null,
  shareTokenExpiry: null,
  zones: [{ id: 'z1', type: 'living_room', name: 'Ruang Tamu', x: 0, y: 0, width: 80, height: 60 }],
  placedItems: [],
  createdAt: 1,
  updatedAt: 2,
};

beforeEach(() => resetForTests());

describe('floor-plan layout v2 state', () => {
  it('migrates old rectangular projects to layout v2 on load', () => {
    useFloorPlan.getState().loadProject(project);
    expect(useFloorPlan.getState().layoutV2?.areas[0]?.zoneId).toBe('z1');
  });

  it('adds a second floor and makes it active', () => {
    useFloorPlan.getState().loadProject(project);
    const floorId = useFloorPlan.getState().addFloor();
    expect(useFloorPlan.getState().layoutV2?.activeFloorId).toBe(floorId);
    expect(useFloorPlan.getState().layoutV2?.floors).toHaveLength(2);
  });

  it('updates area points and persists them to project record', () => {
    useFloorPlan.getState().loadProject(project);
    useFloorPlan.getState().updateAreaPoints('area-z1', [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 60 },
      { x: 0, y: 60 },
    ]);
    expect(useFloorPlan.getState().toProjectRecord()?.layoutV2?.areas[0]?.points[1]).toEqual({ x: 100, y: 0 });
  });

  it('adds a door opening to a wall', () => {
    useFloorPlan.getState().loadProject(project);
    const wallId = useFloorPlan.getState().layoutV2!.walls[0]!.id;
    const openingId = useFloorPlan.getState().addOpening(wallId, 'door');
    expect(useFloorPlan.getState().layoutV2?.openings).toContainEqual(
      expect.objectContaining({ id: openingId, wallId, type: 'door', widthM: 0.9 }),
    );
  });
});
```

- [ ] **Step 2: Run red test**

Run:

```bash
npm test -- tests/stores/floor-plan.layout-v2.test.ts
```

Expected: FAIL because store has no `layoutV2` or layout actions.

- [ ] **Step 3: Extend store state and actions**

In `src/stores/floor-plan.ts`, import layout types/migration:

```ts
import type { LayoutPoint, LayoutV2, LayoutV2OpeningType } from '../lib/layout-v2/types';
import { migrateProjectToLayoutV2 } from '../lib/layout-v2/migration';
import { wallsFromArea } from '../lib/layout-v2/geometry';
```

Extend `FloorPlanState`:

```ts
  layoutV2: LayoutV2 | null;
  layoutMode: 'classic' | 'advanced';
  selectedLayoutAreaId: string | null;
  selectedLayoutWallId: string | null;
  setLayoutMode: (mode: 'classic' | 'advanced') => void;
  setActiveFloor: (floorId: string) => void;
  addFloor: () => string;
  selectLayoutArea: (areaId: string | null) => void;
  selectLayoutWall: (wallId: string | null) => void;
  updateAreaPoints: (areaId: string, points: LayoutPoint[]) => void;
  updateAreaMaterials: (areaId: string, patch: Partial<Pick<LayoutV2['areas'][number], 'floorMaterial' | 'wallMaterial' | 'terrainMaterial'>>) => void;
  addOpening: (wallId: string, type: LayoutV2OpeningType) => string;
  updateOpening: (openingId: string, patch: Partial<Omit<LayoutV2['openings'][number], 'id'>>) => void;
  removeOpening: (openingId: string) => void;
```

Extend `INITIAL` with:

```ts
  layoutV2: null,
  layoutMode: 'classic',
  selectedLayoutAreaId: null,
  selectedLayoutWallId: null,
```

Update `loadProject` to set layout:

```ts
      layoutV2: migrateProjectToLayoutV2(record),
      layoutMode: 'classic',
      selectedLayoutAreaId: null,
      selectedLayoutWallId: null,
```

Add action implementations before `reset`:

```ts
  setLayoutMode: (layoutMode) => set({ layoutMode }),

  setActiveFloor: (floorId) => set((s) => s.layoutV2
    ? { layoutV2: { ...s.layoutV2, activeFloorId: floorId } }
    : {}),

  addFloor: () => {
    const layout = get().layoutV2;
    if (!layout) return '';
    const nextLevel = Math.max(...layout.floors.map((floor) => floor.level)) + 1;
    const id = `floor-${nextLevel}`;
    set({
      layoutV2: {
        ...layout,
        activeFloorId: id,
        floors: [...layout.floors, { id, name: `Lantai ${nextLevel}`, level: nextLevel, elevationM: (nextLevel - 1) * 3.2 }],
      },
    });
    return id;
  },

  selectLayoutArea: (selectedLayoutAreaId) => set({ selectedLayoutAreaId, selectedLayoutWallId: null }),

  selectLayoutWall: (selectedLayoutWallId) => set({ selectedLayoutWallId, selectedLayoutAreaId: null }),

  updateAreaPoints: (areaId, points) => set((s) => {
    if (!s.layoutV2) return {};
    const areas = s.layoutV2.areas.map((area) => area.id === areaId ? { ...area, points } : area);
    const changed = areas.find((area) => area.id === areaId);
    const walls = changed
      ? [...s.layoutV2.walls.filter((wall) => wall.areaId !== areaId), ...wallsFromArea(changed)]
      : s.layoutV2.walls;
    return { layoutV2: { ...s.layoutV2, areas, walls } };
  }),

  updateAreaMaterials: (areaId, patch) => set((s) => s.layoutV2
    ? { layoutV2: { ...s.layoutV2, areas: s.layoutV2.areas.map((area) => area.id === areaId ? { ...area, ...patch } : area) } }
    : {}),

  addOpening: (wallId, type) => {
    const layout = get().layoutV2;
    if (!layout) return '';
    const id = nanoid(10);
    const opening = {
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

  updateOpening: (openingId, patch) => set((s) => s.layoutV2
    ? { layoutV2: { ...s.layoutV2, openings: s.layoutV2.openings.map((opening) => opening.id === openingId ? { ...opening, ...patch } : opening) } }
    : {}),

  removeOpening: (openingId) => set((s) => s.layoutV2
    ? { layoutV2: { ...s.layoutV2, openings: s.layoutV2.openings.filter((opening) => opening.id !== openingId) } }
    : {}),
```

Update `toProjectRecord()` to include:

```ts
      layoutV2: s.layoutV2,
```

- [ ] **Step 4: Include layout state in editor persistence watcher**

In `src/routes/projects.$projectId.editor.tsx`, add `layoutV2` to the watched keys:

```ts
        'layoutV2',
```

- [ ] **Step 5: Run green store tests**

Run:

```bash
npm test -- tests/stores/floor-plan.layout-v2.test.ts
```

Expected: PASS.

---

### Task 6: Add layout-v2 material maps

**Files:**
- Create: `src/lib/layout-v2/materials.ts`
- Test: `tests/lib/layout-v2.geometry.test.ts`

- [ ] **Step 1: Add material map assertions**

Append to `tests/lib/layout-v2.geometry.test.ts`:

```ts
import { getLayoutAreaFill, getLayoutWallColor } from '../../src/lib/layout-v2/materials';

describe('layout-v2 materials', () => {
  it('returns distinct colors for indoor and outdoor surfaces', () => {
    expect(getLayoutAreaFill({ kind: 'indoor', floorMaterial: 'wood' })).toMatch(/^#[0-9a-f]{6}$/i);
    expect(getLayoutAreaFill({ kind: 'outdoor', floorMaterial: 'outdoor', terrainMaterial: 'grass' })).toBe('#6f9f5f');
    expect(getLayoutWallColor('brick')).toBe('#a66a4b');
  });
});
```

- [ ] **Step 2: Run red test**

Run:

```bash
npm test -- tests/lib/layout-v2.geometry.test.ts -t "layout-v2 materials"
```

Expected: FAIL because materials module does not exist.

- [ ] **Step 3: Implement materials**

Create `src/lib/layout-v2/materials.ts`:

```ts
import type { LayoutV2AreaKind, LayoutV2FloorMaterial, LayoutV2TerrainMaterial, LayoutV2WallMaterial } from './types';

const FLOOR_COLORS: Record<LayoutV2FloorMaterial, string> = {
  tile: '#d8d2c4',
  wood: '#b58a5b',
  concrete: '#b8b8b0',
  stone: '#9f9b8f',
  outdoor: '#8ea875',
};

const TERRAIN_COLORS: Record<LayoutV2TerrainMaterial, string> = {
  grass: '#6f9f5f',
  paving: '#b7aa96',
  gravel: '#9c9c94',
  decking: '#a8754f',
  soil: '#79553b',
};

const WALL_COLORS: Record<LayoutV2WallMaterial, string> = {
  paint: '#eee7dc',
  brick: '#a66a4b',
  wood_panel: '#9a6b43',
  concrete: '#b6b1a8',
};

export function getLayoutAreaFill(area: {
  kind: LayoutV2AreaKind;
  floorMaterial: LayoutV2FloorMaterial;
  terrainMaterial?: LayoutV2TerrainMaterial;
}): string {
  if (area.kind === 'outdoor' && area.terrainMaterial) return TERRAIN_COLORS[area.terrainMaterial];
  return FLOOR_COLORS[area.floorMaterial];
}

export function getLayoutWallColor(material: LayoutV2WallMaterial): string {
  return WALL_COLORS[material];
}
```

- [ ] **Step 4: Run green test**

Run:

```bash
npm test -- tests/lib/layout-v2.geometry.test.ts
```

Expected: PASS.

---

### Task 7: Add advanced layout mode shell in editor

**Files:**
- Create: `src/components/editor/LayoutModeToggle.tsx`
- Create: `src/components/editor/FloorSelector.tsx`
- Modify: `src/routes/projects.$projectId.editor.tsx`
- Modify: `src/locales/id/common.json`
- Modify: `src/locales/en/common.json`
- Test: `tests/components/layout-v2-controls.test.tsx`

- [ ] **Step 1: Write failing component test**

Create `tests/components/layout-v2-controls.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../src/lib/i18n';
import { resetForTests, useFloorPlan } from '../../src/stores/floor-plan';
import { LayoutModeToggle } from '../../src/components/editor/LayoutModeToggle';
import { FloorSelector } from '../../src/components/editor/FloorSelector';

beforeEach(() => resetForTests());

describe('layout v2 controls', () => {
  it('switches from classic to advanced layout mode', async () => {
    render(<I18nextProvider i18n={i18n}><LayoutModeToggle /></I18nextProvider>);
    await userEvent.click(screen.getByRole('button', { name: /Advanced layout|Layout lanjutan/ }));
    expect(useFloorPlan.getState().layoutMode).toBe('advanced');
  });

  it('adds a floor from the floor selector', async () => {
    useFloorPlan.setState({ layoutV2: {
      version: 2,
      activeFloorId: 'floor-1',
      floors: [{ id: 'floor-1', name: 'Lantai 1', level: 1, elevationM: 0 }],
      areas: [],
      walls: [],
      openings: [],
    }});
    render(<I18nextProvider i18n={i18n}><FloorSelector /></I18nextProvider>);
    await userEvent.click(screen.getByRole('button', { name: /Add floor|Tambah lantai/ }));
    expect(useFloorPlan.getState().layoutV2?.floors).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run red test**

Run:

```bash
npm test -- tests/components/layout-v2-controls.test.tsx
```

Expected: FAIL because components do not exist.

- [ ] **Step 3: Add components**

Create `src/components/editor/LayoutModeToggle.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { useFloorPlan } from '../../stores/floor-plan';

export function LayoutModeToggle() {
  const { t } = useTranslation();
  const layoutMode = useFloorPlan((s) => s.layoutMode);
  const setLayoutMode = useFloorPlan((s) => s.setLayoutMode);

  return (
    <div className="inline-flex rounded-[var(--radius)] border border-[color:var(--color-border)] p-1 text-sm">
      <button
        type="button"
        aria-pressed={layoutMode === 'classic'}
        onClick={() => setLayoutMode('classic')}
        className="rounded-[var(--radius-sm)] px-3 py-1.5 aria-pressed:bg-[color:var(--color-accent)] aria-pressed:text-[color:var(--color-accent-fg)]"
      >
        {t('layoutV2.modeClassic')}
      </button>
      <button
        type="button"
        aria-pressed={layoutMode === 'advanced'}
        onClick={() => setLayoutMode('advanced')}
        className="rounded-[var(--radius-sm)] px-3 py-1.5 aria-pressed:bg-[color:var(--color-accent)] aria-pressed:text-[color:var(--color-accent-fg)]"
      >
        {t('layoutV2.modeAdvanced')}
      </button>
    </div>
  );
}
```

Create `src/components/editor/FloorSelector.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { useFloorPlan } from '../../stores/floor-plan';

export function FloorSelector() {
  const { t } = useTranslation();
  const layout = useFloorPlan((s) => s.layoutV2);
  const setActiveFloor = useFloorPlan((s) => s.setActiveFloor);
  const addFloor = useFloorPlan((s) => s.addFloor);

  if (!layout) return null;

  return (
    <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[color:var(--color-border)] px-3 py-2 text-sm">
      <label htmlFor="layout-floor-select" className="text-[color:var(--color-text-muted)]">
        {t('layoutV2.floor')}
      </label>
      <select
        id="layout-floor-select"
        value={layout.activeFloorId}
        onChange={(event) => setActiveFloor(event.target.value)}
        className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-2 py-1"
      >
        {layout.floors.map((floor) => (
          <option key={floor.id} value={floor.id}>{floor.name}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => addFloor()}
        className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-2 py-1 hover:border-[color:var(--color-accent)]"
      >
        {t('layoutV2.addFloor')}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Add locale keys**

Add to both locale files:

```json
  "layoutV2": {
    "modeClassic": "Zona klasik",
    "modeAdvanced": "Layout lanjutan",
    "floor": "Lantai",
    "addFloor": "Tambah lantai"
  }
```

English values:

```json
  "layoutV2": {
    "modeClassic": "Classic zones",
    "modeAdvanced": "Advanced layout",
    "floor": "Floor",
    "addFloor": "Add floor"
  }
```

- [ ] **Step 5: Wire editor shell**

In `src/routes/projects.$projectId.editor.tsx`, import:

```ts
import { LayoutModeToggle } from '../components/editor/LayoutModeToggle';
import { FloorSelector } from '../components/editor/FloorSelector';
```

Select layout mode:

```ts
  const layoutMode = useFloorPlan((s) => s.layoutMode);
```

Render controls below `<EditorToolbar />`:

```tsx
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <LayoutModeToggle />
        {layoutMode === 'advanced' && <FloorSelector />}
      </div>
```

- [ ] **Step 6: Run green component test**

Run:

```bash
npm test -- tests/components/layout-v2-controls.test.tsx
```

Expected: PASS.

---

### Task 8: Add 2D LayoutCanvas and inspector foundation

**Files:**
- Create: `src/components/editor/LayoutCanvas.tsx`
- Create: `src/components/editor/LayoutInspectorPanel.tsx`
- Modify: `src/routes/projects.$projectId.editor.tsx`
- Test: `npm run typecheck`

- [ ] **Step 1: Create LayoutCanvas**

Create `src/components/editor/LayoutCanvas.tsx`:

```tsx
import { Circle, Group, Layer, Line, Stage, Text } from 'react-konva';
import { getLayoutAreaFill, getLayoutWallColor } from '../../lib/layout-v2/materials';
import { snapPoint } from '../../lib/layout-v2/geometry';
import { useFloorPlan } from '../../stores/floor-plan';

const STAGE_WIDTH = 1000;
const STAGE_HEIGHT = 700;

export function LayoutCanvas() {
  const layout = useFloorPlan((s) => s.layoutV2);
  const selectedAreaId = useFloorPlan((s) => s.selectedLayoutAreaId);
  const selectArea = useFloorPlan((s) => s.selectLayoutArea);
  const selectWall = useFloorPlan((s) => s.selectLayoutWall);
  const updateAreaPoints = useFloorPlan((s) => s.updateAreaPoints);

  if (!layout) return null;

  const activeAreas = layout.areas.filter((area) => area.floorId === layout.activeFloorId);
  const activeWalls = layout.walls.filter((wall) => wall.floorId === layout.activeFloorId);

  return (
    <div className="overflow-auto rounded-[var(--radius)] border border-[color:var(--color-border)] bg-white">
      <Stage width={STAGE_WIDTH} height={STAGE_HEIGHT}>
        <Layer>
          {activeAreas.map((area) => {
            const points = area.points.flatMap((point) => [point.x, point.y]);
            return (
              <Group key={area.id}>
                <Line
                  points={points}
                  closed
                  fill={getLayoutAreaFill(area)}
                  stroke={selectedAreaId === area.id ? '#3f7f5f' : '#6c6c64'}
                  strokeWidth={selectedAreaId === area.id ? 3 : 1.5}
                  opacity={0.72}
                  onMouseDown={() => selectArea(area.id)}
                />
                <Text x={area.points[0]!.x + 8} y={area.points[0]!.y + 8} text={area.name} fontSize={12} fill="#222" listening={false} />
                {selectedAreaId === area.id && area.points.map((point, index) => (
                  <Circle
                    key={`${area.id}-${index}`}
                    x={point.x}
                    y={point.y}
                    radius={6}
                    fill="#ffffff"
                    stroke="#3f7f5f"
                    strokeWidth={2}
                    draggable
                    onDragEnd={(event) => {
                      const next = [...area.points];
                      next[index] = snapPoint({ x: event.target.x(), y: event.target.y() });
                      updateAreaPoints(area.id, next);
                    }}
                  />
                ))}
              </Group>
            );
          })}
          {activeWalls.map((wall) => (
            <Line
              key={wall.id}
              points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
              stroke={getLayoutWallColor(wall.material)}
              strokeWidth={wall.heightM > 1 ? 5 : 3}
              onMouseDown={() => selectWall(wall.id)}
            />
          ))}
          {layout.openings.map((opening) => {
            const wall = layout.walls.find((candidate) => candidate.id === opening.wallId);
            if (!wall || wall.floorId !== layout.activeFloorId) return null;
            const dx = wall.end.x - wall.start.x;
            const dy = wall.end.y - wall.start.y;
            const length = Math.hypot(dx, dy) || 1;
            const t = opening.offsetM / (length / 20);
            return (
              <Circle
                key={opening.id}
                x={wall.start.x + dx * t}
                y={wall.start.y + dy * t}
                radius={opening.type === 'door' ? 7 : 5}
                fill={opening.type === 'door' ? '#b78352' : '#79aee8'}
              />
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
```

- [ ] **Step 2: Create LayoutInspectorPanel**

Create `src/components/editor/LayoutInspectorPanel.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { useFloorPlan } from '../../stores/floor-plan';

export function LayoutInspectorPanel() {
  const { t } = useTranslation();
  const layout = useFloorPlan((s) => s.layoutV2);
  const selectedAreaId = useFloorPlan((s) => s.selectedLayoutAreaId);
  const selectedWallId = useFloorPlan((s) => s.selectedLayoutWallId);
  const updateAreaMaterials = useFloorPlan((s) => s.updateAreaMaterials);
  const addOpening = useFloorPlan((s) => s.addOpening);

  if (!layout) return null;
  const area = layout.areas.find((candidate) => candidate.id === selectedAreaId) ?? null;
  const wall = layout.walls.find((candidate) => candidate.id === selectedWallId) ?? null;

  return (
    <aside className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <h2 className="font-semibold">{t('layoutV2.inspector')}</h2>
      {!area && !wall && <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">{t('layoutV2.selectHint')}</p>}

      {area && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium">{area.name}</p>
          <label className="block text-xs uppercase tracking-wide text-[color:var(--color-text-muted)]">
            {t('layoutV2.floorMaterial')}
            <select
              value={area.floorMaterial}
              onChange={(event) => updateAreaMaterials(area.id, { floorMaterial: event.target.value as typeof area.floorMaterial })}
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-2 py-1 text-sm"
            >
              {['tile', 'wood', 'concrete', 'stone', 'outdoor'].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          {area.kind === 'outdoor' && (
            <label className="block text-xs uppercase tracking-wide text-[color:var(--color-text-muted)]">
              {t('layoutV2.terrainMaterial')}
              <select
                value={area.terrainMaterial ?? 'grass'}
                onChange={(event) => updateAreaMaterials(area.id, { terrainMaterial: event.target.value as typeof area.terrainMaterial })}
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-2 py-1 text-sm"
              >
                {['grass', 'paving', 'gravel', 'decking', 'soil'].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          )}
        </div>
      )}

      {wall && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">{t('layoutV2.wallSelected')}</p>
          <button type="button" onClick={() => addOpening(wall.id, 'door')} className="w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 py-2 text-sm hover:border-[color:var(--color-accent)]">
            {t('layoutV2.addDoor')}
          </button>
          <button type="button" onClick={() => addOpening(wall.id, 'window')} className="w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 py-2 text-sm hover:border-[color:var(--color-accent)]">
            {t('layoutV2.addWindow')}
          </button>
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 3: Wire editor advanced mode**

In `src/routes/projects.$projectId.editor.tsx`, import:

```ts
import { LayoutCanvas } from '../components/editor/LayoutCanvas';
import { LayoutInspectorPanel } from '../components/editor/LayoutInspectorPanel';
```

Replace the main editor grid body with conditional rendering:

```tsx
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        {layoutMode === 'advanced' ? (
          <>
            <LayoutCanvas />
            <LayoutInspectorPanel />
          </>
        ) : (
          <>
            <Suspense fallback={<div className="grid h-[700px] place-items-center rounded-[var(--radius)] border border-[color:var(--color-border)]"><span className="text-sm text-[color:var(--color-text-muted)]">{t('editor.loadingCanvas')}</span></div>}>
              <FloorPlanCanvas />
            </Suspense>
            <ZoneDetailPanel />
          </>
        )}
      </div>
```

- [ ] **Step 4: Add locale labels**

Extend `layoutV2` locale object with Indonesian:

```json
    "inspector": "Inspector layout",
    "selectHint": "Pilih area atau dinding untuk mengedit layout.",
    "floorMaterial": "Material lantai",
    "terrainMaterial": "Material luar ruang",
    "wallSelected": "Dinding terpilih",
    "addDoor": "Tambah pintu",
    "addWindow": "Tambah jendela"
```

English:

```json
    "inspector": "Layout inspector",
    "selectHint": "Select an area or wall to edit the layout.",
    "floorMaterial": "Floor material",
    "terrainMaterial": "Outdoor material",
    "wallSelected": "Selected wall",
    "addDoor": "Add door",
    "addWindow": "Add window"
```

- [ ] **Step 5: Verify typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

---

### Task 9: Add layout-v2 3D transforms

**Files:**
- Create: `tests/lib/layout-v2.tour-transform.test.ts`
- Create: `src/lib/layout-v2/tour-transform.ts`

- [ ] **Step 1: Write failing transform tests**

Create `tests/lib/layout-v2.tour-transform.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { metersToPx } from '../../src/lib/zones';
import { areaToShapePoints, openingToMarkerTransform, wallToMeshTransform } from '../../src/lib/layout-v2/tour-transform';

describe('layout-v2 tour transforms', () => {
  it('maps polygon points from pixels to x/z meters', () => {
    expect(areaToShapePoints([
      { x: 0, y: 0 },
      { x: metersToPx(2), y: 0 },
      { x: metersToPx(2), y: metersToPx(1) },
    ])).toEqual([[0, 0], [2, 0], [2, 1]]);
  });

  it('creates wall transform from a 2D segment', () => {
    expect(wallToMeshTransform({
      id: 'wall-1',
      areaId: 'area-1',
      floorId: 'floor-1',
      start: { x: 0, y: 0 },
      end: { x: metersToPx(4), y: 0 },
      heightM: 2.7,
      thicknessM: 0.12,
      material: 'paint',
      exterior: true,
    }, 3.2)).toMatchObject({
      wallId: 'wall-1',
      position: [2, 4.55, 0],
      scale: [4, 2.7, 0.12],
      rotationY: 0,
    });
  });

  it('places opening marker along a wall by meter offset', () => {
    const wall = {
      id: 'wall-1', areaId: 'area-1', floorId: 'floor-1', start: { x: 0, y: 0 }, end: { x: metersToPx(4), y: 0 },
      heightM: 2.7, thicknessM: 0.12, material: 'paint' as const, exterior: true,
    };
    expect(openingToMarkerTransform(wall, { id: 'door-1', wallId: 'wall-1', type: 'door', offsetM: 1, widthM: 0.9, heightM: 2.1, sillHeightM: 0 }, 0)).toMatchObject({
      openingId: 'door-1',
      position: [1, 1.05, 0.07],
      scale: [0.9, 2.1, 0.03],
    });
  });
});
```

- [ ] **Step 2: Run red test**

Run:

```bash
npm test -- tests/lib/layout-v2.tour-transform.test.ts
```

Expected: FAIL because transform module does not exist.

- [ ] **Step 3: Implement tour transforms**

Create `src/lib/layout-v2/tour-transform.ts`:

```ts
import { pxToMeters } from '../zones';
import type { LayoutPoint, LayoutV2Opening, LayoutV2Wall } from './types';

export function areaToShapePoints(points: LayoutPoint[]): Array<[number, number]> {
  return points.map((point) => [pxToMeters(point.x), pxToMeters(point.y)]);
}

export function wallToMeshTransform(wall: LayoutV2Wall, floorElevationM: number) {
  const startX = pxToMeters(wall.start.x);
  const startZ = pxToMeters(wall.start.y);
  const endX = pxToMeters(wall.end.x);
  const endZ = pxToMeters(wall.end.y);
  const dx = endX - startX;
  const dz = endZ - startZ;
  const length = Math.hypot(dx, dz);
  return {
    wallId: wall.id,
    position: [startX + dx / 2, floorElevationM + wall.heightM / 2, startZ + dz / 2] as [number, number, number],
    scale: [length, wall.heightM, wall.thicknessM] as [number, number, number],
    rotationY: Math.atan2(dz, dx),
  };
}

export function openingToMarkerTransform(wall: LayoutV2Wall, opening: LayoutV2Opening, floorElevationM: number) {
  const startX = pxToMeters(wall.start.x);
  const startZ = pxToMeters(wall.start.y);
  const endX = pxToMeters(wall.end.x);
  const endZ = pxToMeters(wall.end.y);
  const dx = endX - startX;
  const dz = endZ - startZ;
  const length = Math.hypot(dx, dz) || 1;
  const ux = dx / length;
  const uz = dz / length;
  return {
    openingId: opening.id,
    position: [
      startX + ux * opening.offsetM,
      floorElevationM + opening.sillHeightM + opening.heightM / 2,
      startZ + uz * opening.offsetM + wall.thicknessM / 2 + 0.01,
    ] as [number, number, number],
    scale: [opening.widthM, opening.heightM, 0.03] as [number, number, number],
    rotationY: Math.atan2(dz, dx),
  };
}
```

- [ ] **Step 4: Run green test**

Run:

```bash
npm test -- tests/lib/layout-v2.tour-transform.test.ts
```

Expected: PASS.

---

### Task 10: Add 3D layout meshes and render path

**Files:**
- Create: `src/components/tour/LayoutAreaMesh.tsx`
- Create: `src/components/tour/LayoutWallMesh.tsx`
- Create: `src/components/tour/LayoutOpeningMarker.tsx`
- Modify: `src/components/tour/TourScene.tsx`
- Test: `npm run typecheck`

- [ ] **Step 1: Create LayoutAreaMesh**

Create `src/components/tour/LayoutAreaMesh.tsx`:

```tsx
import { useMemo } from 'react';
import * as THREE from 'three';
import type { LayoutV2Area } from '../../lib/layout-v2/types';
import { areaToShapePoints } from '../../lib/layout-v2/tour-transform';
import { getLayoutAreaFill } from '../../lib/layout-v2/materials';

export function LayoutAreaMesh({ area, elevationM }: { area: LayoutV2Area; elevationM: number }) {
  const shape = useMemo(() => {
    const [first, ...rest] = areaToShapePoints(area.points);
    const next = new THREE.Shape();
    if (!first) return next;
    next.moveTo(first[0], first[1]);
    for (const point of rest) next.lineTo(point[0], point[1]);
    next.closePath();
    return next;
  }, [area.points]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, elevationM + 0.015, 0]} receiveShadow>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color={getLayoutAreaFill(area)} roughness={0.8} />
    </mesh>
  );
}
```

- [ ] **Step 2: Create LayoutWallMesh**

Create `src/components/tour/LayoutWallMesh.tsx`:

```tsx
import type { LayoutV2Wall } from '../../lib/layout-v2/types';
import { getLayoutWallColor } from '../../lib/layout-v2/materials';
import { wallToMeshTransform } from '../../lib/layout-v2/tour-transform';

export function LayoutWallMesh({ wall, elevationM }: { wall: LayoutV2Wall; elevationM: number }) {
  const transform = wallToMeshTransform(wall, elevationM);
  return (
    <mesh position={transform.position} rotation={[0, -transform.rotationY, 0]} castShadow receiveShadow>
      <boxGeometry args={transform.scale} />
      <meshStandardMaterial color={getLayoutWallColor(wall.material)} roughness={0.75} />
    </mesh>
  );
}
```

- [ ] **Step 3: Create LayoutOpeningMarker**

Create `src/components/tour/LayoutOpeningMarker.tsx`:

```tsx
import type { LayoutV2Opening, LayoutV2Wall } from '../../lib/layout-v2/types';
import { openingToMarkerTransform } from '../../lib/layout-v2/tour-transform';

export function LayoutOpeningMarker({ wall, opening, elevationM }: { wall: LayoutV2Wall; opening: LayoutV2Opening; elevationM: number }) {
  const transform = openingToMarkerTransform(wall, opening, elevationM);
  return (
    <mesh position={transform.position} rotation={[0, -transform.rotationY, 0]}>
      <boxGeometry args={transform.scale} />
      <meshStandardMaterial color={opening.type === 'door' ? '#7c4f2d' : '#8cc7ff'} transparent opacity={0.82} />
    </mesh>
  );
}
```

- [ ] **Step 4: Render layout-v2 in TourScene**

In `src/components/tour/TourScene.tsx`, import the meshes:

```ts
import { LayoutAreaMesh } from './LayoutAreaMesh';
import { LayoutWallMesh } from './LayoutWallMesh';
import { LayoutOpeningMarker } from './LayoutOpeningMarker';
```

Select live layout from store:

```ts
  const liveLayoutV2 = useFloorPlan((s) => s.layoutV2);
  const layoutV2 = snapshot ? undefined : liveLayoutV2;
```

Inside the Canvas before the existing zone-box render block, add:

```tsx
          {layoutV2 && layoutV2.areas.map((area) => {
            const floor = layoutV2.floors.find((candidate) => candidate.id === area.floorId);
            return <LayoutAreaMesh key={area.id} area={area} elevationM={floor?.elevationM ?? 0} />;
          })}

          {layoutV2 && layoutV2.walls.map((wall) => {
            const floor = layoutV2.floors.find((candidate) => candidate.id === wall.floorId);
            return <LayoutWallMesh key={wall.id} wall={wall} elevationM={floor?.elevationM ?? 0} />;
          })}

          {layoutV2 && layoutV2.openings.map((opening) => {
            const wall = layoutV2.walls.find((candidate) => candidate.id === opening.wallId);
            if (!wall) return null;
            const floor = layoutV2.floors.find((candidate) => candidate.id === wall.floorId);
            return <LayoutOpeningMarker key={opening.id} wall={wall} opening={opening} elevationM={floor?.elevationM ?? 0} />;
          })}
```

Wrap existing zone-box render in a fallback condition:

```tsx
          {!layoutV2 && transforms.map((t, idx) => {
```

- [ ] **Step 5: Verify typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

---

### Task 11: Add E2E smoke for advanced layout and 3D rendering

**Files:**
- Create: `tests-e2e/custom-layout-v2.spec.ts`

- [ ] **Step 1: Write e2e smoke**

Create `tests-e2e/custom-layout-v2.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('creates an advanced layout and opens upgraded 3D tour', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/projects/new');
  await page.getByRole('button', { name: /Rumah Tapak T45/ }).click();
  await expect(page).toHaveURL(/\/projects\/[A-Za-z0-9_-]+\/editor$/);

  await page.getByRole('button', { name: 'Ruang Tamu' }).first().click();
  await page.getByRole('button', { name: /Layout lanjutan|Advanced layout/ }).click();
  await expect(page.getByLabel(/Lantai|Floor/)).toBeVisible();
  await page.getByText(/Ruang Tamu/).first().click();
  await expect(page.getByText(/Inspector layout|Layout inspector/)).toBeVisible();

  await expect(page.getByText('Tersimpan')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('link', { name: 'Tur 3D' }).click();
  await expect(page).toHaveURL(/\/projects\/[A-Za-z0-9_-]+\/tour$/);
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run e2e smoke**

Run:

```bash
npm run test:e2e -- tests-e2e/custom-layout-v2.spec.ts
```

Expected: PASS.

---

### Task 12: Final verification and compatibility checks

**Files:**
- All changed files

- [ ] **Step 1: Run focused layout-v2 tests**

Run:

```bash
npm test -- tests/lib/layout-v2.geometry.test.ts tests/lib/layout-v2.migration.test.ts tests/lib/layout-v2.tour-transform.test.ts tests/stores/floor-plan.layout-v2.test.ts tests/components/layout-v2-controls.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run existing affected tests**

Run:

```bash
npm test -- tests/stores/floor-plan.test.ts tests/zones.test.ts tests/recommendation.test.ts tests/tour-transform.test.ts tests/tour-placement.test.ts tests/server/projects.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run repository checks**

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: PASS. Existing Vite large chunk warnings are acceptable if the process exits 0.

- [ ] **Step 4: Run e2e smoke suite**

Run:

```bash
npm run test:e2e -- tests-e2e/happy-path.spec.ts tests-e2e/custom-layout-v2.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Manual browser smoke**

Run dev server:

```bash
npm run dev
```

Manual path:

1. Open `/projects/new`.
2. Create `Rumah Tapak T45`.
3. Add an indoor zone and an outdoor zone.
4. Switch to advanced layout.
5. Drag one polygon vertex.
6. Add a floor.
7. Select a wall and add a door/window marker.
8. Change outdoor material to grass/paving.
9. Open 3D tour and confirm polygon floor, walls, door/window marker, terrain color, and placed items render.

Expected: no runtime errors, save indicator reaches “Tersimpan”, and reload preserves advanced layout.

---

## Implementation Notes

- Keep `zones` as the compatibility bridge for estimates and recommendations during v2. Do not remove old zone code in this plan.
- `layoutV2` must remain optional because old IndexedDB/cloud records will not have it.
- Use pure functions for geometry and transforms. Do not import Three.js into `src/lib/layout-v2/*` except React/R3F component files.
- The first door/window pass uses visual markers, not true mesh cutouts. This keeps the feature shippable and testable.
- If the visual companion remains in use, add `.superpowers/` to `.gitignore` before staging project files.

## Self-Review

- Spec coverage: covers polygon layout, walls, doors/windows, multi-floor data/UI, outdoor terrain materials, 3D rendering, migration, persistence, tests, and compatibility.
- Placeholder scan: no deferred implementation placeholders; out-of-scope items are explicitly excluded.
- Type consistency: all plan snippets use `LayoutV2`, `LayoutV2Area`, `LayoutV2Wall`, `LayoutV2Opening`, and `LayoutPoint` from `src/lib/layout-v2/types.ts`.
