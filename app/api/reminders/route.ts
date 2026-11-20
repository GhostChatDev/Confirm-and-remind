import { route, str } from '@/lib/api';
export const dynamic = 'force-dynamic';

export const POST = route(({ userId, body, store }) => {
  const at = new Date(str(body.remind_at, 40));
  if (Number.isNaN(at.getTime())) throw new RangeError('Invalid time');
  const tz = typeof body.tz === 'string' && body.tz ? body.tz : store.prefsFor(userId).timezone;
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { throw new RangeError('Invalid time zone'); }
  const r = store.createReminder(userId, str(body.task_id, 100), at.toISOString(), tz);
  // The server has stored it, so "Scheduled" may be shown now.
  return { ...r, label: store.statusLabel(r.occurrence) };
});
