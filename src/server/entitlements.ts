import type {
  EntitlementRecord,
  EntitlementView,
  PaymentRecord,
  PaymentProvider,
} from '../lib/entitlements';
import {
  entitlementEndsAt,
  extendUnlimitedEndsAt,
  toEntitlementView,
} from '../lib/entitlements';

/** Input for granting an export-credit entitlement. */
export interface GrantExportCreditsInput {
  userId: string;
  credits: number;
  source: string;
  durationDays?: number | null;
  payment?: {
    provider: PaymentProvider;
    providerRef: string;
    amountIdr: number;
  };
}

/** Input for granting an unlimited-monthly entitlement. */
export interface GrantUnlimitedInput {
  userId: string;
  source: string;
  durationDays?: number | null;
  payment?: {
    provider: PaymentProvider;
    providerRef: string;
    amountIdr: number;
  };
}

/** Result of a consumeExport attempt. */
export interface ConsumeResult {
  success: boolean;
  exportsRemaining: number;
  error?: string;
}

type QueryArgs = Record<string, unknown>;

interface EntitlementModel {
  findMany(args: QueryArgs): Promise<EntitlementRecord[]>;
  findFirst(args: QueryArgs): Promise<EntitlementRecord | null>;
  create(args: QueryArgs): Promise<EntitlementRecord>;
  update(args: QueryArgs): Promise<EntitlementRecord>;
  updateMany(args: QueryArgs): Promise<{ count: number }>;
}

interface PaymentModel {
  findMany(args: QueryArgs): Promise<PaymentRecord[]>;
  findFirst(args: QueryArgs): Promise<PaymentRecord | null>;
  create(args: QueryArgs): Promise<PaymentRecord>;
}

export interface EntitlementDb {
  entitlement: EntitlementModel;
  payment: PaymentModel;
  $transaction?<T>(fn: (tx: EntitlementDb) => Promise<T>): Promise<T>;
}

export interface EntitlementService {
  listEntitlements(userId: string): Promise<EntitlementView[]>;
  getEntitlementById(
    id: string,
    userId: string,
  ): Promise<EntitlementView | null>;
  hasActiveUnlimited(userId: string): Promise<boolean>;
  grantExportCredits(input: GrantExportCreditsInput): Promise<EntitlementView>;
  grantUnlimited(input: GrantUnlimitedInput): Promise<EntitlementView>;
  consumeExportCredit(userId: string): Promise<ConsumeResult>;
  listPayments(userId: string): Promise<PaymentRecord[]>;
  getPaymentById(id: string, userId: string): Promise<PaymentRecord | null>;
  getPaymentByProviderRef(
    provider: PaymentProvider,
    providerRef: string,
  ): Promise<PaymentRecord | null>;
}

interface ServiceOptions {
  now?: () => Date;
}

function activeWhere(
  userId: string,
  type: EntitlementRecord['type'],
  now: Date,
) {
  return {
    userId,
    type,
    startsAt: { lte: now },
    OR: [{ endsAt: null }, { endsAt: { gte: now } }],
  };
}

