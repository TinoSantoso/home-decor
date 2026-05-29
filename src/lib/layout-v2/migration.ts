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
