// Server-side reminder dispatcher. Called by a scheduled job (never by browser timers).
// Steps per occurrence: claim (lock) -> recheck reminder and task still active -> expiry check ->
// per-device send with a unique dispatch key -> record result, retry limited, disable gone subscriptions.
import type { Store, SOccurrence, SSub } from './store';

export type PushPayload = { body: string; url: string; tag: string };
export type PushResult = { ok: boolean; statusCode?: number };
export type PushSender = (sub: SSub, payload: PushPayload) => Promise<PushResult>;

export const MAX_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 2 * 60 * 1000;

export type DispatchSummary = { claimed: number; sent: number; skipped: number; expired: number; failed: number; retried: number };

export const dispatchKey = (occurrenceId: string, subId: string) => `${occurrenceId}:${subId}`;

export function inQuietHours(local: { hour: number; minute: number }, start: string, end: string): boolean {
  const toMin = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const cur = local.hour * 60 + local.minute, s = toMin(start), e = toMin(end);
  if (s === e) return false;
  return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}

export async function runDispatch(store: Store, send: PushSender, now = new Date(), token = crypto.randomUUID()): Promise<DispatchSummary> {
  const sum: DispatchSummary = { claimed: 0, sent: 0, skipped: 0, expired: 0, failed: 0, retried: 0 };
  const claimed = store.claimDue(now, 100, token);
  sum.claimed = claimed.length;
  for (const occ of claimed) {
    await processOne(store, occ, send, now, token, sum);
  }
  return sum;
}

async function processOne(store: Store, occ: SOccurrence, send: PushSender, now: Date, token: string, sum: DispatchSummary) {
  // Recheck: reminder and task must still be active, and we must still hold the claim.
  const reminder = store.reminders.get(occ.reminder_id);
  const task = store.tasks.get(occ.task_id);
  if (occ.claim_token !== token) { sum.skipped++; return; }
  if (!reminder || !reminder.active || !task || task.status !== 'open') {
    occ.status = 'cancelled'; occ.claim_token = null; sum.skipped++; return;
  }
  // Expiry window: no late alert.
  if (now.getTime() - new Date(occ.scheduled_at).getTime() > reminder.expiry_minutes * 60000) {
    occ.status = 'expired'; occ.claim_token = null; sum.expired++; return;
  }
  const subs = store.listSubscriptions(occ.user_id).filter((s) => s.active);
  const prefs = store.prefsFor(occ.user_id);
  const payload: PushPayload = {
    body: prefs.show_title ? task.title : 'You have a reminder. Open Confirm & Remind.',
    url: `/?taskId=${encodeURIComponent(task.id)}`,
    tag: occ.id,
  };
  let anyAccepted = false;
  let anyRetryable = false;
  for (const sub of subs) {
    const key = dispatchKey(occ.id, sub.id);
    const prior = store.attempts.get(key);
    if (prior?.status === 'accepted' || prior?.status === 'gone') { if (prior.status === 'accepted') anyAccepted = true; continue; } // never double-send
    let res: PushResult;
    try { res = await send(sub, payload); } catch { res = { ok: false }; }
    const attempts = (prior?.attempts || 0) + 1;
    if (res.ok) {
      store.attempts.set(key, { dispatch_key: key, occurrence_id: occ.id, subscription_id: sub.id, user_id: occ.user_id, attempts, status: 'accepted', status_code: res.statusCode ?? 201, updated_at: now.toISOString() });
      anyAccepted = true; sum.sent++;
    } else if (res.statusCode === 404 || res.statusCode === 410) {
      sub.active = false; // expired subscription: disable it
      store.attempts.set(key, { dispatch_key: key, occurrence_id: occ.id, subscription_id: sub.id, user_id: occ.user_id, attempts, status: 'gone', status_code: res.statusCode, updated_at: now.toISOString() });
    } else {
      store.attempts.set(key, { dispatch_key: key, occurrence_id: occ.id, subscription_id: sub.id, user_id: occ.user_id, attempts, status: 'failed', status_code: res.statusCode ?? null, updated_at: now.toISOString() });
      if (attempts < MAX_ATTEMPTS) anyRetryable = true;
    }
  }
  occ.attempts += 1;
  occ.claim_token = null;
  if (anyAccepted && !anyRetryable) occ.status = 'accepted';
  else if (anyRetryable && occ.attempts < MAX_ATTEMPTS) { occ.status = 'failed'; occ.next_attempt_at = new Date(now.getTime() + RETRY_DELAY_MS).toISOString(); sum.retried++; }
  else { occ.status = anyAccepted ? 'accepted' : 'failed'; occ.next_attempt_at = null; if (!anyAccepted) sum.failed++; }
}
