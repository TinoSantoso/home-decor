/**
 * First TDD-style test for the floor-plan store (plan §17).
 *
 * Demonstrates the red-green-refactor cycle for stores: each test calls
 * `resetForTests()` in `beforeEach` so state doesn't leak between cases.
 *
 * The behavior under test (`duplicateZone`) is brand-new — it didn't exist
 * before this test file. That's the discipline: the failing test was
 * committed first, then the action was added to make it green.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useFloorPlan, resetForTests } from '../../src/stores/floor-plan';

beforeEach(() => {
  resetForTests();
});

describe('floor-plan store: resetForTests', () => {
  it('returns the store to its initial state', () => {
    useFloorPlan.getState().addZone('living_room', 'Ruang Tamu');
    expect(useFloorPlan.getState().zones).toHaveLength(1);

    resetForTests();

    expect(useFloorPlan.getState().zones).toEqual([]);
    expect(useFloorPlan.getState().selectedZoneId).toBeNull();
    expect(useFloorPlan.getState().projectId).toBeNull();
    expect(useFloorPlan.getState().placedItems).toEqual([]);
  });
});

describe('floor-plan store: duplicateZone', () => {
  it('creates a new zone with the same dimensions and type as the source, offset by ~0.5 m', () => {
    const sourceId = useFloorPlan.getState().addZone('bedroom', 'Kamar Utama');
    // Set known dimensions so we can assert the duplicate inherits them.
    useFloorPlan.getState().updateZone(sourceId, {
      x: 100,
      y: 80,
      width: 100,
      height: 60,
    });

    const dupId = useFloorPlan.getState().duplicateZone(sourceId);

    expect(dupId).toBeTruthy();
    expect(dupId).not.toBe(sourceId);

    const zones = useFloorPlan.getState().zones;
    expect(zones).toHaveLength(2);

    const dup = zones.find((z) => z.id === dupId)!;
    expect(dup.type).toBe('bedroom');
    expect(dup.width).toBe(100);
    expect(dup.height).toBe(60);
    // Duplicate offset is half a meter (10 px @ 20 px/m).
    expect(dup.x).toBe(110);
    expect(dup.y).toBe(90);
  });

  it('appends "(salinan)" to the name of the duplicate when locale is id', () => {
    const sourceId = useFloorPlan.getState().addZone('kitchen', 'Dapur');
    const dupId = useFloorPlan.getState().duplicateZone(sourceId, 'id');
    const dup = useFloorPlan.getState().zones.find((z) => z.id === dupId)!;
    expect(dup.name).toBe('Dapur (salinan)');
  });

  it('appends "(copy)" to the name of the duplicate when locale is en', () => {
    const sourceId = useFloorPlan.getState().addZone('office', 'Office');
    const dupId = useFloorPlan.getState().duplicateZone(sourceId, 'en');
    const dup = useFloorPlan.getState().zones.find((z) => z.id === dupId)!;
    expect(dup.name).toBe('Office (copy)');
  });

  it('selects the new zone after duplication', () => {
    const sourceId = useFloorPlan.getState().addZone('living_room', 'Ruang Tamu');
    const dupId = useFloorPlan.getState().duplicateZone(sourceId);
    expect(useFloorPlan.getState().selectedZoneId).toBe(dupId);
  });

  it('returns null when the source zone does not exist', () => {
    expect(useFloorPlan.getState().duplicateZone('does-not-exist')).toBeNull();
    expect(useFloorPlan.getState().zones).toEqual([]);
  });
});
