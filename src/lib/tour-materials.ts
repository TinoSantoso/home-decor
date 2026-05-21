/**
 * Style-driven palette lookups for 3D tour zones and items.
 * Pure functions returning hex colors keyed by zone type / item category
 * and style tag. Graceful fallback to default palette when styleTag is null.
 */

import type { ZoneType } from './zones';
import type { StyleTag } from './catalog';
import { TOUR_PALETTES_BY_STYLE, ITEM_PALETTES_BY_STYLE } from './tour-colors';

/**
 * Returns a hex color for a zone type, optionally keyed by style.
 * Falls back to default palette if styleTag is null or not found.
 *
 * @param zoneType Zone type (living_room, bedroom, etc.)
 * @param styleTag Style tag (japandi, tropical_modern, etc.) or null for default
 * @returns Hex color string matching /^#[0-9a-f]{6}$/i
 */
export function getZoneColor(zoneType: ZoneType, styleTag: StyleTag | null): string {
  const palette = styleTag && TOUR_PALETTES_BY_STYLE[styleTag]
    ? TOUR_PALETTES_BY_STYLE[styleTag]
    : TOUR_PALETTES_BY_STYLE['default'];

  return palette[zoneType] ?? '#cccccc'; // Safe fallback if somehow zoneType is missing
}

/**
 * Returns a hex color for an item category, optionally keyed by style.
 * Falls back to the style's default item color if category not found.
 * If styleTag is null or unknown, uses a universal fallback.
 *
 * @param category Item category (furniture, lighting, plant, accessory, fixture)
 * @param styleTag Style tag (japandi, tropical_modern, etc.) or null for default
 * @returns Hex color string matching /^#[0-9a-f]{6}$/i
 */
export function getItemPlaceholderColor(category: string, styleTag: StyleTag | null): string {
  const palette = styleTag && ITEM_PALETTES_BY_STYLE[styleTag]
    ? ITEM_PALETTES_BY_STYLE[styleTag]
    : ITEM_PALETTES_BY_STYLE['default'];

  return palette[category] ?? palette.default ?? '#8a7d6a'; // Fallback to the original ITEM_PLACEHOLDER_HEX
}
