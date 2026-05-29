# Custom Layout v2 Usability + Sync Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Custom Layout v2 reliable and usable by keeping classic zones and advanced layout data synchronized, adding first-class advanced area creation/editing controls, and hardening persistence/3D behavior.

**Architecture:** Keep `zones` as the compatibility bridge for estimates, recommendations, PDF, and legacy flows, while treating `layoutV2` as the advanced geometry source for polygon editing and 3D rendering. Add small pure sync helpers in `src/lib/layout-v2/`, then use those helpers from the Zustand store so classic-zone mutations and advanced-layout mutations stay predictable. Improve the editor shell with focused controls rather than replacing the current rectangle workflow.

**Tech Stack:** TypeScript, Zustand, TanStack Start routes, IndexedDB/cloud `ProjectRecord`, Konva, React Three Fiber, i18next, Vitest, happy-dom, Playwright.

---

## File Structure

### Pure layout-v2 helpers

- Modify `src/lib/layout-v2/geometry.ts` — add helpers for area bounds and safe opening placement along a wall.
- Create `src/lib/layout-v2/sync.ts` — convert a single classic `Zone` to a `LayoutV2Area`, upsert/remove areas and walls, and derive a rectangle compatibility zone from an edited polygon area.
- Modify `src/lib/layout-v2/tour-transform.ts` — expose `getRenderableFloorIds()` and `LayoutV2TourFloorMode` for tour floor filtering.

### Store and persistence

- Modify `src/stores/floor-plan.ts` — keep `layoutV2` synchronized when zones are added, updated, deleted, or duplicated; add `addLayoutArea`, `deleteLayoutArea`, `setLayoutTourFloorMode`, and selected opening state/actions.
- Leave `src/lib/db/types.ts` unchanged for this plan; `layoutTourFloorMode` is transient UI state and is not persisted in `ProjectRecord`.

### Editor UI

- Modify `src/components/editor/LayoutCanvas.tsx` — improve selected wall styling, fix opening marker placement math, and add accessible `data-testid` hooks for e2e smoke.
- Modify `src/components/editor/LayoutInspectorPanel.tsx` — add area creation controls, selected wall details, opening offset/width controls, and remove-opening controls.
- Modify `src/components/editor/FloorSelector.tsx` — show active floor count and keep add-floor behavior stable.
- Modify `src/routes/projects.$projectId.editor.tsx` — keep advanced controls grouped, preserve current persistence watcher.
- Modify `src/locales/id/common.json` and `src/locales/en/common.json` — add user-facing labels for area creation, opening controls, and sync hints.

### 3D rendering

- Modify `src/components/tour/TourScene.tsx` — support active-floor-only vs all-floor rendering for `layoutV2`, with all-floor as the default for compatibility.
- Leave `src/components/tour/LayoutAreaMesh.tsx`, `src/components/tour/LayoutWallMesh.tsx`, and `src/components/tour/LayoutOpeningMarker.tsx` unchanged; floor filtering happens in `TourScene` before those components are rendered.

### Tests

- Create `tests/lib/layout-v2.sync.test.ts`.
- Modify `tests/lib/layout-v2.geometry.test.ts`.
- Modify `tests/stores/floor-plan.layout-v2.test.ts`.
- Modify `tests/components/layout-v2-controls.test.tsx`.
- Modify `tests-e2e/custom-layout-v2.spec.ts`.

---

## Task 1: Add pure layout sync helpers with TDD

**Files:**
- Create: `tests/lib/layout-v2.sync.test.ts`
- Create: `src/lib/layout-v2/sync.ts`
- Modify: `src/lib/layout-v2/geometry.ts`

- [ ] **Step 1: Write failing sync helper tests**

