import { describe, expect, it } from 'vitest';
import { metersToPx, type Zone } from '../src/lib/zones';
import {
  DEFAULT_BOX_HEIGHT_M,
  TOUR_GROUND_PADDING_M,
  computeGroundSize,
  zoneToTransform,
} from '../src/lib/tour-transform';

function makeZone(partial: Partial<Zone>): Zone {
  return {
    id: 'z1',
    type: 'living_room',
    name: 'Living',
    x: 0,
    y: 0,
    width: metersToPx(4),
    height: metersToPx(5),
    ...partial,
  };
}

describe('zoneToTransform', () => {
  it('converts pixel coords to meters with the zone centered at its center', () => {
    const zone = makeZone({ x: 0, y: 0 });
    const t = zoneToTransform(zone);

    // 4 m wide × 5 m deep zone at (0, 0): center is (2, 2.5).
    expect(t.position[0]).toBeCloseTo(2, 6);
    expect(t.position[2]).toBeCloseTo(2.5, 6);
  });

  it('lifts the box by half its height so it sits on the ground (y=0)', () => {
    const t = zoneToTransform(makeZone({}));
    expect(t.position[1]).toBeCloseTo(DEFAULT_BOX_HEIGHT_M / 2, 6);
  });

  it('sets scale to the zone size in meters with the configured box height', () => {
    const t = zoneToTransform(makeZone({ width: metersToPx(3), height: metersToPx(2.5) }));
    expect(t.scale).toEqual([3, DEFAULT_BOX_HEIGHT_M, 2.5]);
  });

  it('returns the zone id so the scene can correlate with selection state', () => {
    const t = zoneToTransform(makeZone({ id: 'abc' }));
    expect(t.zoneId).toBe('abc');
  });

  it('translates pixel offsets to meter offsets faithfully', () => {
    // Zone at px (100, 60) sized (80×100 px) → meters (5, 3) sized (4×5 m).
    // Center should be at (5+2, _, 3+2.5) = (7, _, 5.5).
    const t = zoneToTransform(makeZone({ x: 100, y: 60, width: 80, height: 100 }));
    expect(t.position[0]).toBeCloseTo(7, 6);
    expect(t.position[2]).toBeCloseTo(5.5, 6);
  });
});

describe('computeGroundSize', () => {
  it('returns a square ground that covers every zone with padding on all sides', () => {
    const zones = [
      makeZone({ id: 'a', x: 0, y: 0, width: metersToPx(4), height: metersToPx(4) }),
      makeZone({ id: 'b', x: metersToPx(6), y: metersToPx(8), width: metersToPx(3), height: metersToPx(2) }),
    ];
    // Furthest extent: x reaches 6+3=9 m; z reaches 8+2=10 m. Plus padding both sides.
    const size = computeGroundSize(zones);
    const expected = 10 + TOUR_GROUND_PADDING_M * 2;
    expect(size).toBeGreaterThanOrEqual(expected);
  });

  it('returns a sensible minimum when no zones exist', () => {
    const size = computeGroundSize([]);
    expect(size).toBeGreaterThanOrEqual(TOUR_GROUND_PADDING_M * 2);
  });
});
