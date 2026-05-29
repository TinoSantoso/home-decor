# Custom Layout v2 Design Spec

## Goal

Build **Layout Core v2**: a polygon/wall/floor layout foundation with a first-class 3D rendering upgrade. Users should be able to design custom indoor and outdoor home layouts beyond rectangular zones, then see those layouts as recognizable 3D home/decor scenes.

## Current baseline

The app already supports a rectangular zone MVP:

- `src/lib/zones.ts` defines indoor/outdoor zone types.
- `src/stores/floor-plan.ts` stores rectangular `Zone` records and placed decor items.
- `src/components/editor/FloorPlanCanvas.tsx` renders draggable/resizable Konva rectangles.
- `src/components/tour/TourScene.tsx` renders zone boxes, a flat ground plane, and placed item meshes.
- Project persistence serializes the store through `ProjectRecord` in IndexedDB and cloud `Project.data`.

Layout Core v2 should extend this model without breaking existing projects.

## Scope

### In scope

1. **Versioned layout model**
   - Add `layoutVersion: 2`-compatible data to `ProjectRecord` while still reading old rectangular `zones`.
   - Model polygon areas, wall segments, openings, floor levels, and surface materials as serializable JSON.

2. **Migration from rectangle zones**
   - Convert each existing rectangular zone into a four-point polygon area.
   - Generate boundary wall segments for indoor zones.
   - Generate lower terrain/boundary edges for outdoor zones.
   - Preserve existing `placedItems` and zone IDs where possible.

3. **2D polygon/wall editor foundation**
   - Add a layout editing mode next to the current rectangle workflow.
   - Users can select a floor, add a polygon area from a preset rectangle, edit vertices, and drag vertices on the grid.
   - Users can add doors/windows to wall segments from the selected area inspector.
   - Outdoor areas can choose a terrain material such as grass, paving, gravel, decking, or soil.

4. **Multi-floor foundation**
   - Support multiple floor levels in data and UI.
   - Editor and tour can filter/render the active floor.
   - Floor levels stack vertically in 3D with a simple height offset.

5. **3D rendering upgrade**
   - Render polygon floor slabs instead of rectangular zone boxes only.
   - Render walls from wall segments for indoor spaces.
   - Render doors/windows as wall opening markers or inset panels for the first pass.
   - Render outdoor terrain materials differently from indoor floors.
   - Keep placed item rendering working on top of layout v2 areas.

6. **Compatibility and persistence**
   - Existing routes continue to load old and new projects.
   - `toProjectRecord()` writes layout v2 data when present.
   - Estimate/share/PDF flows continue to work from the same project record.

### Out of scope for this slice

- Full CAD constraints.
- Curved walls.
- Stairs, roofs, ceiling generation, and structural beams.
- Photorealistic PBR texture catalog.
- Terrain sculpting/elevation.
- Boolean wall cutouts for complex window/door geometry.
- Collision/physics-based item placement.

## Data model

Add a new layout-v2 model alongside existing `zones`.

```ts
export type LayoutV2AreaKind = 'indoor' | 'outdoor';
export type LayoutV2TerrainMaterial = 'grass' | 'paving' | 'gravel' | 'decking' | 'soil';
export type LayoutV2FloorMaterial = 'tile' | 'wood' | 'concrete' | 'stone' | 'outdoor';
export type LayoutV2WallMaterial = 'paint' | 'brick' | 'wood_panel' | 'concrete';
export type LayoutV2OpeningType = 'door' | 'window';

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
  version: 2;
  activeFloorId: string;
  floors: LayoutV2Floor[];
  areas: LayoutV2Area[];
  walls: LayoutV2Wall[];
  openings: LayoutV2Opening[];
}
```

The store should expose helpers for editing this model, but pure geometry functions should live in `src/lib/layout-v2/` so they can be tested in Node.

## Architecture

```diagram
╭────────────────────╮
│ Existing Project    │
│ zones + items       │
╰─────────┬──────────╯
          │ loadProject()
          ▼
╭─────────────────────────────╮
│ migrateProjectLayoutV2()     │
│ rectangle zones → polygons   │
╰─────────┬───────────────────╯
          │
          ▼
╭─────────────────────────────╮
│ Zustand floor-plan store     │
│ zones + layoutV2 + items     │
╰──────┬──────────────┬───────╯
       │              │
       ▼              ▼
╭──────────────╮  ╭─────────────────╮
│ 2D editor    │  │ 3D tour renderer │
│ Konva layers │  │ R3F meshes       │
╰──────────────╯  ╰─────────────────╯
```

### Pure libraries

- `src/lib/layout-v2/types.ts` — serializable layout model types.
- `src/lib/layout-v2/geometry.ts` — polygon area, bounds, winding, point snapping, rectangle-to-polygon conversion, wall generation.
- `src/lib/layout-v2/materials.ts` — material tokens and mapping to 2D/3D colors.
- `src/lib/layout-v2/migration.ts` — convert existing project records to layout v2.
- `src/lib/layout-v2/tour-transform.ts` — convert layout v2 areas/walls/openings into 3D mesh transforms.

### Store

Extend `src/stores/floor-plan.ts` with `layoutV2` state and focused actions:

- `setActiveFloor(floorId)`
- `addFloor()`
- `updateAreaPoints(areaId, points)`
- `updateAreaMaterials(areaId, patch)`
- `addOpening(wallId, type)`
- `updateOpening(openingId, patch)`
- `removeOpening(openingId)`

Existing zone actions stay during migration so current UI and tests keep working.

### 2D editor

Add layout-v2 components without deleting the current rectangle editor:

- `LayoutModeToggle` switches between current zone mode and layout v2 mode.
- `FloorSelector` selects active floor and adds floors.
- `LayoutCanvas` renders polygon areas, vertices, walls, openings, and terrain material fills.
- `LayoutInspectorPanel` edits selected area materials and selected wall openings.

### 3D renderer

Extend tour rendering:

- `LayoutAreaMesh` renders polygon floor/terrain shape.
- `LayoutWallMesh` renders rectangular wall segments from line segments.
- `LayoutOpeningMarker` renders door/window visual panels on walls.
- `LayoutFloorStack` filters active floor or renders all floors with vertical offset depending on mode.

For the first pass, openings can be visual markers rather than real boolean holes. This avoids fragile geometry while still making doors/windows visible and useful.

## User experience

1. Existing projects open normally.
2. Editor shows a new “Layout v2” or “Advanced layout” toggle.
3. When opened, existing rectangles are converted to polygon areas automatically in memory.
4. User edits vertices, adds floors, chooses materials, and adds doors/windows.
5. The 3D tour shows polygon floors, walls, openings, outdoor materials, and placed items.
6. Estimate/share/PDF still work because existing zones/items remain available.

## Testing strategy

- Pure geometry tests for polygon area, bounds, rectangle conversion, wall generation, and 3D transforms.
- Store tests for migration, floor selection, vertex editing, materials, and openings.
- Component tests for editor controls using happy-dom where practical.
- E2E smoke for: create project → enable layout v2 → edit polygon → add door/window → open tour → see 3D canvas.

## Rollout strategy

Implement behind a feature-compatible UI toggle rather than replacing the current editor. This keeps the current MVP stable while Layout Core v2 matures. Once v2 is stable, the old rectangle canvas can become a simplified mode or be internally backed by layout v2 polygons.

## Open decisions resolved for this plan

- Scope is **A. Layout Core v2**.
- 3D improvements are first-class and included in the same implementation plan.
- Door/window rendering starts as visual markers, not boolean cutouts.
- Existing rectangular projects must keep working.