Create `tests/lib/layout-v2.sync.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { metersToPx } from '../../src/lib/zones';
import { migrateProjectToLayoutV2 } from '../../src/lib/layout-v2/migration';
import {
  areaToCompatibilityZone,
  removeAreaFromLayout,
  upsertAreaFromZone,
  zoneToLayoutArea,
} from '../../src/lib/layout-v2/sync';
import type { ProjectRecord } from '../../src/lib/db/types';
import type { LayoutV2Area } from '../../src/lib/layout-v2/types';

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

describe('layout-v2 sync helpers', () => {
  it('converts one zone to a layout area with material defaults', () => {
    expect(zoneToLayoutArea(project.zones[0]!, 'floor-1')).toMatchObject({
      id: 'area-z1',
      zoneId: 'z1',
      floorId: 'floor-1',
      kind: 'indoor',
      floorMaterial: 'tile',
      wallMaterial: 'paint',
    });
  });

  it('upserts an added zone into areas and wall segments', () => {
    const layout = migrateProjectToLayoutV2(project);
    const next = upsertAreaFromZone(layout, {
      id: 'z2',
      type: 'garden',
      name: 'Taman',
      x: 100,
      y: 0,
      width: 80,
      height: 60,
    });

    expect(next.areas.map((area) => area.zoneId)).toEqual(['z1', 'z2']);
    expect(next.walls.filter((wall) => wall.areaId === 'area-z2')).toHaveLength(4);
    expect(next.areas.find((area) => area.zoneId === 'z2')).toMatchObject({
      kind: 'outdoor',
      terrainMaterial: 'grass',
    });
  });

  it('updates an existing area when the classic zone rectangle changes', () => {
    const layout = migrateProjectToLayoutV2(project);
    const next = upsertAreaFromZone(layout, {
      ...project.zones[0]!,
      width: 100,
    });

    expect(next.areas).toHaveLength(1);
    expect(next.areas[0]?.points[1]).toEqual({ x: 100, y: 0 });
    expect(next.walls.filter((wall) => wall.areaId === 'area-z1')).toHaveLength(4);
  });

  it('removes area walls and openings when an area is removed', () => {
    const layout = migrateProjectToLayoutV2(project);
    const wallId = layout.walls[0]!.id;
    const next = removeAreaFromLayout(
      { ...layout, openings: [{ id: 'door-1', wallId, type: 'door', offsetM: 0.5, widthM: 0.9, heightM: 2.1, sillHeightM: 0 }] },
      'area-z1',
    );

    expect(next.areas).toEqual([]);
    expect(next.walls).toEqual([]);
    expect(next.openings).toEqual([]);
  });

  it('derives a compatibility rectangle from polygon bounds', () => {
    const area: LayoutV2Area = {
      id: 'area-z1',
      zoneId: 'z1',
      floorId: 'floor-1',
      name: 'Ruang Tamu',
      zoneType: 'living_room',
      kind: 'indoor',
      points: [
        { x: 10, y: 20 },
        { x: 10 + metersToPx(4), y: 20 },
        { x: 10 + metersToPx(4), y: 20 + metersToPx(3) },
        { x: 10, y: 20 + metersToPx(3) },
      ],
      floorMaterial: 'wood',
      wallMaterial: 'paint',
    };

    expect(areaToCompatibilityZone(area)).toEqual({
      id: 'z1',
      type: 'living_room',
      name: 'Ruang Tamu',
      x: 10,
      y: 20,
      width: 80,
      height: 60,
    });
  });
});
```

- [ ] **Step 2: Run red test**

Run:

```bash
npm test -- tests/lib/layout-v2.sync.test.ts
```

Expected: FAIL because `src/lib/layout-v2/sync.ts` does not exist.

- [ ] **Step 3: Implement sync helpers**

Create `src/lib/layout-v2/sync.ts`:

