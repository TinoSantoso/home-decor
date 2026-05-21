import type { ThreeEvent } from '@react-three/fiber';
import { useFloorPlan } from '../../stores/floor-plan';
import type { ZoneTransform } from '../../lib/tour-transform';

/**
 * Returns a stable click handler for ZoneMesh components.
 *
 * Behaviour:
 *  - When placementMode is OFF: select the zone (existing slice 1/2 behaviour).
 *  - When placementMode is ON:  place the pending item at the raycast hit point
 *    and deactivate placement mode so a single click places exactly one item.
 *
 * The handler reads store state via getState() at call time so it never goes
 * stale between renders — safe to use as a stable function reference.
 */
export function useZoneClickHandler() {
  const selectZone = useFloorPlan((s) => s.selectZone);
  const placeItemAt = useFloorPlan((s) => s.placeItemAt);
  const setPlacementMode = useFloorPlan((s) => s.setPlacementMode);
  const setPendingPlacementItemId = useFloorPlan((s) => s.setPendingPlacementItemId);

  return function handleZoneClick(
    e: ThreeEvent<MouseEvent>,
    zoneId: string,
    _transform: ZoneTransform,
  ) {
    e.stopPropagation();

    const { placementMode, pendingPlacementItemId } = useFloorPlan.getState();

    if (placementMode && pendingPlacementItemId) {
      const worldHit = e.point.toArray() as [number, number, number];
      placeItemAt(zoneId, pendingPlacementItemId, worldHit);
      setPlacementMode(false);
      setPendingPlacementItemId(null);
    } else {
      selectZone(zoneId);
    }
  };
}
