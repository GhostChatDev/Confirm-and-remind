'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, demoMode, loadConfig, signIn, signOut, token, type Config } from '@/lib/client';
import { readDraft, writeDraft } from '@/lib/draft';

type Occ = { id: string; reminder_id: string; scheduled_at: string; status: string; label: string };
type Task = { id: string; title: string; due_at: string | null; status: 'open' | 'done' | 'dismissed'; occurrences: Occ[] };
type Note = { id: string; text: string; pinned: boolean; version: number; updated_at: string };
type Prefs = { timezone: string; show_title: boolean };
type Device = { id: string; label: string; active: boolean };
const SCREENS = ['Today', 'Notes', 'Upcoming', 'Review', 'Settings'] as const;
type Screen = (typeof SCREENS)[number];
const fmt = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const day = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const activeOcc = (t: Task) => [...t.occurrences].sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))[0];
const whenOf = (t: Task) => activeOcc(t)?.scheduled_at || t.due_at || '';
const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const key = (b: ArrayBuffer | null) => (b ? btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : '');

export default function Home() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [screen, setScreen] = useState<Screen>('Today');
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({ timezone: 'UTC', show_title: false });
  const [devices, setDevices] = useState<Device[]>([]);
  const [msg, setMsg] = useState('');
  const [online, setOnline] = useState(true);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open');
  const [focusId, setFocusId] = useState('');
  const [editing, setEditing] = useState<Note | null>(null);
  const loaded = useRef(false);

  const refresh = useCallback(async (q = '') => {
    try {
      const [n, t, p, d] = await Promise.all([
        api<{ notes: Note[] }>('/api/notes' + (q ? `?q=${encodeURIComponent(q)}` : '')), api<{ tasks: Task[] }>('/api/tasks'),
        api<{ prefs: Prefs }>('/api/prefs'), api<{ devices: Device[] }>('/api/push'),
      ]);
      setNotes(n.notes); setTasks(t.tasks); setPrefs(p.prefs); setDevices(d.devices); setOnline(true);
    } catch (e) { setOnline(false); setMsg(errText(e)); }
  }, []);

  useEffect(() => {
    (async () => {
      setCfg(await loadConfig());
      setDraft(await readDraft('new-note').catch(() => ''));
      setSignedIn(Boolean(await token()));
      const id = new URLSearchParams(location.search).get('taskId');
      if (id) setFocusId(id);
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    })().catch(() => setMsg('Could not load the app configuration.'));
  }, []);
  useEffect(() => { if (signedIn && !loaded.current) { loaded.current = true; refresh(); } }, [signedIn, refresh]);
  useEffect(() => { if (signedIn) { const h = setTimeout(() => refresh(search), 250); return () => clearTimeout(h); } }, [search, signedIn, refresh]);

  const run = async (fn: () => Promise<unknown>, ok = '') => {
    try { await fn(); setMsg(ok); await refresh(search); } catch (e) { setMsg(errText(e)); }
  };
  const onDraft = (v: string) => { setDraft(v); writeDraft('new-note', v).catch(() => setMsg('Could not keep a draft on this device.')); };
  const saveNote = async () => {
    if (!draft.trim()) return;
    try { await api('/api/notes', 'POST', { text: draft }); await writeDraft('new-note', ''); setDraft(''); setMsg('Note saved.'); await refresh(search); }
    catch (e) { setOnline(false); setMsg(`Not saved to the server (${errText(e)}). Your text is kept as a draft on this device.`); }
  };

  if (!cfg) return <main className="page"><p role="status">Loading…</p></main>;
  if (!signedIn) return <SignIn onDone={() => { loaded.current = false; setSignedIn(true); }} />;
  const today = new Date().toDateString();
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const open = tasks.filter((t) => t.status === 'open');
  const overdue = open.filter((t) => t.due_at && new Date(t.due_at) < startToday);
  const todays = open.filter((t) => !overdue.includes(t) && [t.due_at, activeOcc(t)?.scheduled_at].some((x) => x && new Date(x).toDateString() === today));
  const focus = tasks.find((t) => t.id === focusId);
  const shown = tasks.filter((t) => filter === 'all' || (filter === 'open') === (t.status === 'open')).sort((a, b) => (whenOf(a) || '9').localeCompare(whenOf(b) || '9'));
  const groups = [...new Set(shown.map((t) => (whenOf(t) ? day(whenOf(t)) : 'No date')))];
  const list = (ts: Task[]) => ts.map((t) => <TaskCard key={t.id} t={t} run={run} hi={t.id === focusId} />);

  return <div className="shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">✓</span><span>Confirm &amp; Remind<small>Write it down. Confirm what matters. Get reminded.</small></span></div>
      <nav className="nav" aria-label="Main">{SCREENS.map((s) => <button key={s} className="button" aria-current={screen === s ? 'page' : undefined} onClick={() => setScreen(s)}>{s}</button>)}</nav></aside>
    <main className="page"><header><h1>{screen}</h1></header>
      {!online && <div className="warning">Offline or server unreachable. Anything you type is kept as a draft on this device. Reminders are not scheduled until the server confirms.</div>}
      {demoMode() && <div className="warning">Demo mode: Supabase is not configured, so sign-in is not verified and data lives in server memory only.</div>}
      {msg && <p role="status" className="error">{msg}</p>}
      {screen === 'Today' && <>
        <div className="card capture"><h2>Add note</h2>
          <label className="field"><span>New note</span><textarea rows={4} value={draft} placeholder="Type it here. Save is instant." onChange={(e) => onDraft(e.target.value)} /></label>
          <button className="button primary" onClick={saveNote} disabled={!draft.trim()}>Save note</button></div>
        <TaskForm run={run} notes={notes} />
        {focus && <section><h2>Opened from your notification</h2>{list([focus])}</section>}
        <section><h2>Overdue</h2>{overdue.length ? list(overdue) : <p className="subtle">Nothing overdue.</p>}</section>
        <section><h2>Today</h2>{todays.length ? list(todays) : <p className="subtle">No tasks or reminders today.</p>}</section></>}
      {screen === 'Notes' && <>
        <label className="field"><span>Search notes</span><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your notes" /></label>
        {notes.length === 0 && <div className="card empty"><strong>No notes yet</strong><span>Add one from Today.</span></div>}
        {notes.map((n) => <article className="card" key={n.id}>
          {n.pinned && <span className="badge">Pinned</span>}
          <p style={{ whiteSpace: 'pre-wrap' }}>{n.text}</p><p className="subtle">Version {n.version} · {fmt(n.updated_at)}</p>
          <div className="actions"><button className="button small" onClick={() => setEditing(n)}>Edit</button>
            <button className="button small" onClick={() => run(() => api(`/api/note?id=${n.id}`, 'PATCH', { pinned: !n.pinned }))}>{n.pinned ? 'Unpin' : 'Pin'}</button>
            <button className="button small" onClick={() => confirm('Delete this note?') && run(() => api(`/api/note?id=${n.id}`, 'DELETE'), 'Note deleted.')}>Delete</button></div></article>)}
        {editing && <EditNote n={editing} close={() => setEditing(null)} run={run} />}</>}
      {screen === 'Upcoming' && <>
        <div className="tabs" role="group" aria-label="Filter">{(['open', 'done', 'all'] as const).map((f) => <button key={f} className="button small" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'open' ? 'Not done' : f === 'done' ? 'Done' : 'All'}</button>)}</div>
        {shown.length === 0 && <div className="card empty"><strong>Nothing here</strong></div>}
        {groups.map((g) => <section key={g}><h2>{g}</h2>{list(shown.filter((t) => (whenOf(t) ? day(whenOf(t)) : 'No date') === g))}</section>)}</>}
      {screen === 'Review' && <div className="card empty"><span className="empty-icon" aria-hidden="true">✓</span><strong>Nothing to review yet</strong></div>}
      {screen === 'Settings' && <SettingsPane prefs={prefs} devices={devices} cfg={cfg} run={run} setMsg={setMsg} notes={notes} tasks={tasks} onOut={async () => { await signOut(); loaded.current = false; setSignedIn(false); setNotes([]); setTasks([]); }} />}
    </main></div>;
}

