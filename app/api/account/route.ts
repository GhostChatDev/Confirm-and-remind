import { route } from '@/lib/api';
export const dynamic = 'force-dynamic';
// DELETE /api/account removes every row the user owns. (With Supabase, deleting the auth user itself needs the service-role key in a deletion job: see README.)
export const DELETE = route(({ userId, store }) => { store.deleteAccount(userId); }, { limit: 5 });
