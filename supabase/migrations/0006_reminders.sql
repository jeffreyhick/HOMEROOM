-- Phase 3 — email reminders.
--
-- Numbered 0006, not 0004 as the plan originally said: 0005 is already applied on the
-- remote database, and `supabase db push` refuses a local migration that sorts before
-- the last applied one (it wants --include-all). Strictly increasing numbering keeps
-- every future push a plain `db push`. 0004 is simply never used.

create table if not exists reminders_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  kind text not null check (kind in ('deadline_36h', 'digest', 'stall_ping')),
  ref_id uuid,
  dedupe_key text not null unique,
  sent_at timestamptz not null default now()
);

-- The unique constraint is the entire safety mechanism: it is what makes an hourly cron
-- safe to run. No email is ever sent without its dedupe key being inserted first, so a
-- reminder can fire at most once however many times the function runs (schema.md).
alter table reminders_sent enable row level security;

create policy "reminders_sent_owner" on reminders_sent
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Hourly reminders at minute 10, ten minutes after the Canvas sync at minute 5, so a
-- deadline that arrived in this hour's feed can still raise its T-36h alert in the same
-- hour. Same Vault-at-run-time secrets as 0005; nothing secret lands in git.
--
-- Added here rather than by editing 0005, which is already applied — applied migrations
-- are immutable, changes are always a new file.
select cron.unschedule('send-reminders-hourly')
where exists (select 1 from cron.job where jobname = 'send-reminders-hourly');

select cron.schedule(
  'send-reminders-hourly',
  '10 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);
