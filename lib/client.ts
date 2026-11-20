// Browser-side helpers: server config, Supabase Auth over REST (no service-role key here), and the /api wrapper.
export type Config = { url: string; anonKey: string; vapidPublicKey: string };

const SESSION = 'cr-session';
const DEMO = 'cr-demo-user';
let config: Config | null = null;

type Session = { access_token: string; refresh_token: string; expires_at: number };

export async function loadConfig(): Promise<Config> {
  if (config) return config;
  const r = await fetch('/api/config', { cache: 'no-store' });
  if (!r.ok) throw new Error('Could not load configuration');
  config = (await r.json()) as Config;
  return config;
}

// Demo mode: the server has no Supabase project, so sign-in is not verified.
export function demoMode(): boolean {
  return !config || !config.url || !config.anonKey;
}

function readSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(SESSION) || 'null') as Session | null; } catch { return null; }
}

async function authCall(path: string, body: object): Promise<{ session?: Session; error?: string }> {
  const c = await loadConfig();
  try {
    const r = await fetch(`${c.url}/auth/v1/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: c.anonKey }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) return { error: String(j.msg || j.error_description || j.message || 'Sign-in failed') };
    if (typeof j.access_token !== 'string') return { error: 'Check your email to confirm the account, then sign in.' };
    const expiresIn = Number(j.expires_in) || 3600;
    return { session: { access_token: j.access_token, refresh_token: String(j.refresh_token || ''), expires_at: Date.now() + expiresIn * 1000 } };
  } catch {
    return { error: 'Could not reach the sign-in service.' };
  }
}

/** Returns an error message, or '' on success. */
export async function signIn(email: string, password: string, create: boolean): Promise<string> {
  const c = await loadConfig();
  if (!c.url || !c.anonKey) {
    const name = email.trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    localStorage.setItem(DEMO, name || 'demo');
    return '';
  }
  const res = await authCall(create ? 'signup' : 'token?grant_type=password', { email, password });
  if (!res.session) return res.error || 'Sign-in failed';
  localStorage.setItem(SESSION, JSON.stringify(res.session));
  return '';
}

export async function signOut(): Promise<void> {
  localStorage.removeItem(SESSION);
  localStorage.removeItem(DEMO);
}

/** The bearer token for /api, or '' when signed out. Refreshes an expiring Supabase session. */
export async function token(): Promise<string> {
  const c = await loadConfig();
  if (!c.url || !c.anonKey) {
    const n = localStorage.getItem(DEMO);
    return n ? `dev:${n}` : '';
  }
  const s = readSession();
  if (!s) return '';
  if (s.expires_at - Date.now() > 60_000) return s.access_token;
  const res = await authCall('token?grant_type=refresh_token', { refresh_token: s.refresh_token });
  if (!res.session) { localStorage.removeItem(SESSION); return ''; }
  localStorage.setItem(SESSION, JSON.stringify(res.session));
  return res.session.access_token;
}

export async function api<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const t = await token();
  if (!t) throw new Error('Not signed in');
  const r = await fetch(path, {
    method,
    headers: { authorization: `Bearer ${t}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(String(j.error || `Request failed (${r.status})`));
  return j as T;
}
