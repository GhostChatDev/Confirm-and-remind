import { route } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const GET = route(({ userId, store }) => store.exportAll(userId));
