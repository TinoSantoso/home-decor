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
  zones: [
    {
      id: 'z1',
      type: 'living_room',
      name: 'Ruang Tamu',
      x: 0,
      y: 0,
      width: 80,
      height: 60,
    },
  ],
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
    expect(next.walls.filter((wall) => wall.areaId === 'area-z2')).toHaveLength(
      4,
    );
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
    expect(next.walls.filter((wall) => wall.areaId === 'area-z1')).toHaveLength(
      4,
    );
  });

  it('recomputes kind and material defaults when an existing zone changes indoor/outdoor type', () => {
    const layout = migrateProjectToLayoutV2(project);
    const outdoor = upsertAreaFromZone(layout, {
      ...project.zones[0]!,
      type: 'garden',
      name: 'Taman',
    });
    const outdoorArea = outdoor.areas.find((area) => area.zoneId === 'z1');

    expect(outdoorArea).toMatchObject({
      id: 'area-z1',
      zoneId: 'z1',
      floorId: 'floor-1',
      kind: 'outdoor',
      zoneType: 'garden',
      floorMaterial: 'outdoor',
      wallMaterial: 'concrete',
      terrainMaterial: 'grass',
    });

    const indoor = upsertAreaFromZone(outdoor, project.zones[0]!);
    const indoorArea = indoor.areas.find((area) => area.zoneId === 'z1');

    expect(indoorArea).toMatchObject({
      id: 'area-z1',
      zoneId: 'z1',
      floorId: 'floor-1',
      kind: 'indoor',
      zoneType: 'living_room',
      floorMaterial: 'tile',
      wallMaterial: 'paint',
    });
    expect(indoorArea && 'terrainMaterial' in indoorArea).toBe(false);
  });

  it('removes area walls and openings when an area is removed', () => {
    const layout = migrateProjectToLayoutV2(project);
    const wallId = layout.walls[0]!.id;
    const next = removeAreaFromLayout(
      {
        ...layout,
        openings: [
          {
            id: 'door-1',
            wallId,
            type: 'door',
            offsetM: 0.5,
            widthM: 0.9,
            heightM: 2.1,
            sillHeightM: 0,
          },
        ],
      },
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
