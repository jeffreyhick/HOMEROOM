-- Phase 2 — Canvas sync.
-- `assignments` holds every deadline (synced or hand-added); `courses` carries the
-- class-identity columns only. Phase 5 ALTERs courses to add priority/weekly_goal_minutes;
-- it does not create it (schema.md "courses — split across two phases").

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  canvas_uid text,
  course text not null,
  title text not null,
  due_at timestamptz not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'done', 'dismissed')),
  is_exam boolean not null default false,
  last_touched_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now()
);

-- The upsert key for sync. Partial so hand-added rows (canvas_uid null) never collide.
create unique index if not exists assignments_canvas_uid_key
  on assignments (canvas_uid) where canvas_uid is not null;

-- Every dashboard read is "this user's deadlines, soonest first".
create index if not exists assignments_user_due_idx on assignments (user_id, due_at);

alter table assignments enable row level security;

create policy "assignments_owner" on assignments
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  code text not null unique,
  color text not null,
  icon text not null default 'book'
);

alter table courses enable row level security;

create policy "courses_owner" on courses
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Deferred from 0002: progress_logs.assignment_id could not reference a table that
-- did not exist yet. The XOR check (commitment_id vs assignment_id) is already in place.
alter table progress_logs
  add constraint progress_logs_assignment_id_fkey
  foreign key (assignment_id) references assignments(id);

-- The Canvas feed URL is a capability secret: anyone holding it can read the whole
-- calendar. The Settings form must be able to show "set ✓" without the value ever being
-- sent to the browser, so the app reads this generated flag and never selects the URL
-- itself (implementation-plan.md 2.4, schema.md "secrets").
alter table settings
  add column if not exists canvas_ics_url_set boolean
  generated always as (canvas_ics_url is not null and length(canvas_ics_url) > 0) stored;
