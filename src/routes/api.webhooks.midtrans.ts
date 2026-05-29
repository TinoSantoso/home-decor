import { createFileRoute } from '@tanstack/react-router';
import { handleMidtransWebhook } from '../server/payment-webhooks';

export const Route = createFileRoute('/api/webhooks/midtrans')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const result = await handleMidtransWebhook({
            rawBody: await request.text(),
            serverKey: process.env['MIDTRANS_SERVER_KEY'] ?? '',
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
