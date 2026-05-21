import { describe, expect, it } from 'vitest';
import {
  cmToMeters,
  withinZoneBounds,
  clickToZoneCoords,
} from '../src/lib/tour-placement';
import type { ZoneTransform } from '../src/lib/tour-transform';

// Helper to build a ZoneTransform
function makeTransform(
  zoneId: string,
  position: [number, number, number],
  scale: [number, number, number],
): ZoneTransform {
  return { zoneId, position, scale };
}

// ── cmToMeters ───────────────────────────────────────────────────────────────

describe('cmToMeters', () => {
  it('converts 100 cm to 1 m', () => {
    expect(cmToMeters(100)).toBeCloseTo(1.0);
  });

  it('converts 240 cm to 2.4 m', () => {
    expect(cmToMeters(240)).toBeCloseTo(2.4);
  });

  it('converts 0 cm to 0 m', () => {
    expect(cmToMeters(0)).toBe(0);
  });

  it('converts fractional centimeters', () => {
    expect(cmToMeters(78)).toBeCloseTo(0.78);
  });
});

// ── clickToZoneCoords ────────────────────────────────────────────────────────

describe('clickToZoneCoords', () => {
  it('returns zone-relative position when hit is at zone center', () => {
    // Zone centered at (5, 1.35, 3) with scale (4, 2.7, 5).
    const t = makeTransform('z1', [5, 1.35, 3], [4, 2.7, 5]);
    // Clicking the exact center of the zone → relative coords [0, 0, 0]
    const result = clickToZoneCoords([5, 1.35, 3], t);
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(0);
    expect(result[2]).toBeCloseTo(0);
  });

  it('returns correct zone-relative coords when hit is offset from center', () => {
    // Zone at (10, 1.35, 8), scale (6, 2.7, 4).
    // Hit at (11, 0, 9) → relative = (1, -1.35, 1).
    const t = makeTransform('z2', [10, 1.35, 8], [6, 2.7, 4]);
    const result = clickToZoneCoords([11, 0, 9], t);
    expect(result[0]).toBeCloseTo(1);
    expect(result[2]).toBeCloseTo(1);
  });

  it('handles a zone not at the world origin', () => {
    // Zone at (20, 1.35, 15), scale (10, 2.7, 8).
    // Hit at (20, 0, 15) (center of footprint at ground) → relative [0, -1.35, 0]
    const t = makeTransform('z3', [20, 1.35, 15], [10, 2.7, 8]);
    const result = clickToZoneCoords([20, 0, 15], t);
    expect(result[0]).toBeCloseTo(0);
    expect(result[2]).toBeCloseTo(0);
  });

  it('returns a 3-tuple', () => {
    const t = makeTransform('z4', [0, 0, 0], [1, 1, 1]);
    const result = clickToZoneCoords([0, 0, 0], t);
    expect(result).toHaveLength(3);
  });
});

// ── withinZoneBounds ─────────────────────────────────────────────────────────

describe('withinZoneBounds', () => {
  it('returns true for a point at the zone center (relative [0,0,0])', () => {
    const t = makeTransform('z1', [5, 1.35, 3], [4, 2.7, 5]);
    expect(withinZoneBounds([0, 0, 0], t)).toBe(true);
  });

  it('returns true for a point on the inner edge (within half-extents)', () => {
    // Zone scale [4, 2.7, 5] → half-extents x=2, z=2.5. Point at (1.9, 0, 2.4) is inside.
    const t = makeTransform('z1', [5, 1.35, 3], [4, 2.7, 5]);
    expect(withinZoneBounds([1.9, 0, 2.4], t)).toBe(true);
  });

  it('returns false for a point outside the zone footprint on X axis', () => {
    // Half-extent x = 2. Point at x = 2.1 is outside.
    const t = makeTransform('z1', [5, 1.35, 3], [4, 2.7, 5]);
    expect(withinZoneBounds([2.1, 0, 0], t)).toBe(false);
  });

  it('returns false for a point outside the zone footprint on Z axis', () => {
    // Half-extent z = 2.5. Point at z = 2.6 is outside.
    const t = makeTransform('z1', [5, 1.35, 3], [4, 2.7, 5]);
    expect(withinZoneBounds([0, 0, 2.6], t)).toBe(false);
  });

  it('returns true for a point exactly on the edge (inclusive boundary)', () => {
    // Half-extent x = 2. Point at x = 2.0 is on edge → inside.
    const t = makeTransform('z1', [5, 1.35, 3], [4, 2.7, 5]);
    expect(withinZoneBounds([2.0, 0, 0], t)).toBe(true);
  });

  it('returns false for a point in a corner outside the zone', () => {
    const t = makeTransform('z1', [5, 1.35, 3], [4, 2.7, 5]);
    expect(withinZoneBounds([3, 0, 3], t)).toBe(false);
  });
});
