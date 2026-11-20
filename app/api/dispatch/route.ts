import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { globalStore } from '@/lib/store';
import { runDispatch } from '@/lib/dispatch';
import { makeSender } from '@/lib/webpush';
import { rateLimit } from '@/lib/ratelimit';
export const dynamic = 'force-dynamic';

/** Called by the scheduler (cron) with `Authorization: Bearer <CRON_SECRET>`. Not a user route. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET || '';
  const got = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  const a = Buffer.from(got), b = Buffer.from(secret);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!rateLimit('dispatch', 30)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const send = makeSender();
  if (!send) return NextResponse.json({ error: 'Push is not configured (VAPID keys missing)' }, { status: 503 });
  return NextResponse.json(await runDispatch(globalStore, send));
}
