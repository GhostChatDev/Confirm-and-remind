import { describe, it, expect } from 'vitest';
import { Store, NotFoundError } from './store';
import { runDispatch, MAX_ATTEMPTS, type PushSender } from './dispatch';
import { nextDailyOccurrence, getLocalParts } from './model';

const A = 'user-a';
const B = 'user-b';
const T0 = new Date('2026-03-01T12:00:00Z');
const ok: PushSender = async () => ({ ok: true, statusCode: 201 });

function setup() {
  const s = new Store();
  const note = s.createNote(A, 'Pay the electricity bill', T0);
  const task = s.createTask(A, { title: 'Pay bill', note_id: note.id }, T0);
  s.addSubscription(A, { endpoint: 'https://push.example/a1', p256dh: 'k', auth: 'a' });
  return { s, note, task };
}

describe('authorization', () => {
  it('user B cannot read, update, delete or search user A data', () => {
    const { s, note, task } = setup();
    const { reminder } = s.createReminder(A, task.id, '2026-03-01T13:00:00Z', 'UTC', T0);
    const sub = s.listSubscriptions(A)[0];
    expect(() => s.getNote(B, note.id)).toThrow(NotFoundError);
    expect(() => s.updateNote(B, note.id, { text: 'x' })).toThrow(NotFoundError);
    expect(() => s.deleteNote(B, note.id)).toThrow(NotFoundError);
    expect(s.listNotes(B, 'electricity')).toEqual([]);
    expect(s.listTasks(B)).toEqual([]);
    expect(() => s.getTask(B, task.id)).toThrow(NotFoundError);
    expect(() => s.setTaskStatus(B, task.id, 'done')).toThrow(NotFoundError);
    expect(() => s.snooze(B, reminder.id, '10m')).toThrow(NotFoundError);
    expect(() => s.reschedule(B, reminder.id, '2026-03-02T00:00:00Z')).toThrow(NotFoundError);
    expect(s.listSubscriptions(B)).toEqual([]);
    expect(() => s.removeSubscription(B, sub.id)).toThrow(NotFoundError);
    expect(s.getNote(A, note.id).text).toBe('Pay the electricity bill');
  });
});

describe('notes keep the original text and history', () => {
  it('records versions', () => {
    const { s, note } = setup();
    s.updateNote(A, note.id, { text: 'Pay the bill today' }, T0);
    expect(s.noteVersions(A, note.id).map((v) => v.text)).toEqual(['Pay the electricity bill', 'Pay the bill today']);
  });
});

describe('reminders', () => {
  it('creating the same reminder twice does not duplicate', () => {
    const { s, task } = setup();
    const r1 = s.createReminder(A, task.id, '2026-03-01T13:00:00Z', 'UTC', T0);
    const r2 = s.createReminder(A, task.id, '2026-03-01T13:00:00Z', 'UTC', T0);
    expect(r1.created).toBe(true);
    expect(r2.created).toBe(false);
    expect(s.reminders.size).toBe(1);
    expect(s.occurrencesFor(A, task.id)).toHaveLength(1);
  });

  it('a completed or dismissed task is never sent', async () => {
    for (const status of ['done', 'dismissed'] as const) {
      const { s, task } = setup();
      s.createReminder(A, task.id, '2026-03-01T13:00:00Z', 'UTC', T0);
      s.setTaskStatus(A, task.id, status, T0);
      let sent = 0;
      await runDispatch(s, async () => { sent++; return { ok: true }; }, new Date('2026-03-01T13:01:00Z'));
      expect(sent).toBe(0);
    }
  });

  it('does not send before due, sends once when due, never twice', async () => {
    const { s, task } = setup();
    s.createReminder(A, task.id, '2026-03-01T13:00:00Z', 'UTC', T0);
    let sent = 0;
    const send: PushSender = async () => { sent++; return { ok: true, statusCode: 201 }; };
    await runDispatch(s, send, new Date('2026-03-01T12:30:00Z'));
    expect(sent).toBe(0);
    const sum = await runDispatch(s, send, new Date('2026-03-01T13:00:30Z'));
    expect(sum.sent).toBe(1);
    await runDispatch(s, send, new Date('2026-03-01T13:01:30Z'));
    expect(sent).toBe(1);
    expect(s.statusLabel(s.occurrencesFor(A, task.id)[0])).toBe('Accepted by push service');
  });

  it('a second dispatcher cannot claim the same occurrence', () => {
    const { s, task } = setup();
    s.createReminder(A, task.id, '2026-03-01T13:00:00Z', 'UTC', T0);
    const now = new Date('2026-03-01T13:00:30Z');
    expect(s.claimDue(now, 10, 'one')).toHaveLength(1);
    expect(s.claimDue(now, 10, 'two')).toHaveLength(0);
  });

  it('skips an expired reminder (no late alert)', async () => {
    const { s, task } = setup();
    s.createReminder(A, task.id, '2026-03-01T13:00:00Z', 'UTC', T0);
    let sent = 0;
    const sum = await runDispatch(s, async () => { sent++; return { ok: true }; }, new Date('2026-03-01T15:00:00Z'));
    expect(sent).toBe(0);
    expect(sum.expired).toBe(1);
  });

  it('retries a failed send a limited number of times', async () => {
    const { s, task } = setup();
    s.createReminder(A, task.id, '2026-03-01T13:00:00Z', 'UTC', T0);
    let calls = 0;
    const fail: PushSender = async () => { calls++; return { ok: false, statusCode: 500 }; };
    let now = new Date('2026-03-01T13:00:10Z');
    for (let i = 0; i < 8; i++) { await runDispatch(s, fail, now); now = new Date(now.getTime() + 3 * 60000); }
    expect(calls).toBe(MAX_ATTEMPTS);
    expect(s.occurrencesFor(A, task.id)[0].status).toBe('failed');
  });

  it('disables an expired push subscription (410)', async () => {
    const { s, task } = setup();
    s.createReminder(A, task.id, '2026-03-01T13:00:00Z', 'UTC', T0);
    await runDispatch(s, async () => ({ ok: false, statusCode: 410 }), new Date('2026-03-01T13:00:10Z'));
    expect(s.listSubscriptions(A)[0].active).toBe(false);
  });

  it('uses generic text unless the title setting is on, and links to the task', async () => {
    const { s, task } = setup();
    s.createReminder(A, task.id, '2026-03-01T13:00:00Z', 'UTC', T0);
    const bodies: string[] = [];
    await runDispatch(s, async (_sub, p) => { bodies.push(p.body); return { ok: true }; }, new Date('2026-03-01T13:00:10Z'));
    expect(bodies[0]).toBe('You have a reminder. Open Confirm & Remind.');
    const t2 = s.createTask(A, { title: 'Call dentist' }, T0);
    s.setPrefs(A, { show_title: true });
    s.createReminder(A, t2.id, '2026-03-01T14:00:00Z', 'UTC', T0);
    let url = '';
    await runDispatch(s, async (_sub, p) => { bodies.push(p.body); url = p.url; return { ok: true }; }, new Date('2026-03-01T14:00:10Z'));
    expect(bodies[1]).toBe('Call dentist');
    expect(url).toBe(`/?taskId=${t2.id}`);
  });
});

