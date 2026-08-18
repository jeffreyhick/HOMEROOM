-- Hourly Canvas sync. Phase 3 adds a second job (reminders) at minute 10.
--
-- The URL and the cron secret are read from Vault **at job run time**, not baked into
-- this file, so no secret ever lands in git and this migration is safe for `db push`
-- exactly as written. Create the two secrets once, from the SQL editor:
--
--   select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
--   select vault.create_secret('<openssl rand -hex 32>',            'cron_secret');
--
-- The same random value goes to the function as an env secret, so it can compare:
--   supabase secrets set CRON_SECRET=<same value>
--
-- Until both secrets exist the job is scheduled but its run fails harmlessly; the
-- dashboard keeps rendering stored rows either way.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-running this migration against a database that already has the job must not fail.
select cron.unschedule('sync-canvas-hourly')
where exists (select 1 from cron.job where jobname = 'sync-canvas-hourly');

select cron.schedule(
  'sync-canvas-hourly',
  '5 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/sync-canvas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);
