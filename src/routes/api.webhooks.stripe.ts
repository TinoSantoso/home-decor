import { createFileRoute } from '@tanstack/react-router';
import { handleStripeWebhook } from '../server/payment-webhooks';

export const Route = createFileRoute('/api/webhooks/stripe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const result = await handleStripeWebhook({
            rawBody: await request.text(),
            signature: request.headers.get('stripe-signature') ?? '',
            secret: process.env['STRIPE_WEBHOOK_SECRET'] ?? '',
          });
          return Response.json(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Webhook failed.';
          const status = message.includes('signature')
            ? 401
            : message.includes('configured')
              ? 500
              : 400;
          return Response.json({ ok: false, error: message }, { status });
        }
      },
    },
  },
});
