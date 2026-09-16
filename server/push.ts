import express from 'express';
import webpush from 'web-push';
import { z } from 'zod';
import { pushRateLimiter, JSON_BODY_LIMIT } from './security';
import { getSupabaseAdmin } from './supabaseAdmin';
import { logSecurityEvent } from './log';

// Sends a real push notification (works with the tab/app closed) every
// time a row is inserted into public.notifications. Wired up via a
// Supabase Database Webhook — see SETUP.md section 6. Without the env
// vars below, this route stays disabled and the app keeps working with
// in-app notifications only (NotificationBell).

function vapidReady() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT
  );
}

// Supabase Database Webhook payload shape (https://supabase.com/docs/guides/database/webhooks).
const webhookBodySchema = z.object({
  type: z.literal('INSERT'),
  table: z.literal('notifications'),
  record: z.object({
    user_id: z.string().uuid(),
    title: z.string(),
    body: z.string().nullable().optional(),
    link: z.string().nullable().optional(),
  }),
});

export const pushRouter = express.Router();

pushRouter.post('/push/notify', pushRateLimiter, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const expectedSecret = process.env.PUSH_WEBHOOK_SECRET;
  if (!expectedSecret || req.header('x-push-secret') !== expectedSecret) {
    logSecurityEvent('webhook_unauthorized', req, { webhook: 'push' });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!vapidReady()) {
    return res.status(503).json({ error: 'Push no está configurado (faltan VAPID_* env vars).' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Push no está configurado (falta SUPABASE_SERVICE_ROLE_KEY).' });
  }

  const parsed = webhookBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.' });
  }
  const { record } = parsed.data;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const { data: subscriptions } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', record.user_id);

  if (!subscriptions || subscriptions.length === 0) {
    return res.json({ sent: 0 });
  }

  const payload = JSON.stringify({
    title: record.title,
    body: record.body ?? '',
    link: record.link ?? '/dashboard',
  });

  let sent = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent += 1;
      } catch (err: any) {
        // 404/410 means the browser dropped this subscription — clean it up.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.error('web-push send error:', err?.statusCode, err?.body);
        }
      }
    })
  );

  res.json({ sent });
});
