import { describe, expect, it } from 'vitest';
import { formatRelativeFromNow } from '../src/lib/relative-time';

const NOW = new Date('2026-05-18T12:00:00Z').getTime();

describe('formatRelativeFromNow', () => {
  it('formats minutes in Bahasa Indonesia', () => {
    const fiveMinutesAgo = NOW - 5 * 60 * 1000;
    const out = formatRelativeFromNow(fiveMinutesAgo, 'id', NOW);
    expect(out).toMatch(/menit/);
  });

  it('formats hours in English', () => {
    const threeHoursAgo = NOW - 3 * 60 * 60 * 1000;
    const out = formatRelativeFromNow(threeHoursAgo, 'en', NOW);
    expect(out).toMatch(/3 hours ago/);
  });

  it('handles "just now" via the seconds unit', () => {
    const out = formatRelativeFromNow(NOW - 500, 'en', NOW);
    expect(out.toLowerCase()).toMatch(/now|second/);
  });

  it('picks days for multi-day deltas', () => {
    const twoDaysAgo = NOW - 2 * 24 * 60 * 60 * 1000;
    const out = formatRelativeFromNow(twoDaysAgo, 'en', NOW);
    expect(out).toMatch(/2 days ago/);
  });
});
