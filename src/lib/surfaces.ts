/**
 * Derive cost-engine `SurfaceInput`s from the floor-plan zones.
 *
 * For each zone we generate two surfaces:
 *   - floor (category `flooring`)        area = w × h
 *   - paint (category `paint`)           area = walls + ceiling
 *
 * Wall area = perimeter × WALL_HEIGHT_M × OPENINGS_FACTOR (rough deduction
 * for doors/windows). Ceiling area = floor area.
 *
 * Default unit prices are coarse market rates and live here so they can
 * be swapped out for a partner price feed later without touching the engine.
 */

import type { Zone } from './zones';
import { pxToMeters, zoneAreaM2 } from './zones';
import type { BudgetTier, SurfaceInput } from './cost-engine';

export const DEFAULT_WALL_HEIGHT_M = 2.7;

const OPENINGS_FACTOR = 0.85;

export const DEFAULT_FLOOR_PRICES: Record<BudgetTier, number> = {
  hemat:     200_000,
  standar:   400_000,
  premium:   800_000,
  mewah:   1_500_000,
};

export const DEFAULT_PAINT_PRICES: Record<BudgetTier, number> = {
  hemat:     60_000,
  standar:  100_000,
  premium:  180_000,
  mewah:    320_000,
};

export function zonePerimeterM(zone: Pick<Zone, 'width' | 'height'>): number {
  return 2 * (pxToMeters(zone.width) + pxToMeters(zone.height));
}

export function zoneWallAreaM2(
  zone: Pick<Zone, 'width' | 'height'>,
  wallHeightM: number = DEFAULT_WALL_HEIGHT_M,
): number {
  return zonePerimeterM(zone) * wallHeightM * OPENINGS_FACTOR;
}

export function zoneCeilingAreaM2(zone: Pick<Zone, 'width' | 'height'>): number {
  return zoneAreaM2(zone);
}

export function deriveSurfacesFromZones(zones: Zone[]): SurfaceInput[] {
  const surfaces: SurfaceInput[] = [];
  for (const zone of zones) {
    const floorArea = zoneAreaM2(zone);
    const paintArea = zoneWallAreaM2(zone) + zoneCeilingAreaM2(zone);

    surfaces.push({
      surfaceId: `${zone.id}-floor`,
      category: 'flooring',
      areaM2: floorArea,
      unitPricePerM2ByTier: DEFAULT_FLOOR_PRICES,
      zoneId: zone.id,
    });

    surfaces.push({
      surfaceId: `${zone.id}-paint`,
      category: 'paint',
      areaM2: paintArea,
      unitPricePerM2ByTier: DEFAULT_PAINT_PRICES,
      zoneId: zone.id,
    });
  }
  return surfaces;
}
