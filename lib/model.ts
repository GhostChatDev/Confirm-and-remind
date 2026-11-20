export type Note = { id: string; text: string; pinned: boolean; created_at: string; updated_at: string };
export type Task = { id: string; title: string; note_id?: string | null; due_at?: string | null; status: 'open' | 'done' | 'dismissed'; reminder_at?: string | null; reminder_status?: string; created_at: string };
export type Preferences = { timezone: string; quiet_start: string; quiet_end: string; show_title: boolean };
export const defaults: Preferences = { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', quiet_start: '22:00', quiet_end: '07:00', show_title: false };
export const uid = () => crypto.randomUUID();
export function formatDate(date?: string | null, timezone?: string) {
  if (!date) return 'No date';
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(date)); } catch { return 'Invalid date'; }
}
export function tomorrowMorning(now: Date) { const next = new Date(now); next.setDate(next.getDate() + 1); next.setHours(8, 0, 0, 0); return next; }
export function markdown(notes: Note[], tasks: Task[]) {
  return '# Confirm & Remind export\n\n## Notes\n\n' + notes.map(n => `${n.text}\n`).join('\n---\n\n') + '\n## Tasks\n\n' + tasks.map(t => `- [${t.status === 'done' ? 'x' : ' '}] ${t.title}${t.due_at ? ` (due ${t.due_at})` : ''}${t.reminder_at ? ` (reminder ${t.reminder_at})` : ''}`).join('\n') + '\n';
}
