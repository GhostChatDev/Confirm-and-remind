import { NextResponse } from 'next/server';
import { NotFoundError, globalStore, type Store } from './store';
import { rateLimit } from './ratelimit';

/**
 * Resolves the signed-in user id from the request.
 * - With SUPABASE_URL + SUPABASE_ANON_KEY set: verifies the bearer token with Supabase Auth.
 * - Otherwise (local mock only, never in production): "Bearer dev:<userId>" when ALLOW_DEV_AUTH=1.
 */
export async function authUser(req: Request): Promise<string | null> {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
  if (url && anon) {
    try {
      const r = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: anon }, cache: 'no-store' });
      if (!r.ok) return null;
      const u = (await r.json()) as { id?: string };
      return u.id || null;
    } catch { return null; }
  }
  if (process.env.ALLOW_DEV_AUTH === '1' && process.env.NODE_ENV !== 'production' && /^dev:[A-Za-z0-9_-]{1,64}$/.test(token)) return token.slice(4);
  return null;
}

type Ctx<P> = { params: Promise<P> };

/** Wraps a route: auth, rate limit (per user), JSON errors, no note content in logs. */
export function route<P = Record<string, never>>(fn: (a: { userId: string; req: Request; store: Store; params: P; body: Record<string, unknown> }) => Promise<unknown> | unknown, opts: { limit?: number } = {}) {
  return async (req: Request, ctx?: Ctx<P>) => {
    const userId = await authUser(req);
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    if (!rateLimit(`u:${userId}:${new URL(req.url).pathname}`, opts.limit ?? 60)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    let body: Record<string, unknown> = {};
    if (req.method !== 'GET' && req.method !== 'DELETE') {
      try { const j = await req.json(); if (j && typeof j === 'object') body = j as Record<string, unknown>; } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
    }
    try {
      const params = (ctx ? await ctx.params : {}) as P;
      const out = await fn({ userId, req, store: globalStore, params, body });
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof NotFoundError) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (e instanceof RangeError) return NextResponse.json({ error: e.message }, { status: 400 });
      console.error('api error', e instanceof Error ? e.name : 'unknown');
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  };
}

export const str = (v: unknown, max = 20000): string => {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new RangeError('Invalid text');
  return v;
};
