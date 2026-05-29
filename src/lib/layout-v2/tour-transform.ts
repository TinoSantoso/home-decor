import { pxToMeters } from '../zones';
import type { LayoutPoint, LayoutV2Opening, LayoutV2Wall } from './types';

function roundM(value: number): number {
  return Number(value.toFixed(6));
}

export type LayoutV2TourFloorMode = 'all' | 'active';

export function getRenderableFloorIds(
  floorIds: string[],
  activeFloorId: string,
  mode: LayoutV2TourFloorMode,
): string[] {
  if (mode === 'active') return floorIds.filter((floorId) => floorId === activeFloorId);
  return floorIds;
}

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
    position: [
      roundM(startX + dx / 2),
      roundM(floorElevationM + wall.heightM / 2),
      roundM(startZ + dz / 2),
    ] as [number, number, number],
    scale: [roundM(length), wall.heightM, wall.thicknessM] as [number, number, number],
    rotationY: Math.atan2(dz, dx),
  };
}

export function openingToMarkerTransform(
  wall: LayoutV2Wall,
  opening: LayoutV2Opening,
  floorElevationM: number,
) {
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
      roundM(startX + ux * opening.offsetM),
      roundM(floorElevationM + opening.sillHeightM + opening.heightM / 2),
      roundM(startZ + uz * opening.offsetM + wall.thicknessM / 2 + 0.01),
    ] as [number, number, number],
    scale: [opening.widthM, opening.heightM, 0.03] as [number, number, number],
    rotationY: Math.atan2(dz, dx),
  };
}