type Run = (fn: () => Promise<unknown>, ok?: string) => Promise<void>;
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function SignIn({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [create, setCreate] = useState(false);
  const [err, setErr] = useState('');
  const demo = demoMode();
  const submit = async (e: React.FormEvent) => { e.preventDefault(); const r = await signIn(email, password, create); if (r) setErr(r); else onDone(); };
  return <main className="page"><form className="card" onSubmit={submit}>
    <h1>Confirm &amp; Remind</h1><p className="subtle">Write it down. Confirm what matters. Get reminded.</p>
    {demo && <p className="warning">Demo mode: Supabase is not configured. Pick any name; it is not verified.</p>}
    <label className="field"><span>{demo ? 'Name' : 'Email'}</span><input value={email} onChange={(e) => setEmail(e.target.value)} type={demo ? 'text' : 'email'} autoComplete="username" required={!demo} placeholder={demo ? 'demo' : ''} /></label>
    {!demo && <label className="field"><span>Password</span><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete={create ? 'new-password' : 'current-password'} required minLength={8} /></label>}
    {err && <p role="alert" className="error">{err}</p>}
    <button className="button primary" type="submit">{create ? 'Create account' : 'Sign in'}</button>
    {!demo && <button className="button" type="button" onClick={() => setCreate(!create)}>{create ? 'I have an account' : 'Create an account'}</button>}
  </form></main>;
}

function TaskForm({ run, notes }: { run: Run; notes: Note[] }) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [remind, setRemind] = useState('');
  const [noteId, setNoteId] = useState('');
  const add = () => run(async () => {
    const { task } = await api<{ task: Task }>('/api/tasks', 'POST', { title, due_at: due ? new Date(due).toISOString() : undefined, note_id: noteId || undefined });
    if (remind) await api('/api/reminders', 'POST', { task_id: task.id, remind_at: new Date(remind).toISOString() });
    setTitle(''); setDue(''); setRemind(''); setNoteId('');
  }, 'Task added.');
  return <div className="card"><h2>Add task</h2>
    <label className="field"><span>Task title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pay the electricity bill" /></label>
    <label className="field"><span>Due date (optional)</span><input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></label>
    <label className="field"><span>Reminder time (optional, separate from due date)</span><input type="datetime-local" value={remind} onChange={(e) => setRemind(e.target.value)} /></label>
    {notes.length > 0 && <label className="field"><span>From note (optional)</span><select value={noteId} onChange={(e) => setNoteId(e.target.value)}><option value="">None</option>{notes.map((n) => <option key={n.id} value={n.id}>{n.text.slice(0, 40)}</option>)}</select></label>}
    <button className="button primary" onClick={add} disabled={!title.trim()}>Add task</button></div>;
}

