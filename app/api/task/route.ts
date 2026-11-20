import { route } from '@/lib/api';
export const dynamic = 'force-dynamic';

// PATCH /api/task?id=<taskId>  body: { status: 'open' | 'done' | 'dismissed' }
export const PATCH = route(({ userId, id, body, store }) => {
  const s = body.status;
  if (s !== 'open' && s !== 'done' && s !== 'dismissed') throw new RangeError('Invalid status');
  return { task: store.setTaskStatus(userId, id, s) };
});
