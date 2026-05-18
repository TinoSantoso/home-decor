/**
 * Zone domain types — mirrors Prisma `ZoneType` enum.
 * Canvas coordinates use PIXELS_PER_METER for unit conversion.
 */

export const PIXELS_PER_METER = 20;
export const SNAP_GRID_METERS = 0.25;

export const ZONE_TYPES = [
  'living_room',
  'bedroom',
  'kitchen',
  'bathroom',
  'dining',
  'office',
  'terrace',
  'garden',
  'carport',
  'facade',
  'balcony',
  'backyard',
] as const;

export type ZoneType = (typeof ZONE_TYPES)[number];

export const INDOOR_ZONES: readonly ZoneType[] = [
  'living_room',
  'bedroom',
  'kitchen',
  'bathroom',
  'dining',
  'office',
];

export function isIndoor(type: ZoneType): boolean {
  return INDOOR_ZONES.includes(type);
}

export const ZONE_COLORS: Record<ZoneType, { fill: string; stroke: string }> = {
  living_room: { fill: 'oklch(92% 0.04 250 / 0.6)', stroke: 'oklch(55% 0.12 250)' },
  bedroom:     { fill: 'oklch(92% 0.04 320 / 0.6)', stroke: 'oklch(55% 0.12 320)' },
  kitchen:     { fill: 'oklch(94% 0.06 80  / 0.6)', stroke: 'oklch(60% 0.15 80)'  },
  bathroom:    { fill: 'oklch(94% 0.05 200 / 0.6)', stroke: 'oklch(60% 0.13 200)' },
  dining:      { fill: 'oklch(93% 0.05 60  / 0.6)', stroke: 'oklch(58% 0.13 60)'  },
  office:      { fill: 'oklch(93% 0.04 280 / 0.6)', stroke: 'oklch(55% 0.12 280)' },
  terrace:     { fill: 'oklch(93% 0.05 140 / 0.6)', stroke: 'oklch(55% 0.13 140)' },
  garden:      { fill: 'oklch(92% 0.07 145 / 0.6)', stroke: 'oklch(50% 0.16 145)' },
  carport:     { fill: 'oklch(90% 0.02 270 / 0.6)', stroke: 'oklch(45% 0.04 270)' },
  facade:      { fill: 'oklch(94% 0.02 95  / 0.6)', stroke: 'oklch(55% 0.04 95)'  },
  balcony:     { fill: 'oklch(93% 0.04 180 / 0.6)', stroke: 'oklch(55% 0.10 180)' },
  backyard:    { fill: 'oklch(92% 0.06 130 / 0.6)', stroke: 'oklch(50% 0.14 130)' },
};

export interface Zone {
  id: string;
  type: ZoneType;
  name: string;
  /** Stage X in pixels (top-left corner). */
  x: number;
  /** Stage Y in pixels (top-left corner). */
  y: number;
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
}

export function pxToMeters(px: number): number {
  return px / PIXELS_PER_METER;
}

export function metersToPx(m: number): number {
  return m * PIXELS_PER_METER;
}

export function snapPx(px: number): number {
  const stepPx = SNAP_GRID_METERS * PIXELS_PER_METER;
  return Math.round(px / stepPx) * stepPx;
}

export function zoneAreaM2(zone: Pick<Zone, 'width' | 'height'>): number {
  return pxToMeters(zone.width) * pxToMeters(zone.height);
}

export function zoneWidthM(zone: Pick<Zone, 'width'>): number {
  return pxToMeters(zone.width);
}

export function zoneLengthM(zone: Pick<Zone, 'height'>): number {
  return pxToMeters(zone.height);
}
