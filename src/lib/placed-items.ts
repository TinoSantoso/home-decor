/**
 * Bridge between the in-store `PlacedItemRecord` (catalog references only)
 * and the cost engine's `PlacedItemInput` (full unit-price-by-tier objects).
 *
 * Kept in its own module so the editor + estimator can share it without
 * the cost engine importing the catalog directly.
 */

import type { Item } from './catalog';
import type { PlacedItemInput } from './cost-engine';
import type { PlacedItemRecord } from './db/types';

export function toPlacedItemInputs(
  records: PlacedItemRecord[],
  catalog: Item[],
): PlacedItemInput[] {
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const out: PlacedItemInput[] = [];
  for (const record of records) {
    const item = catalogById.get(record.itemId);
    if (!item) continue;
    out.push({
      itemId: item.id,
      category: item.category,
      quantity: record.quantity,
      unitPriceByTier: item.priceIdr,
      zoneId: record.zoneId,
    });
  }
  return out;
}
