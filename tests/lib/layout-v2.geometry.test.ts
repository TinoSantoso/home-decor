import { describe, expect, it } from 'vitest';
import { metersToPx } from '../../src/lib/zones';
import {
  polygonAreaM2,
  polygonBounds,
  rectZoneToPoints,
  wallLengthM,
  wallsFromArea,
} from '../../src/lib/layout-v2/geometry';
import { getLayoutAreaFill, getLayoutWallColor } from '../../src/lib/layout-v2/materials';
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
    expect(rectZoneToPoints({ x: 10, y: 20, width: 80, height: 60 })).toEqual([
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

describe('layout-v2 materials', () => {
  it('returns distinct colors for indoor and outdoor surfaces', () => {
    expect(getLayoutAreaFill({ kind: 'indoor', floorMaterial: 'wood' })).toMatch(
      /^#[0-9a-f]{6}$/i,
    );
    expect(
      getLayoutAreaFill({ kind: 'outdoor', floorMaterial: 'outdoor', terrainMaterial: 'grass' }),
    ).toBe('#6f9f5f');
    expect(getLayoutWallColor('brick')).toBe('#a66a4b');
  });
});