```ts
import { isIndoor, type Zone } from '../zones';
import { polygonBounds, rectZoneToPoints, wallsFromArea } from './geometry';
import type { LayoutV2, LayoutV2Area } from './types';

const DEFAULT_FLOOR_ID = 'floor-1';

export function zoneToLayoutArea(zone: Zone, floorId = DEFAULT_FLOOR_ID): LayoutV2Area {
  const indoor = isIndoor(zone.type);
  return {
    id: `area-${zone.id}`,
    zoneId: zone.id,
    floorId,
    name: zone.name,
    zoneType: zone.type,
    kind: indoor ? 'indoor' : 'outdoor',
    points: rectZoneToPoints(zone),
    floorMaterial: indoor ? 'tile' : 'outdoor',
    wallMaterial: indoor ? 'paint' : 'concrete',
    ...(indoor ? {} : { terrainMaterial: 'grass' as const }),
  };
}

export function upsertAreaFromZone(layout: LayoutV2, zone: Zone, floorId = layout.activeFloorId): LayoutV2 {
  const existing = layout.areas.find((area) => area.zoneId === zone.id);
  const nextArea = existing
    ? { ...existing, name: zone.name, zoneType: zone.type, points: rectZoneToPoints(zone) }
    : zoneToLayoutArea(zone, floorId);
  const areas = existing
    ? layout.areas.map((area) => (area.id === nextArea.id ? nextArea : area))
    : [...layout.areas, nextArea];
  const walls = [
    ...layout.walls.filter((wall) => wall.areaId !== nextArea.id),
    ...wallsFromArea(nextArea),
  ];
  const validWallIds = new Set(walls.map((wall) => wall.id));
  return {
    ...layout,
    areas,
    walls,
    openings: layout.openings.filter((opening) => validWallIds.has(opening.wallId)),
  };
}

export function removeAreaFromLayout(layout: LayoutV2, areaId: string): LayoutV2 {
  const wallIds = new Set(layout.walls.filter((wall) => wall.areaId === areaId).map((wall) => wall.id));
  return {
    ...layout,
    areas: layout.areas.filter((area) => area.id !== areaId),
    walls: layout.walls.filter((wall) => wall.areaId !== areaId),
    openings: layout.openings.filter((opening) => !wallIds.has(opening.wallId)),
  };
}

export function areaToCompatibilityZone(area: LayoutV2Area): Zone {
  const bounds = polygonBounds(area.points);
  return {
    id: area.zoneId,
    type: area.zoneType,
    name: area.name,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}
```

- [ ] **Step 4: Run green test**

Run:

```bash
npm test -- tests/lib/layout-v2.sync.test.ts
```

Expected: PASS.

- [ ] **Step 5: Refactor migration to reuse sync helper**

Modify `src/lib/layout-v2/migration.ts` to import `zoneToLayoutArea` and remove duplicated area construction:

```ts
import type { ProjectRecord } from '../db/types';
import { wallsFromArea } from './geometry';
import { zoneToLayoutArea } from './sync';
import type { LayoutV2 } from './types';

const DEFAULT_FLOOR_ID = 'floor-1';

export function migrateProjectToLayoutV2(project: ProjectRecord): LayoutV2 {
  if (project.layoutV2?.version === 2) return project.layoutV2;

  const areas = project.zones.map((zone) => zoneToLayoutArea(zone, DEFAULT_FLOOR_ID));

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

- [ ] **Step 6: Run helper and migration tests**

Run:

```bash
npm test -- tests/lib/layout-v2.sync.test.ts tests/lib/layout-v2.migration.test.ts
```

Expected: PASS.

---

## Task 2: Keep classic zones and layout-v2 synchronized in the store

**Files:**
- Modify: `tests/stores/floor-plan.layout-v2.test.ts`
- Modify: `src/stores/floor-plan.ts`

- [ ] **Step 1: Add failing store sync tests**

Append these tests inside `describe('floor-plan layout v2 state', ...)` in `tests/stores/floor-plan.layout-v2.test.ts`:

```ts
  it('adds a matching layout area when a classic zone is added', () => {
    useFloorPlan.getState().loadProject(project);
    const zoneId = useFloorPlan.getState().addZone('garden', 'Taman');

    const area = useFloorPlan.getState().layoutV2?.areas.find((candidate) => candidate.zoneId === zoneId);
    expect(area).toMatchObject({ zoneId, name: 'Taman', kind: 'outdoor', terrainMaterial: 'grass' });
    expect(useFloorPlan.getState().layoutV2?.walls.filter((wall) => wall.areaId === `area-${zoneId}`)).toHaveLength(4);
  });

  it('updates layout area points when a classic zone rectangle changes', () => {
    useFloorPlan.getState().loadProject(project);
    useFloorPlan.getState().updateZone('z1', { width: 100 });

    expect(useFloorPlan.getState().layoutV2?.areas[0]?.points[1]).toEqual({ x: 100, y: 0 });
  });

  it('removes matching layout area, walls, and openings when a classic zone is deleted', () => {
    useFloorPlan.getState().loadProject(project);
    const wallId = useFloorPlan.getState().layoutV2!.walls[0]!.id;
    useFloorPlan.getState().addOpening(wallId, 'door');

    useFloorPlan.getState().deleteZone('z1');

    expect(useFloorPlan.getState().layoutV2?.areas).toEqual([]);
    expect(useFloorPlan.getState().layoutV2?.walls).toEqual([]);
    expect(useFloorPlan.getState().layoutV2?.openings).toEqual([]);
  });

  it('creates a classic compatibility zone when adding an advanced layout area', () => {
    useFloorPlan.getState().loadProject(project);
    const areaId = useFloorPlan.getState().addLayoutArea('terrace', 'Teras Baru');

    const area = useFloorPlan.getState().layoutV2?.areas.find((candidate) => candidate.id === areaId);
    expect(area).toMatchObject({ zoneType: 'terrace', name: 'Teras Baru', kind: 'outdoor' });
    expect(useFloorPlan.getState().zones.some((zone) => zone.id === area?.zoneId)).toBe(true);
  });

  it('updates the classic compatibility zone bounds when polygon points change', () => {
    useFloorPlan.getState().loadProject(project);
    useFloorPlan.getState().updateAreaPoints('area-z1', [
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 80 },
      { x: 10, y: 80 },
    ]);

    expect(useFloorPlan.getState().zones[0]).toMatchObject({ x: 10, y: 20, width: 100, height: 60 });
  });
