/**
 * Hex palette for 3D zone boxes — Three.js's `color` prop wants hex/RGB,
 * not oklch. Approximated from the oklch values used by the 2D editor in
 * `zones.ts` so the two views feel like the same project.
 *
 * Phase 2+ should refine: parse oklch at runtime once Three.js's CSS
 * Color 4 support is reliable across browsers we target.
 */

import type { ZoneType } from './zones';

export const TOUR_ZONE_COLORS_3D: Record<ZoneType, string> = {
  living_room: '#b8c5e8',
  bedroom:     '#d6bce5',
  kitchen:     '#e8d8a0',
  bathroom:    '#b8d8e0',
  dining:      '#e8c8a0',
  office:      '#c8b8e0',
  terrace:     '#b8d8c0',
  garden:      '#a8d0a8',
  carport:     '#d0d0d0',
  facade:      '#e8e0d0',
  balcony:     '#b8d8d0',
  backyard:    '#a8d8b0',
};

export const TOUR_GROUND_COLOR = '#f5f3ef';

/** Placeholder color for items before style palettes land in slice 4. */
export const ITEM_PLACEHOLDER_HEX = '#8a7d6a';
