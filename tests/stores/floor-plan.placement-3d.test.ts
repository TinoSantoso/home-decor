import { describe, beforeEach, expect, it } from 'vitest';
import { useFloorPlan, resetForTests } from '../../src/stores/floor-plan';

/**
 * Node-env tests for the placement-3D slice added in Phase 2 slice 3.
 *
 * Covers:
 *   - placementMode default + setPlacementMode toggle
 *   - placeItemAt appends a PlacedItem with position3d
 *   - resetForTests clears placedItems and placementMode
 *   - Updates and removals still work with the extended shape
 *   - exactOptionalPropertyTypes: placing without position3d works
 */
describe('placementMode store slice', () => {
  beforeEach(() => {
    resetForTests();
  });

  it('defaults to false', () => {
    expect(useFloorPlan.getState().placementMode).toBe(false);
  });

  it('setPlacementMode sets it to true', () => {
    useFloorPlan.getState().setPlacementMode(true);
    expect(useFloorPlan.getState().placementMode).toBe(true);
  });

  it('setPlacementMode toggles back to false', () => {
    useFloorPlan.getState().setPlacementMode(true);
    useFloorPlan.getState().setPlacementMode(false);
    expect(useFloorPlan.getState().placementMode).toBe(false);
  });

  it('resetForTests resets placementMode to false', () => {
    useFloorPlan.getState().setPlacementMode(true);
    resetForTests();
    expect(useFloorPlan.getState().placementMode).toBe(false);
  });
});

describe('placeItemAt store action', () => {
  beforeEach(() => {
    resetForTests();
  });

  it('appends a PlacedItem with the given zoneId, itemId, and position3d', () => {
    const pos: [number, number, number] = [1.5, 0, 2.3];
    useFloorPlan.getState().placeItemAt('zone-1', 'sofa-modular-japandi', pos);

    const items = useFloorPlan.getState().placedItems;
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.zoneId).toBe('zone-1');
    expect(item.itemId).toBe('sofa-modular-japandi');
    expect(item.position3d).toEqual([1.5, 0, 2.3]);
  });

  it('returns the new placed item id (non-empty string)', () => {
    const id = useFloorPlan.getState().placeItemAt('zone-2', 'item-x', [0, 0, 0]);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('places multiple items into the same zone', () => {
    useFloorPlan.getState().placeItemAt('zone-1', 'item-a', [1, 0, 1]);
    useFloorPlan.getState().placeItemAt('zone-1', 'item-b', [2, 0, 2]);

    const items = useFloorPlan.getState().placedItems;
    expect(items).toHaveLength(2);
  });

  it('resetForTests clears placed items added via placeItemAt', () => {
    useFloorPlan.getState().placeItemAt('zone-1', 'item-a', [1, 0, 1]);
    resetForTests();
    expect(useFloorPlan.getState().placedItems).toHaveLength(0);
  });

  it('placed item can be updated via updatePlacedItem', () => {
    const id = useFloorPlan.getState().placeItemAt('zone-1', 'item-a', [1, 0, 1]);
    useFloorPlan.getState().updatePlacedItem(id, { notes: 'near wall' });
    const item = useFloorPlan.getState().placedItems.find((p) => p.id === id)!;
    expect(item.notes).toBe('near wall');
  });

  it('placed item can be removed via removePlacedItem', () => {
    const id = useFloorPlan.getState().placeItemAt('zone-1', 'item-a', [1, 0, 1]);
    useFloorPlan.getState().removePlacedItem(id);
    expect(useFloorPlan.getState().placedItems).toHaveLength(0);
  });

  it('placing without a position3d (via addPlacedItem) still works — no position3d field', () => {
    // addPlacedItem is the pre-existing action that never sets position3d.
    const id = useFloorPlan.getState().addPlacedItem('zone-3', 'item-c', 1);
    const item = useFloorPlan.getState().placedItems.find((p) => p.id === id)!;
    // exactOptionalPropertyTypes: the field should be absent, not explicitly undefined.
    expect(Object.prototype.hasOwnProperty.call(item, 'position3d')).toBe(false);
  });

  it('position3d is exactly a 3-tuple of numbers', () => {
    const pos: [number, number, number] = [3.14, 0, -1.0];
    useFloorPlan.getState().placeItemAt('zone-4', 'item-d', pos);
    const item = useFloorPlan.getState().placedItems[0]!;
    expect(item.position3d).toHaveLength(3);
    expect(item.position3d![0]).toBeCloseTo(3.14);
    expect(item.position3d![2]).toBeCloseTo(-1.0);
  });
});