```

- [ ] **Step 2: Run red store tests**

Run:

```bash
npm test -- tests/stores/floor-plan.layout-v2.test.ts
```

Expected: FAIL because `addZone`, `updateZone`, `deleteZone`, and `updateAreaPoints` do not fully synchronize both models, and `addLayoutArea` does not exist.

- [ ] **Step 3: Import sync helpers and add store action types**

In `src/stores/floor-plan.ts`, update imports:

```ts
import { areaToCompatibilityZone, removeAreaFromLayout, upsertAreaFromZone } from '../lib/layout-v2/sync';
```

Extend `FloorPlanState` after `setActiveFloor`:

```ts
  addLayoutArea: (type: ZoneType, name: string) => string;
  deleteLayoutArea: (areaId: string) => void;
```

- [ ] **Step 4: Synchronize classic zone actions**

Replace `addZone`, `updateZone`, and `deleteZone` with implementations shaped like this:

```ts
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
        ...(s.layoutV2 && changed ? { layoutV2: upsertAreaFromZone(s.layoutV2, changed) } : {}),
      };
    }),

  deleteZone: (id) =>
    set((s) => {
      const area = s.layoutV2?.areas.find((candidate) => candidate.zoneId === id);
      return {
        zones: s.zones.filter((z) => z.id !== id),
        placedItems: s.placedItems.filter((p) => p.zoneId !== id),
        selectedZoneId: s.selectedZoneId === id ? null : s.selectedZoneId,
        selectedLayoutAreaId: area?.id === s.selectedLayoutAreaId ? null : s.selectedLayoutAreaId,
        selectedLayoutWallId: area ? null : s.selectedLayoutWallId,
        ...(s.layoutV2 && area ? { layoutV2: removeAreaFromLayout(s.layoutV2, area.id) } : {}),
      };
    }),
```

- [ ] **Step 5: Add advanced area creation and deletion actions**

Add these action implementations before `updateAreaPoints`:

```ts
  addLayoutArea: (type, name) => {
    const layout = get().layoutV2;
    const id = nanoid(8);
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
      selectedLayoutAreaId: `area-${zone.id}`,
      selectedLayoutWallId: null,
      ...(layout ? { layoutV2: upsertAreaFromZone(layout, zone) } : {}),
    }));
    return `area-${id}`;
  },

  deleteLayoutArea: (areaId) =>
    set((s) => {
      const area = s.layoutV2?.areas.find((candidate) => candidate.id === areaId);
      if (!s.layoutV2 || !area) return {};
      return {
        layoutV2: removeAreaFromLayout(s.layoutV2, areaId),
        zones: s.zones.filter((zone) => zone.id !== area.zoneId),
        placedItems: s.placedItems.filter((item) => item.zoneId !== area.zoneId),
        selectedZoneId: s.selectedZoneId === area.zoneId ? null : s.selectedZoneId,
        selectedLayoutAreaId: s.selectedLayoutAreaId === areaId ? null : s.selectedLayoutAreaId,
        selectedLayoutWallId: null,
      };
    }),
