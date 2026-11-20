import { route } from '@/lib/api';
export const dynamic = 'force-dynamic';

export const GET = route(({ userId, store }) => ({ prefs: store.prefsFor(userId) }));
export const PUT = route(({ userId, body, store }) => {
  const patch: { timezone?: string; show_title?: boolean } = {};
  if (typeof body.timezone === 'string') {
    try { new Intl.DateTimeFormat('en', { timeZone: body.timezone }); } catch { throw new RangeError('Invalid time zone'); }
    patch.timezone = body.timezone;
  }
  if (typeof body.show_title === 'boolean') patch.show_title = body.show_title;
  store.setPrefs(userId, patch);
  return { prefs: store.prefsFor(userId) };
});
