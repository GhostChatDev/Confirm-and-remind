-- Confirm & Remind Phase 1 Schema + Phase 2 AI Suggestions Reservation
-- Postgres / Supabase migration with strict Row-Level Security (RLS) on every user table.

create extension if not exists "pgcrypto";

-- 1. profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  timezone text not null default 'UTC',
  quiet_start text not null default '22:00',
  quiet_end text not null default '07:00',
  show_title boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

-- 2. notes
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  pinned boolean not null default false,
  version integer not null default 1,
  search_tsv tsvector generated always as (to_tsvector('english', coalesce(text, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_user_idx on public.notes(user_id, pinned desc, updated_at desc);
create index if not exists notes_search_idx on public.notes using gin(search_tsv);
alter table public.notes enable row level security;
create policy "notes_all_own" on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. note_versions
create table if not exists public.note_versions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null,
  text text not null,
  created_at timestamptz not null default now(),
  unique(note_id, version)
);
alter table public.note_versions enable row level security;
create policy "note_versions_all_own" on public.note_versions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid references public.notes(id) on delete set null,
  title text not null,
  due_at timestamptz,
  due_tz text not null default 'UTC',
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_user_status_idx on public.tasks(user_id, status, due_at);
alter table public.tasks enable row level security;
create policy "tasks_all_own" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. reminders
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  remind_at timestamptz not null,
  timezone text not null default 'UTC',
  recurrence text check (recurrence in ('none', 'daily', 'monthly') or recurrence is null),
  local_time text,
  day_of_month integer,
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Queued', 'Accepted by push service', 'Failed', 'Completed', 'Cancelled')),
  idempotency_key text not null,
  expiry_minutes integer not null default 120,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, idempotency_key)
);
alter table public.reminders enable row level security;
create policy "reminders_all_own" on public.reminders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. reminder_occurrences
create table if not exists public.reminder_occurrences (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  scheduled_for timestamptz not null,
  timezone text not null default 'UTC',
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Queued', 'Accepted by push service', 'Failed', 'Completed', 'Cancelled', 'Expired')),
  locked_by text,
  locked_at timestamptz,
  retry_count integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists occurrences_due_idx on public.reminder_occurrences(status, scheduled_for);
alter table public.reminder_occurrences enable row level security;
create policy "reminder_occurrences_all_own" on public.reminder_occurrences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 7. push_subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null default 'Browser device',
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions_all_own" on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 8. notification_attempts
create table if not exists public.notification_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  occurrence_id uuid not null references public.reminder_occurrences(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  dispatch_key text not null unique,
  status text not null check (status in ('Accepted by push service', 'Failed')),
  attempt_number integer not null default 1,
  error_code text,
  created_at timestamptz not null default now()
);
alter table public.notification_attempts enable row level security;
create policy "notification_attempts_all_own" on public.notification_attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 9. audit_events (never logs note text)
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  created_at timestamptz not null default now()
);
alter table public.audit_events enable row level security;
create policy "audit_events_select_own" on public.audit_events for select using (auth.uid() = user_id);
create policy "audit_events_insert_own" on public.audit_events for insert with check (auth.uid() = user_id);

-- 10. deletion_jobs
create table if not exists public.deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'completed' check (status in ('queued', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.deletion_jobs enable row level security;
create policy "deletion_jobs_select_own" on public.deletion_jobs for select using (auth.uid() = user_id);

-- 11. ai_suggestions (Empty Phase 2 table designed so Phase 2 requires no schema rewrite)
create table if not exists public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  note_version integer not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_text text not null,
  source_quote text not null,
  proposed_due_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'dismissed')),
  created_at timestamptz not null default now()
);
alter table public.ai_suggestions enable row level security;
create policy "ai_suggestions_all_own" on public.ai_suggestions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