```

If TypeScript complains that the returned `area-${id}` string can diverge from the selected id, use a `const areaId = `area-${id}`;` local and return that exact value.

- [ ] **Step 6: Synchronize polygon edits back to compatibility zones**

Update `updateAreaPoints` so it also updates the matching classic zone bounds:

```ts
  updateAreaPoints: (areaId, points) =>
    set((s) => {
      if (!s.layoutV2) return {};
      const areas = s.layoutV2.areas.map((area) =>
        area.id === areaId ? { ...area, points } : area,
      );
      const changed = areas.find((area) => area.id === areaId);
      const walls = changed
        ? [...s.layoutV2.walls.filter((wall) => wall.areaId !== areaId), ...wallsFromArea(changed)]
        : s.layoutV2.walls;
      const validWallIds = new Set(walls.map((wall) => wall.id));
      return {
        layoutV2: {
          ...s.layoutV2,
          areas,
          walls,
          openings: s.layoutV2.openings.filter((opening) => validWallIds.has(opening.wallId)),
        },
        ...(changed
          ? {
              zones: s.zones.map((zone) =>
                zone.id === changed.zoneId ? areaToCompatibilityZone(changed) : zone,
              ),
            }
          : {}),
      };
    }),
```

- [ ] **Step 7: Run green store tests**

Run:

```bash
npm test -- tests/stores/floor-plan.layout-v2.test.ts tests/lib/layout-v2.sync.test.ts
```

Expected: PASS.

---

## Task 3: Improve advanced layout editor controls

**Files:**
- Modify: `tests/components/layout-v2-controls.test.tsx`
- Modify: `src/components/editor/LayoutInspectorPanel.tsx`
- Modify: `src/components/editor/LayoutCanvas.tsx`
- Modify: `src/locales/id/common.json`
- Modify: `src/locales/en/common.json`

- [ ] **Step 1: Add failing component tests for area creation and opening controls**

Append to `tests/components/layout-v2-controls.test.tsx`:

```tsx
  it('adds an outdoor layout area from the inspector', async () => {
    useFloorPlan.setState({
      layoutV2: {
        version: 2,
        activeFloorId: 'floor-1',
        floors: [{ id: 'floor-1', name: 'Lantai 1', level: 1, elevationM: 0 }],
        areas: [],
        walls: [],
        openings: [],
      },
    });
    const { LayoutInspectorPanel } = await import('../../src/components/editor/LayoutInspectorPanel');

    render(
      <I18nextProvider i18n={i18n}>
        <LayoutInspectorPanel />
      </I18nextProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: /Tambah area teras|Add terrace area/ }));

    expect(useFloorPlan.getState().layoutV2?.areas[0]).toMatchObject({ zoneType: 'terrace' });
  });

  it('shows opening controls for a selected wall', async () => {
    useFloorPlan.getState().loadProject({
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
    });
    const wallId = useFloorPlan.getState().layoutV2!.walls[0]!.id;
    useFloorPlan.getState().selectLayoutWall(wallId);
    const { LayoutInspectorPanel } = await import('../../src/components/editor/LayoutInspectorPanel');

    render(
      <I18nextProvider i18n={i18n}>
        <LayoutInspectorPanel />
      </I18nextProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: /Tambah pintu|Add door/ }));

    expect(screen.getByLabelText(/Offset pintu|Door offset/)).toBeVisible();
    expect(useFloorPlan.getState().layoutV2?.openings).toHaveLength(1);
  });
