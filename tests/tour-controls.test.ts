import { describe, expect, it } from 'vitest';
import { DEFAULT_WALK_SPEED_MS, keysToVelocity } from '../src/lib/tour-controls';

/**
 * Node-env tests for the pure WASD keyboard-to-velocity helper.
 * No React, no DOM, no R3F — just math.
 */

describe('keysToVelocity', () => {
  it('returns a zero vector when no keys are held', () => {
    const v = keysToVelocity({}, 1, DEFAULT_WALK_SPEED_MS);
    expect(v).toEqual([0, 0, 0]);
  });

  it('moves forward (-Z) when W is held', () => {
    const v = keysToVelocity({ KeyW: true }, 1, DEFAULT_WALK_SPEED_MS);
    expect(v[2]).toBeLessThan(0);
    expect(v[0]).toBe(0);
    expect(v[1]).toBe(0);
  });

  it('moves backward (+Z) when S is held', () => {
    const v = keysToVelocity({ KeyS: true }, 1, DEFAULT_WALK_SPEED_MS);
    expect(v[2]).toBeGreaterThan(0);
  });

  it('strafes left (-X) when A is held', () => {
    const v = keysToVelocity({ KeyA: true }, 1, DEFAULT_WALK_SPEED_MS);
    expect(v[0]).toBeLessThan(0);
    expect(v[2]).toBe(0);
  });

  it('strafes right (+X) when D is held', () => {
    const v = keysToVelocity({ KeyD: true }, 1, DEFAULT_WALK_SPEED_MS);
    expect(v[0]).toBeGreaterThan(0);
  });

  it('scales the velocity by deltaSec and speed', () => {
    const v = keysToVelocity({ KeyW: true }, 0.5, 4);
    // forward = -1 normalized, * 0.5 * 4 = -2
    expect(v[2]).toBeCloseTo(-2, 5);
  });

  it('diagonal movement is not faster than axis-aligned movement (normalized input)', () => {
    const diagonal = keysToVelocity({ KeyW: true, KeyD: true }, 1, DEFAULT_WALK_SPEED_MS);
    const forward = keysToVelocity({ KeyW: true }, 1, DEFAULT_WALK_SPEED_MS);
    const diagonalMag = Math.hypot(diagonal[0], diagonal[1], diagonal[2]);
    const forwardMag = Math.hypot(forward[0], forward[1], forward[2]);
    // Both should have the same magnitude (input is normalized before scaling)
    expect(diagonalMag).toBeCloseTo(forwardMag, 5);
  });

  it('returns zero vector when opposite keys cancel out (W + S)', () => {
    const v = keysToVelocity({ KeyW: true, KeyS: true }, 1, DEFAULT_WALK_SPEED_MS);
    expect(v).toEqual([0, 0, 0]);
  });

  it('returns zero vector when opposite strafe keys cancel out (A + D)', () => {
    const v = keysToVelocity(
      { KeyA: true, KeyD: true, KeyW: false, KeyS: false },
      1 / 60,
      DEFAULT_WALK_SPEED_MS,
    );
    expect(v).toEqual([0, 0, 0]);
  });

  it('works correctly with zero deltaSec (no movement even with key held)', () => {
    const v = keysToVelocity({ KeyW: true }, 0, DEFAULT_WALK_SPEED_MS);
    expect(v).toEqual([0, 0, 0]);
  });

  it('ignores irrelevant keys in the map', () => {
    const v = keysToVelocity({ Space: true, KeyW: true }, 1, DEFAULT_WALK_SPEED_MS);
    // Same as just KeyW
    const wOnly = keysToVelocity({ KeyW: true }, 1, DEFAULT_WALK_SPEED_MS);
    expect(v).toEqual(wOnly);
  });
});
