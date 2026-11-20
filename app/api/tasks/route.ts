import { route, str } from '@/lib/api';
export const dynamic = 'force-dynamic';

export const GET = route(({ userId, store }) => ({
  tasks: store.listTasks(userId).map((t) => ({ ...t, occurrences: store.occurrencesFor(userId, t.id).map((o) => ({ ...o, label: store.statusLabel(o) })) })),
}));
export const POST = route(({ userId, body, store }) => ({
  task: store.createTask(userId, {
    title: str(body.title, 500),
    note_id: typeof body.note_id === 'string' ? body.note_id : null,
    due_at: typeof body.due_at === 'string' ? new Date(body.due_at).toISOString() : null,
  }),
}));