```

- [ ] **Step 2: Run red component tests**

Run:

```bash
npm test -- tests/components/layout-v2-controls.test.tsx
```

Expected: FAIL because the inspector has no area creation buttons and no opening edit controls.

- [ ] **Step 3: Add locale keys**

Extend `layoutV2` in `src/locales/id/common.json`:

```json
    "quickAdd": "Tambah cepat",
    "addLivingArea": "Tambah area ruang tamu",
    "addTerraceArea": "Tambah area teras",
    "openings": "Bukaan",
    "doorOffset": "Offset pintu",
    "windowOffset": "Offset jendela",
    "openingWidth": "Lebar bukaan",
    "removeOpening": "Hapus bukaan",
    "noOpenings": "Belum ada pintu atau jendela di dinding ini."
```

Extend `layoutV2` in `src/locales/en/common.json`:

```json
    "quickAdd": "Quick add",
    "addLivingArea": "Add living area",
    "addTerraceArea": "Add terrace area",
    "openings": "Openings",
    "doorOffset": "Door offset",
    "windowOffset": "Window offset",
    "openingWidth": "Opening width",
    "removeOpening": "Remove opening",
    "noOpenings": "No doors or windows on this wall yet."
```

- [ ] **Step 4: Add quick-add controls and opening controls to inspector**

Modify `src/components/editor/LayoutInspectorPanel.tsx`:

```tsx
  const addLayoutArea = useFloorPlan((s) => s.addLayoutArea);
  const updateOpening = useFloorPlan((s) => s.updateOpening);
  const removeOpening = useFloorPlan((s) => s.removeOpening);
```

Add this block after the select hint paragraph:

```tsx
      {!area && !wall && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
            {t('layoutV2.quickAdd')}
          </p>
          <button
            type="button"
            onClick={() => addLayoutArea('living_room', t('zoneType.living_room'))}
            className="w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 py-2 text-sm hover:border-[color:var(--color-accent)]"
          >
            {t('layoutV2.addLivingArea')}
          </button>
          <button
            type="button"
            onClick={() => addLayoutArea('terrace', t('zoneType.terrace'))}
            className="w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 py-2 text-sm hover:border-[color:var(--color-accent)]"
          >
            {t('layoutV2.addTerraceArea')}
          </button>
        </div>
      )}
```

Inside the `{wall && (...)}` block, after the add door/window buttons, add:

```tsx
          <div className="pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
              {t('layoutV2.openings')}
            </p>
            {layout.openings.filter((opening) => opening.wallId === wall.id).length === 0 && (
              <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
                {t('layoutV2.noOpenings')}
              </p>
            )}
            {layout.openings
              .filter((opening) => opening.wallId === wall.id)
              .map((opening) => (
                <div key={opening.id} className="mt-3 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] p-3">
                  <label className="block text-xs text-[color:var(--color-text-muted)]">
                    {opening.type === 'door' ? t('layoutV2.doorOffset') : t('layoutV2.windowOffset')}
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={opening.offsetM}
                      onChange={(event) => updateOpening(opening.id, { offsetM: Number(event.target.value) })}
                      className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="mt-2 block text-xs text-[color:var(--color-text-muted)]">
                    {t('layoutV2.openingWidth')}
                    <input
                      type="number"
                      min={0.3}
                      step={0.1}
                      value={opening.widthM}
                      onChange={(event) => updateOpening(opening.id, { widthM: Number(event.target.value) })}
                      className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-2 py-1 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeOpening(opening.id)}
                    className="mt-2 text-xs text-red-600 hover:underline"
                  >
                    {t('layoutV2.removeOpening')}
                  </button>
                </div>
              ))}
          </div>
```

- [ ] **Step 5: Improve LayoutCanvas selection and opening marker math**

Modify opening marker placement in `src/components/editor/LayoutCanvas.tsx` to use pixel-per-meter conversion from `zones` rather than `length / 20`:

```ts
import { metersToPx } from '../../lib/zones';
```

Replace:

```ts
const t = opening.offsetM / (length / 20);
```

with:

```ts
const t = Math.min(1, Math.max(0, metersToPx(opening.offsetM) / length));
```

Also increase selected wall visibility by selecting `selectedLayoutWallId`:

```ts
  const selectedWallId = useFloorPlan((s) => s.selectedLayoutWallId);
