export type ReminderStatus =
  | 'Scheduled'
  | 'Queued'
  | 'Accepted by push service'
  | 'Failed'
  | 'Completed'
  | 'Saved on this device. Reminder is not scheduled yet.';

export type NoteVersion = {
  id: string;
  note_id: string;
  user_id: string;
  version: number;
  text: string;
  created_at: string;
};

export type Note = {
  id: string;
  user_id?: string;
  text: string;
  pinned: boolean;
  version: number;
  versions?: NoteVersion[];
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  user_id?: string;
  title: string;
  note_id?: string | null;
  due_at?: string | null;
  due_tz?: string;
  status: 'open' | 'done' | 'dismissed';
  reminder_id?: string | null;
  occurrence_id?: string | null;
  reminder_at?: string | null;
  reminder_tz?: string;
  reminder_status?: ReminderStatus | null;
  created_at: string;
  updated_at?: string;
};

export type PushSubscriptionItem = {
  id: string;
  user_id: string;
  device_label: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  active: boolean;
   simulate_fail?: boolean;
   simulate_expired?: boolean;
  created_at: string;
};

export type Preferences = {
  timezone: string;
  quiet_start: string;
  quiet_end: string;
  show_title: boolean;
};

export const defaults: Preferences = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto',
  quiet_start: '22:00',
  quiet_end: '07:00',
  show_title: false,
};

export const uid = () => crypto.randomUUID();

export function formatDate(date?: string | null, timezone?: string) {
  if (!date) return 'No date';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Invalid date';
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone || 'UTC',
    }).format(parsed);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(parsed);
  }
}

export function formatDayGroup(date?: string | null, timezone?: string) {
  if (!date) return 'No date set';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'No date set';
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: timezone || 'UTC',
    }).format(parsed);
  } catch {
    return parsed.toISOString().slice(0, 10);
  }
}

/**
 * Converts a wall-clock date/time in an IANA time zone into an exact UTC Date.
 * Preserves local wall-clock time (e.g., 08:00 stays 08:00 across DST changes).
 */
export function wallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const guessUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const offset1 = getTzOffsetMs(new Date(guessUtc), timeZone);
  const adjusted1 = guessUtc - offset1;
  const offset2 = getTzOffsetMs(new Date(adjusted1), timeZone);
  return new Date(guessUtc - offset2);
}

function getTzOffsetMs(utcDate: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(utcDate);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = Number(p.value);
  }
  const hour = map.hour === 24 ? 0 : map.hour;
  const asUtc = Date.UTC(map.year, map.month - 1, map.day, hour, map.minute, map.second);
  return asUtc - utcDate.getTime();
}

export function getLocalParts(utcDate: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(utcDate)) {
    if (p.type !== 'literal') map[p.type] = Number(p.value);
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour === 24 ? 0 : map.hour,
    minute: map.minute,
  };
}

/**
 * Computes the next daily occurrence keeping the exact local wall-clock hour/minute
 * across Daylight Saving Time transitions.
 */
export function nextDailyOccurrence(currentUtcIso: string, timeZone: string): string {
  const current = new Date(currentUtcIso);
  const local = getLocalParts(current, timeZone);
  const nextDay = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
  return wallTimeToUtc(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth() + 1,
    nextDay.getUTCDate(),
    local.hour,
    local.minute,
    timeZone
  ).toISOString();
}

/**
 * Documented short-month rule:
 * A monthly reminder anchored on day N (e.g., 31st) clamps to the last valid day of
 * shorter months (Feb 28/29, Apr 30, Jun 30, Sep 30, Nov 30) at the same local time.
 */
export function nextMonthlyOccurrence(
  currentUtcIso: string,
  anchorDay: number,
  timeZone: string
): string {
  const current = new Date(currentUtcIso);
  const local = getLocalParts(current, timeZone);
  let targetYear = local.year;
  let targetMonth = local.month + 1;
  if (targetMonth > 12) {
    targetMonth = 1;
    targetYear += 1;
  }
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const clampedDay = Math.min(anchorDay, daysInTargetMonth);
  return wallTimeToUtc(
    targetYear,
    targetMonth,
    clampedDay,
    local.hour,
    local.minute,
    timeZone
  ).toISOString();
}

export function tomorrowMorning(now: Date, timeZone?: string): Date {
  if (!timeZone) {
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(8, 0, 0, 0);
    return next;
  }
  try {
    const local = getLocalParts(now, timeZone);
    const nextDay = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
    return wallTimeToUtc(
      nextDay.getUTCFullYear(),
      nextDay.getUTCMonth() + 1,
      nextDay.getUTCDate(),
      8,
      0,
      timeZone
    );
  } catch {
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(8, 0, 0, 0);
    return next;
  }
}

export function isIosSafariNotStandalone(userAgent: string, standalone: boolean): boolean {
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isWebkit = /WebKit/.test(userAgent);
  const isCriOS = /CriOS|FxiOS|EdgiOS/.test(userAgent);
  return isIOS && isWebkit && !isCriOS && !standalone;
}

export function markdown(notes: Note[], tasks: Task[]) {
  return (
    '# Confirm & Remind export\n\n## Notes\n\n' +
    (notes.length ? notes.map((n) => `${n.text}\n`).join('\n---\n\n') : '_No notes_\n') +
    '\n## Tasks\n\n' +
    (tasks.length
      ? tasks
          .map(
            (t) =>
              `- [${t.status === 'done' ? 'x' : ' '}] ${t.title}${
                t.due_at ? ` (due ${t.due_at})` : ''
              }${t.reminder_at ? ` (reminder ${t.reminder_at})` : ''}`
          )
          .join('\n')
      : '_No tasks_') +
    '\n'
  );
}
