import { describe, expect, it } from 'vitest';
import { expectedClimateTags, climateMatchScore } from '../src/lib/climate';

describe('expectedClimateTags', () => {
  it('returns the full five-tag set for tropical_indonesia', () => {
    const tags = expectedClimateTags('tropical_indonesia');
    expect(tags.has('tropical')).toBe(true);
    expect(tags.has('humid')).toBe(true);
    expect(tags.has('anti_mold')).toBe(true);
    expect(tags.has('monsoon')).toBe(true);
    expect(tags.has('uv_resistant')).toBe(true);
    expect(tags.size).toBe(5);
  });

  it('returns an empty set for an unknown zone (no throw)', () => {
    const tags = expectedClimateTags('unknown_zone');
    expect(tags.size).toBe(0);
  });
});

describe('climateMatchScore', () => {
  const tropical = expectedClimateTags('tropical_indonesia');
  const empty = expectedClimateTags('unknown_zone');

  it('returns a value > 0.5 for real overlap (tropical + humid against tropical_indonesia)', () => {
    // Formula: 0.5 + 0.5 * (overlap / expected.size)
    // 2 matches out of 5: 0.5 + 0.5 * 0.4 = 0.7
    const score = climateMatchScore(['tropical', 'humid'], tropical);
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeCloseTo(0.7, 5);
  });

  it('returns a smaller positive value for partial overlap (uv_resistant only)', () => {
    // 1 match out of 5: 0.5 + 0.5 * 0.2 = 0.6
    const full = climateMatchScore(['tropical', 'humid'], tropical);
    const partial = climateMatchScore(['uv_resistant'], tropical);
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(full);
    expect(partial).toBeCloseTo(0.6, 5);
  });

  it('returns 0.5 (neutral fallback) for item with no tags when expected is non-empty', () => {
    const score = climateMatchScore([], tropical);
    expect(score).toBe(0.5);
  });

  it('returns 0.6 (neutral fallback) when expected set is empty', () => {
    const score = climateMatchScore(['tropical'], empty);
    expect(score).toBe(0.6);
  });

  it('returns 0.6 for empty item tags when expected set is also empty', () => {
    expect(climateMatchScore([], empty)).toBe(0.6);
  });
});