describe('snooze and reschedule update the right occurrence', () => {
  it("moves only that task's occurrence", () => {
    const { s, task } = setup();
    const t2 = s.createTask(A, { title: 'Other' }, T0);
    const r1 = s.createReminder(A, task.id, '2026-03-01T13:00:00Z', 'UTC', T0);
    const r2 = s.createReminder(A, t2.id, '2026-03-01T14:00:00Z', 'UTC', T0);
    const o = s.snooze(A, r1.reminder.id, '10m', T0);
    expect(o.id).toBe(r1.occurrence.id);
    expect(o.scheduled_at).toBe('2026-03-01T12:10:00.000Z');
    expect(s.occurrencesFor(A, t2.id)[0].scheduled_at).toBe(r2.occurrence.scheduled_at);
    expect(s.snooze(A, r1.reminder.id, '1h', T0).scheduled_at).toBe('2026-03-01T13:00:00.000Z');
    expect(s.occurrencesFor(A, task.id)).toHaveLength(1);
  });

  it('a snoozed reminder is sent at the new time, not the old one', async () => {
    const { s, task } = setup();
    const r = s.createReminder(A, task.id, '2026-03-01T13:00:00Z', 'UTC', T0);
    s.snooze(A, r.reminder.id, '1h', new Date('2026-03-01T13:00:00Z'));
    let sent = 0;
    await runDispatch(s, async () => { sent++; return { ok: true }; }, new Date('2026-03-01T13:30:00Z'));
    expect(sent).toBe(0);
    await runDispatch(s, ok, new Date('2026-03-01T14:00:30Z'));
    expect(s.occurrencesFor(A, task.id)[0].status).toBe('accepted');
  });
});

describe('daily reminder across daylight saving', () => {
  it('stays at 8:00 local time (America/Toronto, DST starts 2026-03-08)', () => {
    const next = nextDailyOccurrence('2026-03-07T13:00:00.000Z', 'America/Toronto');
    expect(next).toBe('2026-03-08T12:00:00.000Z');
    expect(getLocalParts(new Date(next), 'America/Toronto').hour).toBe(8);
  });
});

describe('export and account deletion', () => {
  it('export returns only own data; delete removes all of it and leaves others', () => {
    const { s, note, task } = setup();
    s.createReminder(A, task.id, '2026-03-01T13:00:00Z', 'UTC', T0);
    const nb = s.createNote(B, 'B private', T0);
    const ex = s.exportAll(A);
    expect(ex.notes.map((n) => n.id)).toEqual([note.id]);
    expect(JSON.stringify(ex)).not.toContain('B private');
    s.deleteAccount(A);
    expect(s.exportAll(A).notes).toEqual([]);
    expect([...s.reminders.values(), ...s.occurrences.values(), ...s.subs.values(), ...s.tasks.values()].filter((x) => x.user_id === A)).toEqual([]);
    expect(s.versions.some((v) => v.user_id === A)).toBe(false);
    expect(s.getNote(B, nb.id).text).toBe('B private');
  });

  it('deleting a note removes it and its versions', () => {
    const { s, note } = setup();
    s.deleteNote(A, note.id);
    expect(s.listNotes(A)).toEqual([]);
    expect(s.versions.filter((v) => v.note_id === note.id)).toEqual([]);
  });
});
