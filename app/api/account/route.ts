import { route } from '@/lib/api';
export const dynamic = 'force-dynamic';

export const DELETE = route(({ userId, store }) => { store.deleteAccount(userId); }, { limit: 3 });
