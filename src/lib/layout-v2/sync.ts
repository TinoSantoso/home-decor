import { isIndoor, type Zone } from '../zones';
import { polygonBounds, rectZoneToPoints, wallsFromArea } from './geometry';
import type { LayoutV2, LayoutV2Area } from './types';

const DEFAULT_FLOOR_ID = 'floor-1';

export function zoneToLayoutArea(
  zone: Zone,
  floorId = DEFAULT_FLOOR_ID,
): LayoutV2Area {
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

export function upsertAreaFromZone(
  layout: LayoutV2,
  zone: Zone,
  floorId = layout.activeFloorId,
): LayoutV2 {
  const existing = layout.areas.find((area) => area.zoneId === zone.id);
  const nextArea = existing
    ? existing.zoneType === zone.type
      ? {
          ...existing,
          name: zone.name,
          zoneType: zone.type,
          points: rectZoneToPoints(zone),
        }
      : {
          ...zoneToLayoutArea(zone, existing.floorId),
          id: existing.id,
          zoneId: existing.zoneId,
          floorId: existing.floorId,
        }
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
    openings: layout.openings.filter((opening) =>
      validWallIds.has(opening.wallId),
    ),
  };
}

export function removeAreaFromLayout(
  layout: LayoutV2,
  areaId: string,
): LayoutV2 {
  const wallIds = new Set(
    layout.walls
      .filter((wall) => wall.areaId === areaId)
      .map((wall) => wall.id),
  );
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
