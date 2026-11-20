// Server-side data layer. This in-memory implementation is the MOCK used for tests and local runs.
// Every public method takes the acting userId and only touches that user's rows (the same rule the
// Supabase RLS policies must enforce). Foreign ids behave exactly like missing ids (NotFoundError).
import { tomorrowMorning, nextDailyOccurrence } from './model';

export class NotFoundError extends Error {
  constructor() { super('Not found'); }
}

export type SNote = { id: string; user_id: string; text: string; pinned: boolean; version: number; created_at: string; updated_at: string };
export type SNoteVersion = { id: string; note_id: string; user_id: string; version: number; text: string; created_at: string };
export type STask = { id: string; user_id: string; note_id: string | null; title: string; due_at: string | null; status: 'open' | 'done' | 'dismissed'; created_at: string; updated_at: string };
export type SReminder = { id: string; user_id: string; task_id: string; remind_at: string; tz: string; active: boolean; expiry_minutes: number; created_at: string };
export type OccStatus = 'scheduled' | 'queued' | 'accepted' | 'failed' | 'completed' | 'cancelled' | 'expired';
export type SOccurrence = {
  id: string; reminder_id: string; user_id: string; task_id: string; scheduled_at: string; status: OccStatus;
  claim_token: string | null; claimed_at: string | null; attempts: number; next_attempt_at: string | null;
};
export type SSub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; label: string; active: boolean; created_at: string };
export type SAttempt = { dispatch_key: string; occurrence_id: string; subscription_id: string; user_id: string; attempts: number; status: 'accepted' | 'failed' | 'gone'; status_code: number | null; updated_at: string };
export type SPrefs = { timezone: string; show_title: boolean };
export type SAudit = { id: string; user_id: string | null; event: string; at: string };

const id = () => crypto.randomUUID();
const CLAIM_STALE_MS = 5 * 60 * 1000;
const DEFAULT_EXPIRY_MIN = 60;

export class Store {
  notes = new Map<string, SNote>();
  versions: SNoteVersion[] = [];
  tasks = new Map<string, STask>();
  reminders = new Map<string, SReminder>();
  occurrences = new Map<string, SOccurrence>();
  subs = new Map<string, SSub>();
  attempts = new Map<string, SAttempt>();
  prefs = new Map<string, SPrefs>();
  audit: SAudit[] = [];

  private log(user_id: string | null, event: string) {
    // Never record note content: only the event name.
    this.audit.push({ id: id(), user_id, event, at: new Date().toISOString() });
  }
  private own<T extends { user_id: string }>(m: Map<string, T>, userId: string, key: string): T {
    const row = m.get(key);
    if (!row || row.user_id !== userId) throw new NotFoundError();
    return row;
  }

