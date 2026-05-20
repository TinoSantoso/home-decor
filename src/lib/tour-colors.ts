/**
 * Hex palette for 3D zone boxes — Three.js's `color` prop wants hex/RGB,
 * not oklch. Approximated from the oklch values used by the 2D editor in
 * `zones.ts` so the two views feel like the same project.
 *
 * Phase 2+ should refine: parse oklch at runtime once Three.js's CSS
 * Color 4 support is reliable across browsers we target.
 */

import type { ZoneType } from './zones';
import type { StyleTag } from './catalog';

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

/**
 * Zone color palettes keyed by style tag.
 * The 'default' palette is TOUR_ZONE_COLORS_3D for back-compat.
 * Each style has a complete Record<ZoneType, string>.
 */
export type ZonePalette = Record<ZoneType, string>;

export const TOUR_PALETTES_BY_STYLE: Record<StyleTag | 'default', ZonePalette> = {
  default: TOUR_ZONE_COLORS_3D,
  japandi: {
    living_room: '#c9b8a0',
    bedroom:     '#d4c4b0',
    kitchen:     '#e8d8b8',
    bathroom:    '#d0c8b8',
    dining:      '#d8c8a8',
    office:      '#cfc0b0',
    terrace:     '#c8d0b8',
    garden:      '#b8c0a0',
    carport:     '#d0c0b0',
    facade:      '#e0d8c8',
    balcony:     '#d0c8b8',
    backyard:    '#c0b8a8',
  },
  tropical_modern: {
    living_room: '#a0d8c0',
    bedroom:     '#b0e0c8',
    kitchen:     '#d8e8a8',
    bathroom:    '#a8d8d8',
    dining:      '#d8d8a0',
    office:      '#b0d8b8',
    terrace:     '#a0d8b8',
    garden:      '#90d090',
    carport:     '#c0d8c0',
    facade:      '#d8e8c8',
    balcony:     '#a8d8c8',
    backyard:    '#a0d8a8',
  },
  minimalis_skandinavia: {
    living_room: '#d0d8e8',
    bedroom:     '#d8dce8',
    kitchen:     '#e8e8d0',
    bathroom:    '#d8e0e8',
    dining:      '#e0dcc8',
    office:      '#d8dce0',
    terrace:     '#d8e0d8',
    garden:      '#c8d8b8',
    carport:     '#d8d8d0',
    facade:      '#e8e8e0',
    balcony:     '#d8e0e0',
    backyard:    '#d0d8c8',
  },
  industrial: {
    living_room: '#a8a8a8',
    bedroom:     '#b0a8a0',
    kitchen:     '#d0c0a0',
    bathroom:    '#b0b8b8',
    dining:      '#c8b8a0',
    office:      '#b0a8a8',
    terrace:     '#a8b0a8',
    garden:      '#989080',
    carport:     '#9a9a9a',
    facade:      '#b8b0a0',
    balcony:     '#a8b0b0',
    backyard:    '#989a88',
  },
};

/**
 * Item color palettes keyed by style tag.
 * Each style has a 'default' fallback color for unknown categories.
 * All values are hex strings (oklch strings are NOT used — Three.js compat).
 *
 * Note: we use `Record<string, string>` rather than a narrower ItemCategory
 * key type to avoid a circular import (ItemCategory is defined in catalog.ts
 * which already imports tour-colors.ts indirectly).
 */
export type ItemPalette = Record<string, string>;

export const ITEM_PALETTES_BY_STYLE: Record<StyleTag | 'default', ItemPalette> = {
  default: {
    default: '#8a7d6a',
    furniture: '#9a8a78',
    lighting: '#a0908a',
    plant: '#7a8a68',
    accessory: '#8a8078',
    fixture: '#8a7a68',
  },
  japandi: {
    default: '#b8a898',
    furniture: '#c8a888',
    lighting: '#a8988a',
    plant: '#988a78',
    accessory: '#a89888',
    fixture: '#a89080',
  },
  tropical_modern: {
    default: '#78a88a',
    furniture: '#68b89a',
    lighting: '#88a8a8',
    plant: '#60a878',
    accessory: '#78a88a',
    fixture: '#80a890',
  },
  minimalis_skandinavia: {
    default: '#a0a0a0',
    furniture: '#b0b0a0',
    lighting: '#989890',
    plant: '#a0a888',
    accessory: '#a8a898',
    fixture: '#989088',
  },
  industrial: {
    default: '#6a6a6a',
    furniture: '#787070',
    lighting: '#68686a',
    plant: '#686060',
    accessory: '#707070',
    fixture: '#606060',
  },
};
