import { createHmac, createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  handleMidtransWebhook,
  handleStripeWebhook,
  type PaymentWebhookDeps,
} from '../../src/server/payment-webhooks';

function deps(): PaymentWebhookDeps {
  return {
    getPaymentByProviderRef: vi.fn().mockResolvedValue(null),
    grantExportCredits: vi.fn().mockResolvedValue({ id: 'ent-1' }),
    grantUnlimited: vi.fn().mockResolvedValue({ id: 'ent-2' }),
  };
}

function stripeSignature(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const digest = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

describe('handleStripeWebhook', () => {
  it('rejects a missing Stripe webhook secret', async () => {
    await expect(
      handleStripeWebhook({
        rawBody: '{}',
        signature: 't=1,v1=bad',
        secret: '',
        deps: deps(),
      }),
    ).rejects.toThrow('Stripe webhook secret is not configured.');
  });

  it('rejects an old Stripe webhook timestamp', async () => {
    const rawBody = JSON.stringify({ id: 'evt_1', type: 'customer.created' });

    await expect(
      handleStripeWebhook({
        rawBody,
        signature: stripeSignature(rawBody, 'whsec_test', 1),
        secret: 'whsec_test',
        deps: deps(),
      }),
    ).rejects.toThrow('Stripe webhook timestamp is outside tolerance.');
  });

  it('grants export credits from a signed checkout completion event', async () => {
    const rawBody = JSON.stringify({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          amount_total: 25_000_00,
          metadata: {
            userId: 'user-1',
            entitlementType: 'export_credit',
            credits: '5',
            durationDays: '30',
          },
        },
      },
    });
    const mockDeps = deps();

    const result = await handleStripeWebhook({
      rawBody,
      signature: stripeSignature(rawBody, 'whsec_test'),
      secret: 'whsec_test',
      deps: mockDeps,
    });

    expect(result).toEqual({ ok: true, action: 'granted' });
    expect(mockDeps.grantExportCredits).toHaveBeenCalledWith({
      userId: 'user-1',
      credits: 5,
      source: 'stripe:checkout.session.completed',
      durationDays: 30,
      payment: {
        provider: 'stripe',
        providerRef: 'cs_1',
        amountIdr: 25_000,
      },
    });
  });

  it('skips duplicate Stripe provider refs', async () => {
    const rawBody = JSON.stringify({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', metadata: { userId: 'user-1' } } },
    });
    const mockDeps = deps();
    vi.mocked(mockDeps.getPaymentByProviderRef).mockResolvedValue({
      id: 'pay-1',
      userId: 'user-1',
      provider: 'stripe',
      providerRef: 'cs_1',
      amountIdr: 25_000,
      status: 'succeeded',
      entitlementId: 'ent-1',
      createdAt: new Date(),
    });

    const result = await handleStripeWebhook({
      rawBody,
      signature: stripeSignature(rawBody, 'whsec_test'),
      secret: 'whsec_test',
      deps: mockDeps,
    });

    expect(result).toEqual({ ok: true, action: 'duplicate' });
    expect(mockDeps.grantExportCredits).not.toHaveBeenCalled();
    expect(mockDeps.grantUnlimited).not.toHaveBeenCalled();
  });

  it('uses payment_intent as the canonical Stripe provider ref when present', async () => {
    const rawBody = JSON.stringify({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          payment_intent: 'pi_1',
          metadata: { userId: 'user-1', entitlementType: 'export_credit' },
        },
      },
    });
    const mockDeps = deps();

    await handleStripeWebhook({
      rawBody,
      signature: stripeSignature(rawBody, 'whsec_test'),
      secret: 'whsec_test',
      deps: mockDeps,
    });

    expect(mockDeps.getPaymentByProviderRef).toHaveBeenCalledWith('stripe', 'pi_1');
    expect(mockDeps.grantExportCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: expect.objectContaining({ providerRef: 'pi_1' }),
      }),
    );
  });

  it('rejects an unsupported entitlement type', async () => {
    const rawBody = JSON.stringify({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          metadata: { userId: 'user-1', entitlementType: 'vip' },
        },
      },
    });

    await expect(
      handleStripeWebhook({
        rawBody,
        signature: stripeSignature(rawBody, 'whsec_test'),
        secret: 'whsec_test',
        deps: deps(),
      }),
    ).rejects.toThrow('Unsupported entitlement type.');
  });

  it('treats duplicate grant errors as duplicate webhooks', async () => {
    const rawBody = JSON.stringify({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          metadata: { userId: 'user-1', entitlementType: 'export_credit' },
        },
      },
    });
    const mockDeps = deps();
    vi.mocked(mockDeps.grantExportCredits).mockRejectedValue({ code: 'P2002' });

    await expect(
      handleStripeWebhook({
        rawBody,
        signature: stripeSignature(rawBody, 'whsec_test'),
        secret: 'whsec_test',
        deps: mockDeps,
      }),
    ).resolves.toEqual({ ok: true, action: 'duplicate' });
  });

  it('rejects an invalid Stripe signature', async () => {
    await expect(
      handleStripeWebhook({
        rawBody: '{}',
        signature: `t=${Math.floor(Date.now() / 1000)},v1=bad`,
        secret: 'whsec_test',
        deps: deps(),
      }),
    ).rejects.toThrow('Invalid Stripe webhook signature.');
  });
});

describe('handleMidtransWebhook', () => {
  it('rejects a missing Midtrans server key', async () => {
    await expect(
      handleMidtransWebhook({ rawBody: '{}', serverKey: '', deps: deps() }),
    ).rejects.toThrow('Midtrans server key is not configured.');
  });

  it('grants unlimited access from a signed settlement notification', async () => {
    const rawBody = JSON.stringify({
      order_id: 'order-1',
      transaction_status: 'settlement',
      status_code: '200',
      gross_amount: '99000.00',
      custom_field1: 'user-1',
      custom_field2: 'unlimited_monthly',
      custom_field3: '30',
      signature_key: createHash('sha512')
        .update('order-1' + '200' + '99000.00' + 'server-key')
        .digest('hex'),
    });
    const mockDeps = deps();

    const result = await handleMidtransWebhook({
      rawBody,
      serverKey: 'server-key',
      deps: mockDeps,
    });

    expect(result).toEqual({ ok: true, action: 'granted' });
    expect(mockDeps.grantUnlimited).toHaveBeenCalledWith({
      userId: 'user-1',
      source: 'midtrans:settlement',
      durationDays: 30,
      payment: {
        provider: 'midtrans',
        providerRef: 'order-1',
        amountIdr: 99_000,
      },
    });
  });
});
