import { route, str } from '@/lib/api';
import { makeSender } from '@/lib/webpush';
export const dynamic = 'force-dynamic';

export const GET = route(({ userId, store }) => ({ devices: store.listSubscriptions(userId).map((s) => ({ id: s.id, label: s.label, active: s.active, created_at: s.created_at })) }));

export const POST = route(({ userId, body, store }) => {
  const endpoint = str(body.endpoint, 2000);
  if (!/^https:\/\//.test(endpoint)) throw new RangeError('Invalid endpoint');
  const s = store.addSubscription(userId, { endpoint, p256dh: str(body.p256dh, 500), auth: str(body.auth, 500), label: typeof body.label === 'string' ? body.label.slice(0, 80) : '' });
  return { device: { id: s.id, label: s.label, active: s.active } };
}, { limit: 20 });

export const PUT = route(async ({ userId, store }) => {
  const send = makeSender();
  if (!send) throw new RangeError('Push is not configured on the server (VAPID keys missing)');
  const subs = store.listSubscriptions(userId).filter((s) => s.active);
  let accepted = 0;
  for (const s of subs) if ((await send(s, { body: 'Test notification. Open Confirm & Remind.', url: '/', tag: 'test' })).ok) accepted++;
  return { devices: subs.length, accepted };
}, { limit: 5 });

export const DELETE = route(({ userId, req, store }) => { store.removeSubscription(userId, new URL(req.url).searchParams.get('id') || ''); });