function TaskCard({ t, run, hi }: { t: Task; run: Run; hi: boolean }) {
  const o = activeOcc(t);
  const [at, setAt] = useState('');
  const isOpen = t.status === 'open';
  const act = (a: object, ok: string) => o && run(() => api(`/api/reminder?id=${o.reminder_id}`, 'PATCH', a), ok);
  return <article className="card" style={hi ? { outline: '3px solid var(--accent, #28634c)' } : undefined}>
    <h3>{t.title}</h3>
    <p className="subtle">{t.due_at ? `Due ${fmt(t.due_at)}` : 'No due date'} · {t.status === 'open' ? 'Open' : t.status === 'done' ? 'Done' : 'Dismissed'}</p>
    {o ? <p><span className="badge">{o.label}</span> {fmt(o.scheduled_at)}</p> : <p className="subtle">No reminder.</p>}
    <div className="actions">
      {isOpen ? <button className="button small" onClick={() => run(() => api(`/api/task?id=${t.id}`, 'PATCH', { status: 'done' }), 'Marked done.')}>Done</button>
        : <button className="button small" onClick={() => run(() => api(`/api/task?id=${t.id}`, 'PATCH', { status: 'open' }), 'Reopened.')}>Reopen</button>}
      {isOpen && <button className="button small" onClick={() => run(() => api(`/api/task?id=${t.id}`, 'PATCH', { status: 'dismissed' }), 'Dismissed.')}>Dismiss</button>}
    </div>
    {isOpen && o && <div className="actions" aria-label="Snooze">
      <button className="button small" onClick={() => act({ action: 'snooze', how: '10m' }, 'Snoozed 10 minutes.')}>Snooze 10 min</button>
      <button className="button small" onClick={() => act({ action: 'snooze', how: '1h' }, 'Snoozed 1 hour.')}>Snooze 1 hour</button>
      <button className="button small" onClick={() => act({ action: 'snooze', how: 'tomorrow' }, 'Snoozed until tomorrow morning.')}>Tomorrow morning</button>
      <input aria-label={`Reschedule ${t.title}`} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} min={toLocalInput(new Date())} />
      <button className="button small" disabled={!at} onClick={() => act({ action: 'reschedule', remind_at: new Date(at).toISOString() }, 'Rescheduled.')}>Reschedule</button>
    </div>}
  </article>;
}