async function inTransaction<T>(
  db: EntitlementDb,
  run: (tx: EntitlementDb) => Promise<T>,
): Promise<T> {
  return db.$transaction ? db.$transaction(run) : run(db);
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

export function createEntitlementService(
  db: EntitlementDb,
  options: ServiceOptions = {},
): EntitlementService {
  const getNow = options.now ?? (() => new Date());

  return {
    async listEntitlements(userId) {
      const now = getNow();
      const rows = await db.entitlement.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((row) => toEntitlementView(row, now));
    },

    async getEntitlementById(id, userId) {
      const row = await db.entitlement.findFirst({ where: { id, userId } });
      return row ? toEntitlementView(row, getNow()) : null;
    },

    async hasActiveUnlimited(userId) {
      const row = await db.entitlement.findFirst({
        where: activeWhere(userId, 'unlimited_monthly', getNow()),
      });
      return row !== null;
    },

    async grantExportCredits(input) {
      assertPositiveInteger(input.credits, 'credits');

      const startsAt = getNow();
      const created = await db.entitlement.create({
        data: {
          userId: input.userId,
          type: 'export_credit',
          source: input.source,
          exportsRemaining: input.credits,
          startsAt,
          endsAt: entitlementEndsAt(startsAt, input.durationDays),
          ...(input.payment
            ? {
                payments: {
                  create: {
                    userId: input.userId,
                    provider: input.payment.provider,
                    providerRef: input.payment.providerRef,
                    amountIdr: input.payment.amountIdr,
                    status: 'succeeded',
                  },
                },
              }
            : {}),
        },
      });

      return toEntitlementView(created, startsAt);
    },

    async grantUnlimited(input) {
      return inTransaction(db, async (tx) => {
        const now = getNow();
        const existing = await tx.entitlement.findFirst({
          where: activeWhere(input.userId, 'unlimited_monthly', now),
          orderBy: { endsAt: 'desc' },
        });

        const entitlement = existing
          ? await tx.entitlement.update({
              where: { id: existing.id },
              data: {
                source: input.source,
                endsAt: extendUnlimitedEndsAt(
                  existing.endsAt,
                  input.durationDays,
                  now,
                ),
              },
            })
          : await tx.entitlement.create({
              data: {
                userId: input.userId,
                type: 'unlimited_monthly',
                source: input.source,
                exportsRemaining: null,
                startsAt: now,
                endsAt: entitlementEndsAt(now, input.durationDays),
              },
            });

        if (input.payment) {
          await tx.payment.create({
            data: {
              userId: input.userId,
              provider: input.payment.provider,
              providerRef: input.payment.providerRef,
              amountIdr: input.payment.amountIdr,
              status: 'succeeded',
              entitlementId: entitlement.id,
            },
          });
        }

        return toEntitlementView(entitlement, now);
      });
    },

    async consumeExportCredit(userId) {
      return inTransaction(db, async (tx) => {
        const entitlement = await tx.entitlement.findFirst({
          where: {
            ...activeWhere(userId, 'export_credit', getNow()),
            exportsRemaining: { gt: 0 },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (!entitlement) {
          return {
            success: false,
            exportsRemaining: 0,
            error: 'No active export credits found.',
          };
        }

        const updatedCount = await tx.entitlement.updateMany({
          where: { id: entitlement.id, exportsRemaining: { gt: 0 } },
          data: { exportsRemaining: { decrement: 1 } },
        });

        if (updatedCount.count !== 1) {
          return {
            success: false,
            exportsRemaining: 0,
            error: 'Export credits were already consumed.',
          };
        }

        const updated = await tx.entitlement.findFirst({
          where: { id: entitlement.id, userId },
        });

        return {
          success: true,
          exportsRemaining: updated?.exportsRemaining ?? 0,
        };
      });
    },

    listPayments(userId) {
      return db.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    },

    getPaymentById(id, userId) {
      return db.payment.findFirst({ where: { id, userId } });
    },

    getPaymentByProviderRef(provider, providerRef) {
      return db.payment.findFirst({ where: { provider, providerRef } });
    },
  };
}

async function getDefaultService(): Promise<EntitlementService> {
  const service = await import('./entitlements-service.server');
  return service.getEntitlementService();
}

export async function listEntitlements(userId: string): Promise<EntitlementView[]> {
  return (await getDefaultService()).listEntitlements(userId);
}

export async function getEntitlementById(
  id: string,
  userId: string,
): Promise<EntitlementView | null> {
  return (await getDefaultService()).getEntitlementById(id, userId);
}

export async function hasActiveUnlimited(userId: string): Promise<boolean> {
  return (await getDefaultService()).hasActiveUnlimited(userId);
}

export async function grantExportCredits(
  input: GrantExportCreditsInput,
): Promise<EntitlementView> {
  return (await getDefaultService()).grantExportCredits(input);
}

export async function grantUnlimited(
  input: GrantUnlimitedInput,
): Promise<EntitlementView> {
  return (await getDefaultService()).grantUnlimited(input);
}

export async function consumeExportCredit(userId: string): Promise<ConsumeResult> {
  return (await getDefaultService()).consumeExportCredit(userId);
}

export async function listPayments(userId: string): Promise<PaymentRecord[]> {
  return (await getDefaultService()).listPayments(userId);
}

export async function getPaymentById(
  id: string,
  userId: string,
): Promise<PaymentRecord | null> {
  return (await getDefaultService()).getPaymentById(id, userId);
}

export async function getPaymentByProviderRef(
  provider: PaymentProvider,
  providerRef: string,
): Promise<PaymentRecord | null> {
  return (await getDefaultService()).getPaymentByProviderRef(provider, providerRef);
}
