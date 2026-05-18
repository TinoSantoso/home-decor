const cache = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string): Intl.NumberFormat {
  const cached = cache.get(locale);
  if (cached) return cached;
  const fmt = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  });
  cache.set(locale, fmt);
  return fmt;
}

export function formatIDR(amount: number, locale = 'id-ID'): string {
  return getFormatter(locale).format(Math.round(amount));
}
