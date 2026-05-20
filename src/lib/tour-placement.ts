/**
 * Pure helpers for 3D item placement in the tour scene (Phase 2 slice 3).
 *
 * No React, drei, Three.js, or DOM globals — safe to test in Node.
 */

import type { ZoneTransform } from './tour-transform';

/**
 * Convert centimetres to metres.
 * Used to size item placeholder meshes from catalog `dimensions` (which are in cm).
 */
export function cmToMeters(cm: number): number {
  return cm / 100;
}

/**
 * Convert a world-space raycast hit point to zone-relative coordinates.
 * Zone-relative means [0,0,0] is the center of the zone's bounding box.
 *
 * @param hitPoint  World-space [x, y, z] from R3F's event.point.toArray()
 * @param transform Zone transform computed by `zoneToTransform`
 * @returns         [x, y, z] relative to zone center
 */
export function clickToZoneCoords(
  hitPoint: [number, number, number],
  transform: ZoneTransform,
): [number, number, number] {
  return [
    hitPoint[0] - transform.position[0],
    hitPoint[1] - transform.position[1],
    hitPoint[2] - transform.position[2],
  ];
}

/**
 * Check whether a zone-relative position falls within the zone's XZ footprint.
 * The check is inclusive (points on the edge are inside).
 *
 * @param pos       Zone-relative [x, y, z] (as returned by `clickToZoneCoords`)
 * @param transform Zone transform for half-extent computation
 */
export function withinZoneBounds(
  pos: [number, number, number],
  transform: ZoneTransform,
): boolean {
  const halfX = transform.scale[0] / 2;
  const halfZ = transform.scale[2] / 2;
  return Math.abs(pos[0]) <= halfX && Math.abs(pos[2]) <= halfZ;
}
