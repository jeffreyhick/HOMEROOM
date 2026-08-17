create table if not exists settings (
  id boolean primary key default true,
  user_id uuid not null default auth.uid() references auth.users(id),
  canvas_ics_url text,
  notify_email text,
  digest_hour_local int not null default 7,
  deadline_alert_hours int not null default 36,
  stale_deadline_days int not null default 4,
  gym_days int[] not null default '{}',
  left_off_note text,
  left_off_at timestamptz,
  constraint settings_single_row check (id)
);

alter table settings enable row level security;

create policy "settings_owner" on settings
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