```

Then set wall stroke width using the selected wall:

```tsx
strokeWidth={selectedWallId === wall.id ? 8 : wall.heightM > 1 ? 5 : 3}
```

- [ ] **Step 6: Run green component tests and typecheck**

Run:

```bash
npm test -- tests/components/layout-v2-controls.test.tsx
npm run typecheck
```

Expected: PASS.

---

## Task 4: Harden 3D floor visibility and multi-floor rendering

**Files:**
- Modify: `tests/lib/layout-v2.tour-transform.test.ts`
- Modify: `src/lib/layout-v2/tour-transform.ts`
- Modify: `src/stores/floor-plan.ts`
- Modify: `src/components/tour/TourScene.tsx`

- [ ] **Step 1: Add failing floor filter tests**

Append to `tests/lib/layout-v2.tour-transform.test.ts`:

```ts
import { getRenderableFloorIds } from '../../src/lib/layout-v2/tour-transform';

describe('layout-v2 tour floor filtering', () => {
  it('renders every floor by default', () => {
    expect(getRenderableFloorIds(['floor-1', 'floor-2'], 'floor-2', 'all')).toEqual(['floor-1', 'floor-2']);
  });

  it('can render only the active floor', () => {
    expect(getRenderableFloorIds(['floor-1', 'floor-2'], 'floor-2', 'active')).toEqual(['floor-2']);
  });
});
```

- [ ] **Step 2: Run red transform test**

Run:

```bash
npm test -- tests/lib/layout-v2.tour-transform.test.ts -t "tour floor filtering"
```

Expected: FAIL because `getRenderableFloorIds` does not exist.

- [ ] **Step 3: Implement floor filter helper**

In `src/lib/layout-v2/tour-transform.ts`, add:

```ts
export type LayoutV2TourFloorMode = 'all' | 'active';

export function getRenderableFloorIds(
  floorIds: string[],
  activeFloorId: string,
  mode: LayoutV2TourFloorMode,
): string[] {
  if (mode === 'active') return floorIds.filter((floorId) => floorId === activeFloorId);
  return floorIds;
}
```

- [ ] **Step 4: Add transient tour floor mode to store**

Modify `src/stores/floor-plan.ts` imports:

```ts
import type { LayoutV2TourFloorMode } from '../lib/layout-v2/tour-transform';
```

Extend state:

```ts
  layoutTourFloorMode: LayoutV2TourFloorMode;
  setLayoutTourFloorMode: (mode: LayoutV2TourFloorMode) => void;
```

Add `layoutTourFloorMode: 'all'` to `INITIAL` and implement:

```ts
  setLayoutTourFloorMode: (layoutTourFloorMode) => set({ layoutTourFloorMode }),
```

- [ ] **Step 5: Filter layout-v2 meshes in TourScene**

In `src/components/tour/TourScene.tsx`, import helper:

```ts
import { getRenderableFloorIds } from '../../lib/layout-v2/tour-transform';
```

Select mode:

```ts
  const layoutTourFloorMode = useFloorPlan((s) => s.layoutTourFloorMode);
```

Before render return, derive floor IDs:

```ts
  const renderableLayoutFloorIds = useMemo(() => {
    if (!layoutV2) return new Set<string>();
    return new Set(
      getRenderableFloorIds(
        layoutV2.floors.map((floor) => floor.id),
        layoutV2.activeFloorId,
        layoutTourFloorMode,
      ),
    );
  }, [layoutTourFloorMode, layoutV2]);
```

Filter layout areas/walls/openings with `renderableLayoutFloorIds.has(...)` before rendering them.

- [ ] **Step 6: Run transform tests and typecheck**

Run:

```bash
npm test -- tests/lib/layout-v2.tour-transform.test.ts
npm run typecheck
```

Expected: PASS.

---

## Task 5: Add end-to-end persistence smoke for advanced edits

**Files:**
- Modify: `tests-e2e/custom-layout-v2.spec.ts`

- [ ] **Step 1: Extend e2e to cover advanced persistence**

Modify `tests-e2e/custom-layout-v2.spec.ts` so the test performs these observable actions:

```ts
  await page.getByRole('button', { name: /Tambah area teras|Add terrace area/ }).click();
  await expect(page.getByText(/Teras|Terrace/).first()).toBeVisible();
  await page.getByText(/Teras|Terrace/).first().click();
  await expect(page.getByText(/Material luar ruang|Outdoor material/)).toBeVisible();

  await expect(page.getByText('Tersimpan')).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await page.getByRole('button', { name: /Layout lanjutan|Advanced layout/ }).click();
  await expect(page.getByText(/Teras|Terrace/).first()).toBeVisible({ timeout: 10_000 });
