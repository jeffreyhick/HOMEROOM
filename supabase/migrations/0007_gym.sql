-- Phase 4 — the one habit.
--
-- Homeroom tracks exactly one habit on purpose (design.md §gym). This table is
-- deliberately not a general habit engine: one row per day you went, nothing else.

create table if not exists gym_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  went_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, went_on)
);

-- "Going" is a single tap, and a double tap must not create a second row — the
-- uniqueness is what lets the pip be a pure toggle.
alter table gym_checkins enable row level security;

create policy "gym_checkins_owner" on gym_checkins
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
