import { route, str } from '@/lib/api';
export const dynamic = 'force-dynamic';

export const GET = route(({ userId, req, store }) => ({ notes: store.listNotes(userId, new URL(req.url).searchParams.get('q') || undefined) }));
export const POST = route(({ userId, body, store }) => ({ note: store.createNote(userId, str(body.text)) }));
