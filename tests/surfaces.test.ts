import { describe, expect, it } from 'vitest';
import { metersToPx, type Zone } from '../src/lib/zones';
import {
  DEFAULT_FLOOR_PRICES,
  DEFAULT_PAINT_PRICES,
  DEFAULT_WALL_HEIGHT_M,
  deriveSurfacesFromZones,
  zonePerimeterM,
  zoneWallAreaM2,
} from '../src/lib/surfaces';

function makeZone(widthM: number, heightM: number): Zone {
  return {
    id: 'z1',
    type: 'living_room',
    name: 'Living',
    x: 0,
    y: 0,
    width: metersToPx(widthM),
    height: metersToPx(heightM),
  };
}

describe('surfaces', () => {
  it('computes the perimeter of a zone in meters', () => {
    expect(zonePerimeterM(makeZone(4, 5))).toBe(18);
  });

  it('computes wall area with default wall height and openings factor', () => {
    // 4x5 zone: perimeter 18 m × 2.7 m height × 0.85 openings = 41.31
    expect(zoneWallAreaM2(makeZone(4, 5))).toBeCloseTo(
      18 * DEFAULT_WALL_HEIGHT_M * 0.85,
      3,
    );
  });

  it('derives floor + paint surfaces per zone', () => {
    const surfaces = deriveSurfacesFromZones([makeZone(4, 5)]);
    expect(surfaces).toHaveLength(2);

    const floor = surfaces.find((s) => s.category === 'flooring')!;
    const paint = surfaces.find((s) => s.category === 'paint')!;

    expect(floor.zoneId).toBe('z1');
    expect(floor.areaM2).toBe(20);
    expect(floor.unitPricePerM2ByTier).toEqual(DEFAULT_FLOOR_PRICES);

    // Paint = walls + ceiling
    const expectedPaint = 18 * DEFAULT_WALL_HEIGHT_M * 0.85 + 20;
    expect(paint.areaM2).toBeCloseTo(expectedPaint, 3);
    expect(paint.unitPricePerM2ByTier).toEqual(DEFAULT_PAINT_PRICES);
  });

  it('produces two surfaces per zone for multi-zone projects', () => {
    const surfaces = deriveSurfacesFromZones([
      makeZone(4, 5),
      { ...makeZone(3, 3), id: 'z2', name: 'Bedroom' },
    ]);
    expect(surfaces).toHaveLength(4);
    expect(surfaces.filter((s) => s.zoneId === 'z1')).toHaveLength(2);
    expect(surfaces.filter((s) => s.zoneId === 'z2')).toHaveLength(2);
  });
});
