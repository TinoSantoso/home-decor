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
