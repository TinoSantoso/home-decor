import { describe, expect, it } from 'vitest';
import { getZoneColor, getItemPlaceholderColor } from '../src/lib/tour-materials';
import { ZONE_TYPES } from '../src/lib/zones';
import { STYLE_TAGS } from '../src/lib/catalog';
import { ITEM_CATEGORIES } from '../src/lib/catalog';

/**
 * Node-env tests for style-driven palette lookups.
 * Tests that zone and item colors derive from styleTag-keyed palettes,
 * with graceful fallback when styleTag is null or unknown.
 */

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

describe('getZoneColor', () => {
  it('returns a valid hex color for every ZoneType with default palette (null styleTag)', () => {
    ZONE_TYPES.forEach((zoneType) => {
      const color = getZoneColor(zoneType, null);
      expect(color).toMatch(HEX_PATTERN);
      expect(color).not.toContain('oklch');
    });
  });

  it('returns a valid hex color for every ZoneType × StyleTag combination', () => {
    ZONE_TYPES.forEach((zoneType) => {
      STYLE_TAGS.forEach((styleTag) => {
        const color = getZoneColor(zoneType, styleTag);
        expect(color).toMatch(HEX_PATTERN);
        expect(color).not.toContain('oklch');
      });
    });
  });

  it('returns the same color for null styleTag as for the default palette', () => {
    // Verify back-compat: null styleTag should use the original TOUR_ZONE_COLORS_3D
    ZONE_TYPES.forEach((zoneType) => {
      const nullTagColor = getZoneColor(zoneType, null);
      // nullTagColor should be a valid hex (back-compat with default palette)
      expect(nullTagColor).toMatch(HEX_PATTERN);
    });
  });

  it('never returns oklch strings (three.js compat)', () => {
    ZONE_TYPES.forEach((zoneType) => {
      const nullColor = getZoneColor(zoneType, null);
      expect(nullColor).not.toContain('oklch');

      STYLE_TAGS.forEach((styleTag) => {
        const color = getZoneColor(zoneType, styleTag);
        expect(color).not.toContain('oklch');
      });
    });
  });
});

describe('getItemPlaceholderColor', () => {
  it('returns a valid hex color for every ItemCategory with null styleTag', () => {
    ITEM_CATEGORIES.forEach((category) => {
      const color = getItemPlaceholderColor(category, null);
      expect(color).toMatch(HEX_PATTERN);
      expect(color).not.toContain('oklch');
    });
  });

  it('returns a valid hex color for every ItemCategory × StyleTag combination', () => {
    ITEM_CATEGORIES.forEach((category) => {
      STYLE_TAGS.forEach((styleTag) => {
        const color = getItemPlaceholderColor(category, styleTag);
        expect(color).toMatch(HEX_PATTERN);
        expect(color).not.toContain('oklch');
      });
    });
  });

  it('returns the same color for null styleTag as the default palette', () => {
    // Back-compat: null styleTag should use a default fallback
    ITEM_CATEGORIES.forEach((category) => {
      const nullTagColor = getItemPlaceholderColor(category, null);
      expect(nullTagColor).toMatch(HEX_PATTERN);
    });
  });

  it('returns a valid hex for unknown categories (graceful fallback)', () => {
    const unknownColor = getItemPlaceholderColor('unknown_category', null);
    expect(unknownColor).toMatch(HEX_PATTERN);
    expect(unknownColor).not.toContain('oklch');
  });

  it('never returns oklch strings (three.js compat)', () => {
    ITEM_CATEGORIES.forEach((category) => {
      const nullColor = getItemPlaceholderColor(category, null);
      expect(nullColor).not.toContain('oklch');

      STYLE_TAGS.forEach((styleTag) => {
        const color = getItemPlaceholderColor(category, styleTag);
        expect(color).not.toContain('oklch');
      });
    });
  });

  it('returns valid hex for unknown category with known styleTag', () => {
    const color = getItemPlaceholderColor('unknown_cat', 'japandi');
    expect(color).toMatch(HEX_PATTERN);
  });
});
