/**
 * Phase 2 slice 5: tests for `deriveBeforeSnapshot`.
 *
 * The helper takes the live floor-plan state and returns a "before" snapshot
 * suitable for rendering in the Before/After wipe-slider compare view —
 * zones preserved, items stripped, style nulled, no selection.
 *
 * The function MUST be pure (no mutation of input).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { deriveBeforeSnapshot } from '../src/lib/tour-snapshot';
import { useFloorPlan, resetForTests } from '../src/stores/floor-plan';

beforeEach(() => {
  resetForTests();
});

describe('deriveBeforeSnapshot', () => {
  it('strips placedItems — returns an empty array even when the live state has items', () => {
    const zoneId = useFloorPlan.getState().addZone('living_room', 'Ruang Tamu');
    useFloorPlan.getState().placeItemAt(zoneId, 'sofa-01', [1, 0, 1]);
    useFloorPlan.getState().placeItemAt(zoneId, 'lamp-01', [2, 0, 2]);
    expect(useFloorPlan.getState().placedItems).toHaveLength(2);

    const snap = deriveBeforeSnapshot(useFloorPlan.getState());

    expect(snap.placedItems).toEqual([]);
  });

  it('nullifies styleTag — returns null even when the live state has a style set', () => {
    useFloorPlan.getState().setStyleTag('japandi');
    expect(useFloorPlan.getState().styleTag).toBe('japandi');

    const snap = deriveBeforeSnapshot(useFloorPlan.getState());

    expect(snap.styleTag).toBeNull();
  });

  it('preserves zones in the snapshot (deep equal to the live zones array)', () => {
    useFloorPlan.getState().addZone('living_room', 'Ruang Tamu');
    useFloorPlan.getState().addZone('kitchen', 'Dapur');

    const state = useFloorPlan.getState();
    const snap = deriveBeforeSnapshot(state);

    expect(snap.zones).toEqual(state.zones);
    expect(snap.zones).toHaveLength(2);
  });

  it('does NOT mutate the source state — placedItems remain intact after derive', () => {
    const zoneId = useFloorPlan.getState().addZone('bedroom', 'Kamar Utama');
    useFloorPlan.getState().placeItemAt(zoneId, 'bed-01', [0, 0, 0]);
    useFloorPlan.getState().setStyleTag('tropical_modern');

    const beforeItems = useFloorPlan.getState().placedItems;
    const beforeStyle = useFloorPlan.getState().styleTag;
    const beforeZones = useFloorPlan.getState().zones;

    deriveBeforeSnapshot(useFloorPlan.getState());

    expect(useFloorPlan.getState().placedItems).toBe(beforeItems);
    expect(useFloorPlan.getState().placedItems).toHaveLength(1);
    expect(useFloorPlan.getState().styleTag).toBe(beforeStyle);
    expect(useFloorPlan.getState().zones).toBe(beforeZones);
  });

  it('sets selectedZoneId to null in the snapshot even when a zone is selected', () => {
    const id = useFloorPlan.getState().addZone('office', 'Kerja');
    useFloorPlan.getState().selectZone(id);
    expect(useFloorPlan.getState().selectedZoneId).toBe(id);

    const snap = deriveBeforeSnapshot(useFloorPlan.getState());

    expect(snap.selectedZoneId).toBeNull();
  });

  it('produces equivalent snapshots across repeated invocations with the same state', () => {
    useFloorPlan.getState().addZone('living_room', 'Ruang Tamu');
    useFloorPlan.getState().setStyleTag('industrial');

    const a = deriveBeforeSnapshot(useFloorPlan.getState());
    const b = deriveBeforeSnapshot(useFloorPlan.getState());

    expect(a).toEqual(b);
    // Items always stripped, style always null.
    expect(a.placedItems).toEqual([]);
    expect(a.styleTag).toBeNull();
    expect(b.placedItems).toEqual([]);
    expect(b.styleTag).toBeNull();
  });
});