function EditNote({ n, close, run }: { n: Note; close: () => void; run: Run }) {
  const [text, setText] = useState(n.text);
  return <div className="card" role="dialog" aria-label="Edit note"><h2>Edit note</h2>
    <label className="field"><span>Note text</span><textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} /></label>
    <p className="subtle">Each save keeps the earlier text in the version history.</p>
    <div className="actions"><button className="button primary" disabled={!text.trim()} onClick={async () => { await run(() => api(`/api/note?id=${n.id}`, 'PATCH', { text }), 'Note updated.'); close(); }}>Save changes</button>
      <button className="button" onClick={close}>Cancel</button></div></div>;
}

function download(name: string, mime: string, content: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: mime })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

function SettingsPane({ prefs, devices, cfg, run, setMsg, notes, tasks, onOut }: { prefs: Prefs; devices: Device[]; cfg: Config; run: Run; setMsg: (s: string) => void; notes: Note[]; tasks: Task[]; onOut: () => void }) {
  const [tz, setTz] = useState(prefs.timezone);
  const ios = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
  const needsHome = ios && !standalone;
  const enable = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('This browser does not support push notifications.');
      if (!cfg.vapidPublicKey) throw new Error('Push is not configured on the server (VAPID keys missing).');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('Notifications were not allowed.');
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(cfg.vapidPublicKey) }));
      await api('/api/push', 'POST', { endpoint: sub.endpoint, p256dh: key(sub.getKey('p256dh')), auth: key(sub.getKey('auth')), label: navigator.platform || 'This device' });
      setMsg('Notifications enabled on this device.'); await run(async () => {});
    } catch (e) { setMsg(errText(e)); }
  };
  const doExport = async (kind: 'json' | 'md') => {
    try {
      const all = await api<Record<string, unknown>>('/api/export');
      if (kind === 'json') return download('confirm-remind.json', 'application/json', JSON.stringify(all, null, 2));
      const md = ['# Confirm & Remind export', '', '## Notes', ...notes.map((n) => `\n### ${n.updated_at}\n\n${n.text}\n`), '## Tasks', ...tasks.map((t) => `- [${t.status === 'done' ? 'x' : ' '}] ${t.title}${t.due_at ? ` (due ${t.due_at})` : ''}`)].join('\n');
      download('confirm-remind.md', 'text/markdown', md);
    } catch (e) { setMsg(errText(e)); }
  };
  return <>
    <section className="card"><h2>Time zone</h2>
      <label className="field"><span>IANA time zone</span><input value={tz} onChange={(e) => setTz(e.target.value)} /></label>
      <button className="button" onClick={() => run(() => api('/api/prefs', 'PUT', { timezone: tz }), 'Time zone saved.')}>Save time zone</button>
      <p className="subtle">Quiet hours are not enforced yet in this build (see README, Known limits).</p></section>
    <section className="card"><h2>Notifications</h2>
      <label className="check"><input type="checkbox" checked={prefs.show_title} onChange={(e) => run(() => api('/api/prefs', 'PUT', { show_title: e.target.checked }))} /> Show the task title in notifications</label>
      <p className="subtle">Default text: “You have a reminder. Open Confirm &amp; Remind.”</p>
      {needsHome ? <p className="warning">Add to Home Screen, open it from the icon, then tap Enable.</p> : null}
      <div className="actions"><button className="button primary" onClick={enable} disabled={needsHome}>Enable notifications</button>
        <button className="button" onClick={() => run(async () => { const r = await api<{ devices: number; accepted: number }>('/api/push', 'PUT'); setMsg(`Test sent to ${r.devices} device(s); ${r.accepted} accepted by the push service.`); })}>Send test notification</button></div>
      <h3>Devices</h3>{devices.length === 0 && <p className="subtle">No devices yet.</p>}
      {devices.map((d) => <p key={d.id}>{d.label} · {d.active ? 'Active' : 'Disabled'} <button className="button small" onClick={() => run(() => api(`/api/push?id=${d.id}`, 'DELETE'), 'Device removed.')}>Remove</button></p>)}</section>
    <section className="card"><h2>Your data</h2><div className="actions">
      <button className="button" onClick={() => doExport('md')}>Export Markdown</button><button className="button" onClick={() => doExport('json')}>Export JSON</button></div></section>
    <section className="card"><h2>Account</h2><div className="actions">
      <button className="button" onClick={onOut}>Sign out</button>
      <button className="button danger" onClick={() => confirm('Delete your account and ALL its data? This cannot be undone.') && run(async () => { await api('/api/account', 'DELETE'); onOut(); }, 'Account deleted.')}>Delete account</button></div></section></>;
}
