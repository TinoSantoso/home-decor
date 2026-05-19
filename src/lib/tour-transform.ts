/**
 * Coordinate math for the 3D tour scene (Phase 2, plan §13 tour.tsx).
 *
 * The 2D floor plan editor stores zones as axis-aligned rectangles in
 * pixel space with a top-left origin. The 3D scene uses Three.js
 * right-handed Y-up world coordinates in meters with each zone centered
 * on its own footprint and lifted so the box sits on the y=0 ground plane.
 *
 * Mapping:
 *   px_x → meters along +X (world X axis)
 *   px_y → meters along +Z (world Z axis — "depth" in the scene)
 *   box height stays vertical (+Y)
 *
 * Pure functions, isomorphic — no Three.js imports here so the helpers
 * are cheap to test under Node without WebGL.
 */

import { pxToMeters, type Zone } from './zones';

export const DEFAULT_BOX_HEIGHT_M = 2.7;
export const TOUR_GROUND_PADDING_M = 4;

const MIN_GROUND_SIZE_M = 12;

export interface ZoneTransform {
  zoneId: string;
  /** [x, y, z] in meters — center of the box. */
  position: [number, number, number];
  /** [width, height, depth] in meters — full box extents. */
  scale: [number, number, number];
}

export function zoneToTransform(
  zone: Zone,
  boxHeightM: number = DEFAULT_BOX_HEIGHT_M,
): ZoneTransform {
  const widthM = pxToMeters(zone.width);
  const depthM = pxToMeters(zone.height);
  const xM = pxToMeters(zone.x);
  const zM = pxToMeters(zone.y);

  return {
    zoneId: zone.id,
    position: [xM + widthM / 2, boxHeightM / 2, zM + depthM / 2],
    scale: [widthM, boxHeightM, depthM],
  };
}

/**
 * Square ground-plane size that covers every zone's footprint plus
 * padding on all sides. Returns at least MIN_GROUND_SIZE_M so an empty
 * project still gets a sensibly-sized floor to look at.
 */
export function computeGroundSize(zones: Zone[]): number {
  if (zones.length === 0) {
    return Math.max(MIN_GROUND_SIZE_M, TOUR_GROUND_PADDING_M * 2);
  }
  let maxX = 0;
  let maxZ = 0;
  for (const zone of zones) {
    maxX = Math.max(maxX, pxToMeters(zone.x) + pxToMeters(zone.width));
    maxZ = Math.max(maxZ, pxToMeters(zone.y) + pxToMeters(zone.height));
  }
  return Math.max(maxX, maxZ) + TOUR_GROUND_PADDING_M * 2;
}
