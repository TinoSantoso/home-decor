import { PIXELS_PER_METER, pxToMeters, snapPx, type Zone } from '../zones';
import type { LayoutPoint, LayoutV2Area, LayoutV2Wall } from './types';

export function rectZoneToPoints(
  zone: Pick<Zone, 'x' | 'y' | 'width' | 'height'>,
): LayoutPoint[] {
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
  return areaPx / (PIXELS_PER_METER * PIXELS_PER_METER);
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
