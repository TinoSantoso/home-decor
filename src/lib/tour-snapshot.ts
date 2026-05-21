/**
 * Phase 2 slice 5: snapshot type and derivation helper for the
 * Before/After wipe-slider compare view.
 *
 * Pure library — no React, Three.js, or DOM imports. The snapshot is a
 * plain data view of the subset of floor-plan state that the 3D tour
 * renders from. When BeforeAfterCompare mounts, it computes a "before"
 * snapshot once (zones preserved, items stripped, style nulled) and
 * passes it into a TourScene instance. The "after" side mounts a
 * regular TourScene with no snapshot prop, which keeps reading live
 * store data.
 *
 * `deriveBeforeSnapshot` does NOT mutate its input. The returned object
 * shares the zones array by reference — zones are immutable in the
 * store (updateZone returns a new array), so reference sharing is safe.
 */

import type { Zone } from './zones';
import type { StyleTag } from './catalog';
import type { PlacedItemRecord } from './db/types';

export interface TourSnapshot {
  zones: Zone[];
  placedItems: PlacedItemRecord[];
  styleTag: StyleTag | null;
  /** Selection is interactive-only — snapshot views always show no selection. */
  selectedZoneId: string | null;
}

/** Minimal shape of the floor-plan state needed to compute a before snapshot. */
interface SnapshotSource {
  zones: Zone[];
  placedItems: PlacedItemRecord[];
  styleTag: StyleTag | null;
}

/**
 * Build a "before" snapshot from the live floor-plan state:
 *   - zones: preserved
 *   - placedItems: empty array (the user's items aren't shown on the before side)
 *   - styleTag: null (default style on the before side)
 *   - selectedZoneId: null
 */
export function deriveBeforeSnapshot(state: SnapshotSource): TourSnapshot {
  return {
    zones: state.zones,
    placedItems: [],
    styleTag: null,
    selectedZoneId: null,
  };
}
