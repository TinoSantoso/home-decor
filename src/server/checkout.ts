import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { serverAuthMiddleware } from './auth-middleware';
import { requireUserId } from './projects';
import { ensureUser } from './users';

type CheckoutPlan = 'unlimited_monthly';

const checkoutInputSchema = z.object({
  plan: z.enum(['unlimited_monthly']),
});

export function buildCheckoutMetadata(userId: string, plan: CheckoutPlan) {
  return {
    userId,
    entitlementType: plan,
    durationDays: '30',
  };
}

export const createCheckoutFn = createServerFn({ method: 'POST' })
  .middleware([serverAuthMiddleware])
  .inputValidator(checkoutInputSchema)
  .handler(async ({ context, data }) => {
    const userId = requireUserId(context.session);
    await ensureUser({
      id: userId,
      ...(context.session?.user.email ? { email: context.session.user.email } : {}),
    });

    const secretKey = process.env['STRIPE_SECRET_KEY'] ?? '';
    if (!secretKey) throw new Error('Stripe secret key is not configured.');

    const priceId = process.env['STRIPE_UNLIMITED_PRICE_ID'] ?? '';
    if (!priceId) throw new Error('Stripe unlimited price id is not configured.');

    const appOrigin = process.env['APP_ORIGIN'] ?? 'http://localhost:3000';
    const metadata = buildCheckoutMetadata(userId, data.plan);
    const body = new URLSearchParams({
      mode: 'payment',
      success_url: `${appOrigin}/dashboard`,
      cancel_url: `${appOrigin}/dashboard`,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'metadata[userId]': metadata.userId,
      'metadata[entitlementType]': metadata.entitlementType,
      'metadata[durationDays]': metadata.durationDays,
    });

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const payload = (await response.json()) as { url?: string; error?: { message?: string } };
    if (!response.ok) {
      throw new Error(payload.error?.message ?? 'Checkout provider rejected the request.');
    }
    if (!payload.url) throw new Error('Checkout provider did not return a URL.');
    return { url: payload.url };
  });