```

Keep the existing final navigation to 3D tour and canvas visibility assertion.

- [ ] **Step 2: Run red/green e2e smoke after implementing UI tasks**

Run:

```bash
npm run test:e2e -- tests-e2e/custom-layout-v2.spec.ts
```

Expected after Tasks 2-4: PASS. If it fails because text selection hits Konva canvas text rather than DOM text, add stable `data-testid` attributes to the wrapper controls and use Playwright `getByTestId()` for the area creation button and floor selector. Do not add test-only production behavior.

---

## Task 6: Final verification and compatibility checks

**Files:**
- All changed files in this plan.

- [ ] **Step 1: Run focused Custom Layout v2 suite**

Run:

```bash
npm test -- tests/lib/layout-v2.geometry.test.ts tests/lib/layout-v2.migration.test.ts tests/lib/layout-v2.sync.test.ts tests/lib/layout-v2.tour-transform.test.ts tests/stores/floor-plan.layout-v2.test.ts tests/components/layout-v2-controls.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run affected existing compatibility tests**

Run:

```bash
npm test -- tests/stores/floor-plan.test.ts tests/zones.test.ts tests/recommendation.test.ts tests/tour-transform.test.ts tests/tour-placement.test.ts tests/server/projects.test.ts
```

Expected: PASS. These prove classic zones, recommendations, tour placement, and project persistence still work.

- [ ] **Step 3: Run repository checks**

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: PASS. Existing Vite chunk-size warnings are acceptable if the process exits 0.

- [ ] **Step 4: Run e2e smoke for old and advanced flows**

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
3. Add a classic indoor zone and outdoor zone.
4. Switch to advanced layout and confirm both have polygon areas.
5. Add a terrace area from the advanced inspector.
6. Drag one polygon vertex.
7. Select a wall, add a door, change its offset, and confirm marker moves.
8. Add a second floor and switch active floor.
9. Reload editor and confirm advanced layout persists.
10. Open 3D tour and confirm polygon floors, walls, and opening markers render without runtime errors.

Expected: save indicator reaches “Tersimpan”, no console/page errors, old estimate/recommendation routes still work from compatibility zones.

---

## Implementation Notes

- Keep TDD strict: every new store/helper behavior starts with a failing test.
- Keep `layoutV2` additive and optional; do not remove existing `zones` or classic editor behavior.
- Synchronization direction for this hardening slice:
  - Classic zone changes update matching `layoutV2` area/walls.
  - Advanced polygon point changes update the classic compatibility zone bounds.
  - Advanced area creation also creates a classic zone so estimates/recommendations/PDF keep working.
- Do not implement CAD constraints, wall boolean cutouts, roofs, stairs, or photorealistic materials in this plan.
- Avoid Zustand selector `.map()`/`.filter()` in React components when the result is selected directly from the store. Select raw state and derive locally in render or with `useMemo`.
- Use Indonesian locale keys by default and English mirrors in `src/locales/en/common.json`.

## Self-Review

- Spec coverage: this plan hardens the already-implemented Custom Layout v2 foundation by covering sync, advanced area creation, opening controls, multi-floor tour filtering, persistence, and compatibility tests.
- Placeholder scan: no deferred placeholders remain; every task includes exact files, code shape, commands, and expected outcomes.
- Type consistency: plan uses existing `LayoutV2`, `LayoutV2Area`, `LayoutV2Opening`, `Zone`, `ZoneType`, `layoutMode`, and current store action naming. New names introduced here are `sync.ts`, `addLayoutArea`, `deleteLayoutArea`, `layoutTourFloorMode`, `setLayoutTourFloorMode`, and `getRenderableFloorIds`.
