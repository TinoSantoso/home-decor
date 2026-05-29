import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  EntitlementRecord,
  PaymentRecord,
} from '../../src/lib/entitlements';
import {
  entitlementEndsAt,
  extendUnlimitedEndsAt,
  toEntitlementView,
} from '../../src/lib/entitlements';
import type { EntitlementDb } from '../../src/server/entitlements';
import { createEntitlementService } from '../../src/server/entitlements';

const now = new Date('2026-06-15T00:00:00.000Z');

function entitlement(
  overrides: Partial<EntitlementRecord> = {},
): EntitlementRecord {
  return {
    id: 'ent-1',
    userId: 'user-1',
    type: 'export_credit',
    source: 'test',
    exportsRemaining: 5,
    startsAt: new Date('2026-06-01T00:00:00.000Z'),
    endsAt: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

function payment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: 'pay-1',
    userId: 'user-1',
    provider: 'stripe',
    providerRef: 'pi_123',
    amountIdr: 49_000,
    status: 'succeeded',
    entitlementId: 'ent-1',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createDb(): EntitlementDb {
  return {
    entitlement: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    payment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(async (run) => run(db)) as NonNullable<
      EntitlementDb['$transaction']
    >,
  };
}

let db: EntitlementDb;

beforeEach(() => {
  db = createDb();
});

describe('entitlement helpers', () => {
  it('builds derived view fields from an entitlement record', () => {
    const view = toEntitlementView(
      entitlement({
        exportsRemaining: 0,
        endsAt: new Date('2026-06-20T00:00:00.000Z'),
      }),
      now,
    );

    expect(view.exhausted).toBe(true);
    expect(view.active).toBe(true);
    expect(view.daysRemaining).toBe(5);
  });

  it('returns null end date for lifetime entitlements', () => {
    expect(entitlementEndsAt(now, null)).toBeNull();
    expect(entitlementEndsAt(now)).toBeNull();
  });

  it('extends monthly unlimited from the current future end date', () => {
    const currentEndsAt = new Date('2026-06-30T00:00:00.000Z');
    expect(extendUnlimitedEndsAt(currentEndsAt, 30, now)).toEqual(
      new Date('2026-07-30T00:00:00.000Z'),
    );
  });
});

describe('createEntitlementService', () => {
  it('lists entitlement views for a user', async () => {
    vi.mocked(db.entitlement.findMany).mockResolvedValue([
      entitlement({ id: 'ent-2', exportsRemaining: 0 }),
    ]);

    const service = createEntitlementService(db, { now: () => now });
    const result = await service.listEntitlements('user-1');

    expect(db.entitlement.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result[0]?.id).toBe('ent-2');
    expect(result[0]?.exhausted).toBe(true);
  });

  it('grants export credits with a nested succeeded payment', async () => {
    vi.mocked(db.entitlement.create).mockResolvedValue(
      entitlement({ endsAt: new Date('2026-07-15T00:00:00.000Z') }),
    );

    const service = createEntitlementService(db, { now: () => now });
    await service.grantExportCredits({
      userId: 'user-1',
      credits: 3,
      source: 'checkout',
      durationDays: 30,
      payment: {
        provider: 'midtrans',
        providerRef: 'order-1',
        amountIdr: 25_000,
      },
    });

    expect(db.entitlement.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'export_credit',
        source: 'checkout',
        exportsRemaining: 3,
        startsAt: now,
        endsAt: new Date('2026-07-15T00:00:00.000Z'),
        payments: {
          create: {
            userId: 'user-1',
            provider: 'midtrans',
            providerRef: 'order-1',
            amountIdr: 25_000,
            status: 'succeeded',
          },
        },
      },
    });
  });

  it('rejects non-positive export credits before touching the database', async () => {
    const service = createEntitlementService(db, { now: () => now });

    await expect(
      service.grantExportCredits({
        userId: 'user-1',
        credits: 0,
        source: 'test',
      }),
    ).rejects.toThrow('credits must be a positive integer.');
    expect(db.entitlement.create).not.toHaveBeenCalled();
  });

  it('extends active unlimited entitlement and records payment in a transaction', async () => {
    vi.mocked(db.entitlement.findFirst).mockResolvedValue(
      entitlement({
        id: 'ent-unlimited',
        type: 'unlimited_monthly',
        exportsRemaining: null,
        endsAt: new Date('2026-06-30T00:00:00.000Z'),
      }),
    );
    vi.mocked(db.entitlement.update).mockResolvedValue(
      entitlement({
        id: 'ent-unlimited',
        type: 'unlimited_monthly',
        exportsRemaining: null,
        endsAt: new Date('2026-07-30T00:00:00.000Z'),
      }),
    );
    vi.mocked(db.payment.create).mockResolvedValue(payment());

    const service = createEntitlementService(db, { now: () => now });
    const result = await service.grantUnlimited({
      userId: 'user-1',
      source: 'monthly',
      durationDays: 30,
      payment: {
        provider: 'stripe',
        providerRef: 'sub_123',
        amountIdr: 99_000,
      },
    });

    expect(db.$transaction).toHaveBeenCalled();
    expect(db.entitlement.update).toHaveBeenCalledWith({
      where: { id: 'ent-unlimited' },
      data: {
        source: 'monthly',
        endsAt: new Date('2026-07-30T00:00:00.000Z'),
      },
    });
    expect(db.payment.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        provider: 'stripe',
        providerRef: 'sub_123',
        amountIdr: 99_000,
        status: 'succeeded',
        entitlementId: 'ent-unlimited',
      },
    });
    expect(result.endsAt).toEqual(new Date('2026-07-30T00:00:00.000Z'));
  });

  it('creates unlimited entitlement when no active one exists', async () => {
    vi.mocked(db.entitlement.findFirst).mockResolvedValue(null);
    vi.mocked(db.entitlement.create).mockResolvedValue(
      entitlement({
        type: 'unlimited_monthly',
        exportsRemaining: null,
        endsAt: new Date('2026-07-15T00:00:00.000Z'),
      }),
    );

    const service = createEntitlementService(db, { now: () => now });
    await service.grantUnlimited({
      userId: 'user-1',
      source: 'monthly',
      durationDays: 30,
    });

    expect(db.entitlement.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'unlimited_monthly',
        source: 'monthly',
        exportsRemaining: null,
        startsAt: now,
        endsAt: new Date('2026-07-15T00:00:00.000Z'),
      },
    });
  });

  it('consumes one active export credit with an updateMany guard', async () => {
    vi.mocked(db.entitlement.findFirst)
      .mockResolvedValueOnce(
        entitlement({ id: 'ent-credit', exportsRemaining: 2 }),
      )
      .mockResolvedValueOnce(
        entitlement({ id: 'ent-credit', exportsRemaining: 1 }),
      );
    vi.mocked(db.entitlement.updateMany).mockResolvedValue({ count: 1 });

    const service = createEntitlementService(db, { now: () => now });
    const result = await service.consumeExportCredit('user-1');

    expect(db.entitlement.updateMany).toHaveBeenCalledWith({
      where: { id: 'ent-credit', exportsRemaining: { gt: 0 } },
      data: { exportsRemaining: { decrement: 1 } },
    });
    expect(result).toEqual({ success: true, exportsRemaining: 1 });
  });

  it('returns a failed consume result when no active credits exist', async () => {
    vi.mocked(db.entitlement.findFirst).mockResolvedValue(null);

    const service = createEntitlementService(db, { now: () => now });
    const result = await service.consumeExportCredit('user-1');

    expect(result).toEqual({
      success: false,
      exportsRemaining: 0,
      error: 'No active export credits found.',
    });
    expect(db.entitlement.updateMany).not.toHaveBeenCalled();
  });

  it('lists and scopes payments by user', async () => {
    vi.mocked(db.payment.findMany).mockResolvedValue([payment()]);
    vi.mocked(db.payment.findFirst).mockResolvedValue(payment({ id: 'pay-2' }));

    const service = createEntitlementService(db, { now: () => now });
    await expect(service.listPayments('user-1')).resolves.toHaveLength(1);
    await expect(
      service.getPaymentById('pay-2', 'user-1'),
    ).resolves.toMatchObject({
      id: 'pay-2',
    });

    expect(db.payment.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(db.payment.findFirst).toHaveBeenCalledWith({
      where: { id: 'pay-2', userId: 'user-1' },
    });
  });
});
