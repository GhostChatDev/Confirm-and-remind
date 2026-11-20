import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { globalStore } from '@/lib/store';
import { runDispatch } from '@/lib/dispatch';
import { makeSender } from '@/lib/webpush';
import { rateLimit } from '@/lib/ratelimit';
import { loadStore, saveStore } from '@/lib/persist';
export const dynamic = 'force-dynamic';

// Called by the scheduler (cron) with "Authorization: Bearer <CRON_SECRET>". Never called by browser timers.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET || '';
  const given = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  const a = Buffer.from(given), b = Buffer.from(secret);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!rateLimit('dispatch', 30)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const send = makeSender();
  if (!send) return NextResponse.json({ error: 'Push is not configured (VAPID keys missing)' }, { status: 503 });
  if (!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)) loadStore(globalStore);
  const result = await runDispatch(globalStore, send);
  if (!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)) saveStore(globalStore);
  return NextResponse.json(result);
}
