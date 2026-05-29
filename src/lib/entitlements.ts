export type EntitlementType = 'export_credit' | 'unlimited_monthly';
export type PaymentProvider = 'stripe' | 'midtrans' | 'xendit';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface EntitlementRecord {
  id: string;
  userId: string;
  type: EntitlementType;
  source: string;
  exportsRemaining: number | null;
  startsAt: Date;
  endsAt: Date | null;
  createdAt: Date;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  provider: PaymentProvider;
  providerRef: string;
  amountIdr: number;
  status: PaymentStatus;
  entitlementId: string | null;
  createdAt: Date;
}

export interface EntitlementView extends EntitlementRecord {
  exhausted: boolean;
  active: boolean;
  daysRemaining: number | null;
}

const DAY_MS = 86_400_000;

export function entitlementEndsAt(
  startsAt: Date,
  durationDays?: number | null,
): Date | null {
  if (durationDays === undefined || durationDays === null) return null;
  return new Date(startsAt.getTime() + durationDays * DAY_MS);
}

export function extendUnlimitedEndsAt(
  currentEndsAt: Date | null,
  durationDays: number | null | undefined,
  now: Date,
): Date | null {
  if (durationDays === undefined || durationDays === null) return null;
  if (currentEndsAt === null) return null;

  const extensionBase = currentEndsAt > now ? currentEndsAt : now;
  return entitlementEndsAt(extensionBase, durationDays);
}

export function isEntitlementActive(
  entitlement: Pick<EntitlementRecord, 'startsAt' | 'endsAt'>,
  now = new Date(),
): boolean {
  return (
    entitlement.startsAt <= now &&
    (entitlement.endsAt === null || entitlement.endsAt >= now)
  );
}

export function toEntitlementView(
  entitlement: EntitlementRecord,
  now = new Date(),
): EntitlementView {
  const daysRemaining =
    entitlement.endsAt === null
      ? null
      : Math.ceil((entitlement.endsAt.getTime() - now.getTime()) / DAY_MS);

  return {
    ...entitlement,
    exhausted:
      entitlement.type === 'export_credit' &&
      (entitlement.exportsRemaining ?? 0) <= 0,
    active: isEntitlementActive(entitlement, now),
    daysRemaining,
  };
}
