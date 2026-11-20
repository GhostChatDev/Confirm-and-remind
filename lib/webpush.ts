import webpush from 'web-push';
import type { PushSender } from './dispatch';

/** Real sender using VAPID keys from server env. Returns null when the keys are not configured. */
export function makeSender(): PushSender | null {
  const pub = process.env.WEB_PUSH_VAPID_PUBLIC_KEY, priv = process.env.WEB_PUSH_VAPID_PRIVATE_KEY, contact = process.env.WEB_PUSH_CONTACT;
  if (!pub || !priv || !contact) return null;
  webpush.setVapidDetails(contact, pub, priv);
  return async (sub, payload) => {
    try {
      const r = await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 3600 });
      return { ok: true, statusCode: r.statusCode };
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      return { ok: false, statusCode: code };
    }
  };
}