  // ---- notes
  createNote(userId: string, text: string, now = new Date()): SNote {
    const t = now.toISOString();
    const n: SNote = { id: id(), user_id: userId, text, pinned: false, version: 1, created_at: t, updated_at: t };
    this.notes.set(n.id, n);
    this.versions.push({ id: id(), note_id: n.id, user_id: userId, version: 1, text, created_at: t });
    this.log(userId, 'note.create');
    return n;
  }
  getNote(userId: string, noteId: string) { return this.own(this.notes, userId, noteId); }
  updateNote(userId: string, noteId: string, patch: { text?: string; pinned?: boolean }, now = new Date()): SNote {
    const n = this.own(this.notes, userId, noteId);
    if (patch.pinned !== undefined) n.pinned = patch.pinned;
    if (patch.text !== undefined && patch.text !== n.text) {
      n.text = patch.text;
      n.version += 1;
      this.versions.push({ id: id(), note_id: n.id, user_id: userId, version: n.version, text: patch.text, created_at: now.toISOString() });
    }
    n.updated_at = now.toISOString();
    return n;
  }
  noteVersions(userId: string, noteId: string) {
    this.own(this.notes, userId, noteId);
    return this.versions.filter((v) => v.note_id === noteId && v.user_id === userId);
  }
  deleteNote(userId: string, noteId: string) {
    this.own(this.notes, userId, noteId);
    this.notes.delete(noteId);
    this.versions = this.versions.filter((v) => v.note_id !== noteId);
    for (const t of this.tasks.values()) if (t.user_id === userId && t.note_id === noteId) t.note_id = null;
    this.log(userId, 'note.delete');
  }
  listNotes(userId: string, query?: string): SNote[] {
    const words = (query || '').toLowerCase().split(/\s+/).filter(Boolean);
    return [...this.notes.values()]
      .filter((n) => n.user_id === userId && words.every((w) => n.text.toLowerCase().includes(w)))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));
  }

  // ---- tasks
  createTask(userId: string, input: { title: string; note_id?: string | null; due_at?: string | null }, now = new Date()): STask {
    if (input.note_id) this.own(this.notes, userId, input.note_id);
    const t = now.toISOString();
    const task: STask = { id: id(), user_id: userId, note_id: input.note_id ?? null, title: input.title, due_at: input.due_at ?? null, status: 'open', created_at: t, updated_at: t };
    this.tasks.set(task.id, task);
    this.log(userId, 'task.create');
    return task;
  }
  getTask(userId: string, taskId: string) { return this.own(this.tasks, userId, taskId); }
  listTasks(userId: string) { return [...this.tasks.values()].filter((t) => t.user_id === userId); }
  setTaskStatus(userId: string, taskId: string, status: STask['status'], now = new Date()): STask {
    const task = this.own(this.tasks, userId, taskId);
    task.status = status;
    task.updated_at = now.toISOString();
    if (status !== 'open') this.cancelRemindersFor(userId, taskId, status === 'done' ? 'completed' : 'cancelled');
    this.log(userId, 'task.' + status);
    return task;
  }
  private cancelRemindersFor(userId: string, taskId: string, occ: 'completed' | 'cancelled') {
    for (const r of this.reminders.values()) if (r.user_id === userId && r.task_id === taskId) r.active = false;
    for (const o of this.occurrences.values()) {
      if (o.user_id === userId && o.task_id === taskId && ['scheduled', 'queued', 'failed'].includes(o.status)) {
        o.status = occ; o.claim_token = null; o.next_attempt_at = null;
      }
    }
  }

  // ---- reminders (one manual reminder per task; creating again with the same time is a no-op)
  createReminder(userId: string, taskId: string, remindAtIso: string, tz: string, now = new Date()): { reminder: SReminder; occurrence: SOccurrence; created: boolean } {
    const task = this.own(this.tasks, userId, taskId);
    if (task.status !== 'open') throw new NotFoundError();
    if (Number.isNaN(new Date(remindAtIso).getTime())) throw new RangeError('Invalid reminder time');
    const at = new Date(remindAtIso).toISOString();
    let r = [...this.reminders.values()].find((x) => x.user_id === userId && x.task_id === taskId && x.active);
    if (r) {
      const occ = this.reschedule(userId, r.id, at, now);
      return { reminder: r, occurrence: occ, created: false };
    }
    r = { id: id(), user_id: userId, task_id: taskId, remind_at: at, tz, active: true, expiry_minutes: DEFAULT_EXPIRY_MIN, created_at: now.toISOString() };
    this.reminders.set(r.id, r);
    const occ = this.newOccurrence(r, at);
    this.log(userId, 'reminder.create');
    return { reminder: r, occurrence: occ, created: true };
  }
  private newOccurrence(r: SReminder, at: string): SOccurrence {
    const o: SOccurrence = { id: id(), reminder_id: r.id, user_id: r.user_id, task_id: r.task_id, scheduled_at: at, status: 'scheduled', claim_token: null, claimed_at: null, attempts: 0, next_attempt_at: null };
    this.occurrences.set(o.id, o);
    return o;
  }
  /** Moves the pending occurrence of the reminder. If it was already sent, a new occurrence is created. */
  reschedule(userId: string, reminderId: string, newAtIso: string, _now = new Date()): SOccurrence {
    const r = this.own(this.reminders, userId, reminderId);
    if (!r.active) throw new NotFoundError();
    const at = new Date(newAtIso).toISOString();
    r.remind_at = at;
    const pending = [...this.occurrences.values()].find((o) => o.reminder_id === r.id && ['scheduled', 'queued', 'failed'].includes(o.status));
    if (pending) {
      pending.scheduled_at = at; pending.status = 'scheduled'; pending.claim_token = null; pending.claimed_at = null;
      pending.attempts = 0; pending.next_attempt_at = null;
      this.log(userId, 'reminder.reschedule');
      return pending;
    }
    this.log(userId, 'reminder.reschedule');
    return this.newOccurrence(r, at);
  }
  snooze(userId: string, reminderId: string, how: '10m' | '1h' | 'tomorrow', now = new Date()): SOccurrence {
    const r = this.own(this.reminders, userId, reminderId);
    const at = how === '10m' ? new Date(now.getTime() + 10 * 60000) : how === '1h' ? new Date(now.getTime() + 3600000) : tomorrowMorning(now, this.prefsFor(userId).timezone);
    return this.reschedule(userId, r.id, at.toISOString(), now);
  }
  /** Repeat a daily reminder keeping local wall-clock time across DST. */
  nextDaily(userId: string, reminderId: string): SOccurrence {
    const r = this.own(this.reminders, userId, reminderId);
    return this.reschedule(userId, r.id, nextDailyOccurrence(r.remind_at, r.tz));
  }
  occurrencesFor(userId: string, taskId: string) {
    this.own(this.tasks, userId, taskId);
    return [...this.occurrences.values()].filter((o) => o.user_id === userId && o.task_id === taskId);
  }
  /** The honest label shown in the UI. 'Scheduled' only for an occurrence the server holds. */
  statusLabel(o: SOccurrence | undefined): string {
    if (!o) return 'Saved on this device. Reminder is not scheduled yet.';
    return ({ scheduled: 'Scheduled', queued: 'Queued', accepted: 'Accepted by push service', failed: 'Failed', completed: 'Completed', cancelled: 'Completed', expired: 'Failed' } as const)[o.status];
  }

  // ---- push subscriptions
  addSubscription(userId: string, input: { endpoint: string; p256dh: string; auth: string; label?: string }): SSub {
    const existing = [...this.subs.values()].find((s) => s.endpoint === input.endpoint);
    if (existing && existing.user_id !== userId) throw new NotFoundError();
    if (existing) { existing.active = true; existing.p256dh = input.p256dh; existing.auth = input.auth; return existing; }
    const s: SSub = { id: id(), user_id: userId, endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth, label: input.label || 'This device', active: true, created_at: new Date().toISOString() };
    this.subs.set(s.id, s);
    return s;
  }
  listSubscriptions(userId: string) { return [...this.subs.values()].filter((s) => s.user_id === userId); }
  removeSubscription(userId: string, subId: string) { this.own(this.subs, userId, subId); this.subs.delete(subId); }

  // ---- preferences
  prefsFor(userId: string): SPrefs { return this.prefs.get(userId) || { timezone: 'UTC', show_title: false }; }
  setPrefs(userId: string, p: Partial<SPrefs>) { this.prefs.set(userId, { ...this.prefsFor(userId), ...p }); }

  // ---- dispatcher (service role only; never exposed to a user route)
  claimDue(now: Date, limit: number, token: string): SOccurrence[] {
    const out: SOccurrence[] = [];
    for (const o of this.occurrences.values()) {
      if (out.length >= limit) break;
      const staleClaim = o.status === 'queued' && o.claimed_at && now.getTime() - new Date(o.claimed_at).getTime() > CLAIM_STALE_MS;
      const due = o.status === 'scheduled' && new Date(o.scheduled_at) <= now;
      const retry = o.status === 'failed' && o.next_attempt_at && new Date(o.next_attempt_at) <= now;
      if (due || retry || staleClaim) {
        o.status = 'queued'; o.claim_token = token; o.claimed_at = now.toISOString();
        out.push(o);
      }
    }
    return out;
  }

  // ---- export and deletion
  exportAll(userId: string) {
    return {
      exported_at: new Date().toISOString(),
      notes: this.listNotes(userId),
      note_versions: this.versions.filter((v) => v.user_id === userId),
      tasks: this.listTasks(userId),
      reminders: [...this.reminders.values()].filter((r) => r.user_id === userId),
    };
  }
  deleteAccount(userId: string) {
    for (const m of [this.notes, this.tasks, this.reminders, this.occurrences, this.subs] as Map<string, { user_id: string }>[]) {
      for (const [k, v] of m) if (v.user_id === userId) m.delete(k);
    }
    for (const [k, v] of this.attempts) if (v.user_id === userId) this.attempts.delete(k);
    this.versions = this.versions.filter((v) => v.user_id !== userId);
    this.audit = this.audit.filter((a) => a.user_id !== userId);
    this.prefs.delete(userId);
    this.log(null, 'account.delete');
  }
}

export const globalStore = new Store();
