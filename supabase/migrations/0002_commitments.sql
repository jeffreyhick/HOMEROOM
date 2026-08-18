create table if not exists commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  name text not null,
  category text not null check (category in ('technical', 'career', 'personal', 'school')),
  color text not null,
  icon text not null default 'book',
  cadence_days int not null default 4,
  importance int not null default 2 check (importance between 1 and 3),
  last_progress_at timestamptz,
  status text not null default 'active' check (status in ('active', 'stalled', 'done', 'archived')),
  stalled_at timestamptz,
  context text,
  created_at timestamptz not null default now()
);

alter table commitments enable row level security;

create policy "commitments_owner" on commitments
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  commitment_id uuid not null references commitments(id),
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

alter table subtasks enable row level security;

create policy "subtasks_owner" on subtasks
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- assignments table + this FK land in 0003_assignments.sql; kept FK-less here per plan.
create table if not exists progress_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  commitment_id uuid references commitments(id),
  assignment_id uuid,
  note text,
  created_at timestamptz not null default now(),
  constraint progress_logs_xor_target check ((commitment_id is null) <> (assignment_id is null))
);

alter table progress_logs enable row level security;

create policy "progress_logs_owner" on progress_logs
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  action jsonb not null,
  source text not null check (source in ('voice', 'text')),
  status text not null default 'proposed' check (status in ('proposed', 'confirmed', 'rejected', 'expired')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table pending_actions enable row level security;

create policy "pending_actions_owner" on pending_actions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
