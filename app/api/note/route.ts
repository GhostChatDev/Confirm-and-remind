import { route, str } from '@/lib/api';
export const dynamic = 'force-dynamic';

// /api/note?id=<noteId>
export const GET = route(({ userId, id, store }) => ({ note: store.getNote(userId, id), versions: store.noteVersions(userId, id) }));
export const PATCH = route(({ userId, id, body, store }) => ({
  note: store.updateNote(userId, id, {
    text: body.text === undefined ? undefined : str(body.text),
    pinned: typeof body.pinned === 'boolean' ? body.pinned : undefined,
  }),
}));
export const DELETE = route(({ userId, id, store }) => { store.deleteNote(userId, id); });
