/**
 * Locale-aware "X minutes ago" formatter using the native `Intl.RelativeTimeFormat`.
 * Replaces date-fns/formatDistanceToNow — no dependency, smaller bundle.
 */

type Unit = Intl.RelativeTimeFormatUnit;

const STEPS: Array<{ unit: Unit; ms: number }> = [
  { unit: 'year',   ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month',  ms:  30 * 24 * 60 * 60 * 1000 },
  { unit: 'week',   ms:   7 * 24 * 60 * 60 * 1000 },
  { unit: 'day',    ms:       24 * 60 * 60 * 1000 },
  { unit: 'hour',   ms:            60 * 60 * 1000 },
  { unit: 'minute', ms:                 60 * 1000 },
  { unit: 'second', ms:                      1000 },
];

const cache = new Map<string, Intl.RelativeTimeFormat>();

function getFormatter(locale: string): Intl.RelativeTimeFormat {
  const cached = cache.get(locale);
  if (cached) return cached;
  const fmt = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  cache.set(locale, fmt);
  return fmt;
}

export function formatRelativeFromNow(
  timestamp: number,
  locale: string,
  now: number = Date.now(),
): string {
  const diffMs = timestamp - now;
  const absMs = Math.abs(diffMs);

  for (const { unit, ms } of STEPS) {
    if (absMs >= ms || unit === 'second') {
      const value = Math.round(diffMs / ms);
      return getFormatter(locale).format(value, unit);
    }
  }
  return getFormatter(locale).format(0, 'second');
}
