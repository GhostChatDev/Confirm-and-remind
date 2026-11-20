import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Store } from './store';

// DEMO ONLY: when Supabase is not configured, the mock server store is kept in a JSON file
// so it survives a server restart. Not for production data (no locking across processes).
// Set DEMO_STORE_FILE outside the build output directory for production demo deployments.
const FILE = process.env.DEMO_STORE_FILE || join(process.cwd(), '.data', 'demo-store.json');
let loadedOnce = false;

const MAPS = ['notes', 'tasks', 'reminders', 'occurrences', 'subs', 'attempts', 'prefs'] as const;

export function loadStore(s: Store): void {
  if (loadedOnce) return;
  loadedOnce = true;
  try {
    if (!existsSync(FILE)) return;
    const j = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, unknown>;
    for (const k of MAPS) {
      const entries = j[k];
      if (Array.isArray(entries)) {
        const m = s[k] as Map<string, unknown>;
        m.clear();
        for (const [key, val] of entries as [string, unknown][]) m.set(key, val);
      }
    }
    if (Array.isArray(j.versions)) s.versions = j.versions as Store['versions'];
    if (Array.isArray(j.audit)) s.audit = j.audit as Store['audit'];
  } catch {
    // A corrupt demo file is ignored: the demo store starts empty.
  }
}

export function saveStore(s: Store): void {
  try {
    const out: Record<string, unknown> = { versions: s.versions, audit: s.audit };
    for (const k of MAPS) out[k] = [...(s[k] as Map<string, unknown>).entries()];
    mkdirSync(dirname(FILE), { recursive: true });
    const tmp = FILE + '.tmp';
    writeFileSync(tmp, JSON.stringify(out));
    renameSync(tmp, FILE);
  } catch {
    // Read-only disk: the demo store just stays in memory.
  }
}
