import { route } from '@/lib/api';
export const dynamic = 'force-dynamic';

// PATCH /api/reminder?id=<occurrenceId>  body: { action: 'snooze', how } | { action: 'reschedule', remind_at }
export const PATCH = route(({ userId, id, body, store }) => {
  if (body.action === 'snooze') {
    const how = body.how;
    if (how !== '10m' && how !== '1h' && how !== 'tomorrow') throw new RangeError('Invalid snooze');
    const o = store.snooze(userId, id, how);
    return { occurrence: o, label: store.statusLabel(o) };
  }
  if (body.action === 'reschedule') {
    const at = new Date(String(body.remind_at));
    if (Number.isNaN(at.getTime())) throw new RangeError('Invalid time');
    const o = store.reschedule(userId, id, at.toISOString());
    return { occurrence: o, label: store.statusLabel(o) };
  }
  throw new RangeError('Unknown action');
});
