/**
 * Climate-zone helper — plan §8 / Phase 3 slice 2.
 *
 * Maps a project's climateZone identifier to the set of ClimateTag values
 * that are expected / desirable for that zone, and provides a scoring helper
 * used by the recommendation engine.
 *
 * tropical_indonesia covers all five available tags because Indonesia
 * experiences tropical heat, high humidity, heavy monsoon rainfall, intense
 * UV, and pervasive mold — all five ClimateTag concerns apply.
 */

import type { ClimateTag } from './catalog';

/** Extensible zone identifier. Currently only 'tropical_indonesia' is defined. */
export type ClimateZone = 'tropical_indonesia' | string;

const ZONE_TAG_MAP = new Map<string, ReadonlySet<ClimateTag>>([
  [
    'tropical_indonesia',
    new Set<ClimateTag>(['tropical', 'humid', 'anti_mold', 'monsoon', 'uv_resistant']),
  ],
]);

/**
 * Returns the set of ClimateTag values expected/relevant for the given
 * climateZone. Unknown zones return an empty set (no throw).
 */
export function expectedClimateTags(climateZone: ClimateZone): ReadonlySet<ClimateTag> {
  return ZONE_TAG_MAP.get(climateZone) ?? new Set<ClimateTag>();
}

/**
 * Scores how well an item's climate tags match the expected set for a zone.
 *
 * Score is in range [0, 1]:
 * - Empty expected set (unknown zone) → 0.6  (neutral, don't penalise)
 * - Item has no tags → 0.5  (neutral/unknown, slight penalisation vs actual match)
 * - Otherwise: 0.5 + 0.5 * (overlap / expected.size), capped at 1
 *   This ensures any real overlap always scores above the no-tags neutral (0.5),
 *   and a perfect match scores 1.0.
 */
export function climateMatchScore(
  itemTags: readonly ClimateTag[],
  expected: ReadonlySet<ClimateTag>,
): number {
  if (expected.size === 0) return 0.6;
  if (itemTags.length === 0) return 0.5;
  let overlap = 0;
  for (const tag of itemTags) {
    if (expected.has(tag)) overlap++;
  }
  return Math.min(1, 0.5 + 0.5 * (overlap / expected.size));
}
