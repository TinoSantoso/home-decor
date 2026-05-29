import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentProvider, PaymentRecord } from '../lib/entitlements';
import {
  getPaymentByProviderRef,
  grantExportCredits,
  grantUnlimited,
  type GrantExportCreditsInput,
  type GrantUnlimitedInput,
} from './entitlements';
import { ensureUser, type AuthUserIdentity } from './users';

export interface PaymentWebhookDeps {
  getPaymentByProviderRef(
    provider: PaymentProvider,
    providerRef: string,
  ): Promise<PaymentRecord | null>;
  ensureUser?(user: AuthUserIdentity): Promise<unknown>;
  grantExportCredits(input: GrantExportCreditsInput): Promise<unknown>;
  grantUnlimited(input: GrantUnlimitedInput): Promise<unknown>;
}

export interface PaymentWebhookResult {
  ok: true;
  action: 'granted' | 'duplicate' | 'ignored';
}

const defaultDeps: PaymentWebhookDeps = {
  getPaymentByProviderRef,
  ensureUser,
  grantExportCredits,
  grantUnlimited,
};

function safeEqualHex(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing ${label}.`);
  }
  return value;
}

function optionalPositiveInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function amountFromStripeCents(value: unknown): number {
  const cents = Number(value ?? 0);
  return Number.isFinite(cents) ? Math.round(cents / 100) : 0;
}

function amountFromIdr(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

function metadataOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function verifyStripeSignature(rawBody: string, signature: string, secret: string): void {
  if (!secret) throw new Error('Stripe webhook secret is not configured.');
  const fields = Object.fromEntries(
    signature.split(',').map((part) => {
      const [key, ...rest] = part.split('=');
      return [key, rest.join('=')];
    }),
  );
  const timestamp = requireString(fields['t'], 'Stripe signature timestamp');
  const timestampSeconds = Number(timestamp);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(nowSeconds - timestampSeconds) > 5 * 60
  ) {
    throw new Error('Stripe webhook timestamp is outside tolerance.');
  }
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  if (!fields['v1'] || !safeEqualHex(fields['v1'], expected)) {
    throw new Error('Invalid Stripe webhook signature.');
  }
}

async function grantFromIntent({
  deps,
  provider,
  providerRef,
  source,
  userId,
  entitlementType,
  credits,
  durationDays,
  amountIdr,
}: {
  deps: PaymentWebhookDeps;
  provider: PaymentProvider;
  providerRef: string;
  source: string;
  userId: string;
  entitlementType: string;
  credits: number | null;
  durationDays: number | null;
  amountIdr: number;
}): Promise<PaymentWebhookResult> {
  const existing = await deps.getPaymentByProviderRef(provider, providerRef);
  if (existing) return { ok: true, action: 'duplicate' };

  if (entitlementType !== 'export_credit' && entitlementType !== 'unlimited_monthly') {
    throw new Error('Unsupported entitlement type.');
  }

  await deps.ensureUser?.({ id: userId });

  try {
    if (entitlementType === 'unlimited_monthly') {
      await deps.grantUnlimited({
        userId,
        source,
        ...(durationDays !== null ? { durationDays } : {}),
        payment: { provider, providerRef, amountIdr },
      });
      return { ok: true, action: 'granted' };
    }

    await deps.grantExportCredits({
      userId,
      credits: credits ?? 1,
      source,
      ...(durationDays !== null ? { durationDays } : {}),
      payment: { provider, providerRef, amountIdr },
    });
    return { ok: true, action: 'granted' };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return { ok: true, action: 'duplicate' };
    }
    throw error;
  }
}

export async function handleStripeWebhook({
  rawBody,
  signature,
  secret,
  deps = defaultDeps,
}: {
  rawBody: string;
  signature: string;
  secret: string;
  deps?: PaymentWebhookDeps;
}): Promise<PaymentWebhookResult> {
  verifyStripeSignature(rawBody, signature, secret);
  const event = JSON.parse(rawBody) as Record<string, unknown>;
  const type = requireString(event['type'], 'Stripe event type');

  if (type !== 'checkout.session.completed' && type !== 'payment_intent.succeeded') {
    return { ok: true, action: 'ignored' };
  }

  const data = metadataOf(event['data']);
  const object = metadataOf(data['object']);
  const metadata = metadataOf(object['metadata']);
  const providerRef = requireString(object['payment_intent'] ?? object['id'], 'Stripe object id');
  const userId = requireString(metadata['userId'], 'Stripe metadata.userId');
  const entitlementType = String(metadata['entitlementType'] ?? 'export_credit');

  return grantFromIntent({
    deps,
    provider: 'stripe',
    providerRef,
    source: `stripe:${type}`,
    userId,
    entitlementType,
    credits: optionalPositiveInt(metadata['credits']),
    durationDays: optionalPositiveInt(metadata['durationDays']),
    amountIdr: amountFromStripeCents(object['amount_total'] ?? object['amount_received']),
  });
}

function verifyMidtransSignature(payload: Record<string, unknown>, serverKey: string): void {
  if (!serverKey) throw new Error('Midtrans server key is not configured.');
  const orderId = requireString(payload['order_id'], 'Midtrans order_id');
  const statusCode = requireString(payload['status_code'], 'Midtrans status_code');
  const grossAmount = requireString(payload['gross_amount'], 'Midtrans gross_amount');
  const signatureKey = requireString(payload['signature_key'], 'Midtrans signature_key');
  const expected = createHash('sha512')
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest('hex');
  if (!safeEqualHex(signatureKey, expected)) {
    throw new Error('Invalid Midtrans webhook signature.');
  }
}

export async function handleMidtransWebhook({
  rawBody,
  serverKey,
  deps = defaultDeps,
}: {
  rawBody: string;
  serverKey: string;
  deps?: PaymentWebhookDeps;
}): Promise<PaymentWebhookResult> {
  const payload = JSON.parse(rawBody) as Record<string, unknown>;
  verifyMidtransSignature(payload, serverKey);
  const status = requireString(payload['transaction_status'], 'Midtrans transaction_status');

  if (status !== 'settlement' && status !== 'capture') {
    return { ok: true, action: 'ignored' };
  }

  const providerRef = requireString(payload['order_id'], 'Midtrans order_id');
  const userId = requireString(payload['custom_field1'], 'Midtrans custom_field1');
  const entitlementType = String(payload['custom_field2'] ?? 'export_credit');

  return grantFromIntent({
    deps,
    provider: 'midtrans',
    providerRef,
    source: `midtrans:${status}`,
    userId,
    entitlementType,
    credits: optionalPositiveInt(payload['custom_field3']),
    durationDays:
      entitlementType === 'unlimited_monthly'
        ? optionalPositiveInt(payload['custom_field3'])
        : optionalPositiveInt(payload['custom_field4']),
    amountIdr: amountFromIdr(payload['gross_amount']),
  });
}
