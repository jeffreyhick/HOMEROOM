# Verification runbook

The checklists in [implementation-plan.md](implementation-plan.md) say *what* must be true.
This says exactly what to type. Everything here needs a live Supabase project and your
login, so none of it can be run by an agent — it is the human half of each phase.

Run SQL in the Supabase dashboard → **SQL Editor**. Nothing below writes to Canvas, and
nothing below needs your Canvas feed URL except where it says so.

---

## 0. Apply the migrations first

Nothing else works until the tables exist.

```bash
supabase db push
```

Expect `0001` … `0005` to apply in order. Then confirm RLS is on everywhere — this query
must return **zero rows**:

```sql
select tablename
from pg_tables
where schemaname = 'public'
  and tablename in ('settings','commitments','subtasks','progress_logs','pending_actions','assignments','courses')
  and not rowsecurity;
```

---

## Phase 1 — Commitments core

### 1. Seed the real commitments (UI)

Dashboard → **+ Add commitment**, four times:

| Name | Category | Cadence | Importance |
|---|---|---|---|
| Space Grant | technical | 4 | high |
| Rocket sim | technical | 4 | high |
| Email professors | career | 7 | medium |
| Internship apps | career | 7 | medium |

Each should land with its own colour and glyph, assigned round-robin.

### 2. Ranking — does the attention formula actually order things?

Backdate progress so the three cases are unambiguous:

```sql
update commitments set last_progress_at = now() - interval '9 days' where name = 'Space Grant';
update commitments set last_progress_at = now() - interval '5 days' where name = 'Rocket sim';
update commitments set last_progress_at = now() - interval '1 day'  where name = 'Email professors';
```

Reload the dashboard. **Needs attention** must show Space Grant *above* Rocket sim, and
**Email professors must not appear at all**.

Why those three: score is `20 × staleness × importance`. Space Grant is 9/4 = 2.25 stale
→ 135. Rocket sim is 5/4 = 1.25 → 75. Email professors is 1/7 = 0.14, under 1.0, so it
scores 0 and is excluded. If the order comes out differently, the formula is wrong, not
the data.

Check the scores yourself if it looks off:

```sql
select name, cadence_days, importance,
       round(extract(epoch from (now() - coalesce(last_progress_at, created_at))) / 86400 / cadence_days, 2) as staleness,
       round(20 * (extract(epoch from (now() - coalesce(last_progress_at, created_at))) / 86400 / cadence_days) * importance) as score
from commitments where status = 'active' order by score desc;
```

### 3. Stall and resume (UI)

Open Rocket sim → **Mark stalled**. It must leave Needs attention and appear in the
`1 stalled ›` line at the bottom. Open it from there → **Resume**. It returns to active
*and* writes a fresh log:

```sql
select c.name, p.note, p.created_at
from progress_logs p join commitments c on c.id = p.commitment_id
order by p.created_at desc limit 5;
```

The newest row should be `resumed`.

### 4. Subtasks write three things at once (UI + SQL)

Open Space Grant, add three next steps, tick one. The progress groove reads `1/3`, and
the card behind it resets to `0d`. Confirm the log was written too:

```sql
select s.title, s.done, s.done_at,
       (select count(*) from progress_logs p where p.note = s.title) as log_rows
from subtasks s order by s.created_at;
```

Now **un-tick** it. The groove returns to `0/3` and `done_at` clears — but `log_rows`
stays 1. History is append-only; un-ticking is not an eraser.

### 5. Confirmation and undo (UI)

- **Archive** must relabel itself to `Archive — sure?` in place rather than opening a
  dialog, and must disarm itself after ~4 seconds if you walk away.
- **Log progress** commits instantly and drops an undo toast. Press **Undo** inside 4.5s
  and confirm the previous timestamp came back:

```sql
select name, last_progress_at from commitments order by name;
```

### 6. Morph and persistence (UI)

At a desktop width, a commitment card should *become* the detail panel rather than being
replaced by one. Narrow the window to 375px and reopen — same content, now a bottom
sheet. Type into **Context**, click away, reload the page: the text survives.

### 7. Round-trip speed

Log progress on the deployed app, not localhost. Card to updated dashboard should be
**under 2 seconds**. This is the one number the whole system lives on.

### 8. RLS proof — without creating a second account

This impersonates a different signed-in user inside one transaction, which is a stronger
check than signing out and cheaper than making a throwaway account:

```sql
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select 'commitments' as t, count(*) from commitments
union all select 'assignments', count(*) from assignments
union all select 'subtasks',    count(*) from subtasks
union all select 'settings',    count(*) from settings;

rollback;
```

Every count must be **0**. Any non-zero row is a policy hole — stop and fix it before
shipping anything else.

---

## Phase 2 — Canvas sync

### 1. Get the feed URL (browser)

Canvas (`canvas.colorado.edu`) → **Calendar** → scroll the right sidebar to the bottom →
**Calendar Feed** → copy the `.ics` URL.

Paste it **only** into the app's Settings form. Not into chat, not into a commit, not
into an env file. Anyone holding that URL can read your whole Canvas calendar; Canvas has
a **Reset** button beside the link if it ever leaks.

### 2. Deploy the function and its secret

```bash
supabase functions deploy sync-canvas
```

```bash
openssl rand -hex 32
```

Take that value and use it in **both** places so the cron job and the function agree:

```bash
supabase secrets set CRON_SECRET=<the value>
```

```sql
select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
select vault.create_secret('<the same value>', 'cron_secret');
```

### 3. First sync (UI)

Settings → paste the feed URL → **Save** → the label flips to `Canvas feed set ✓` →
**Sync now**. It should report `Synced N deadlines`. The dashboard now shows real
courses, real titles, and Denver-local due times.

### 4. The secret really is write-only

Reload Settings. The input is empty and shows only `set ✓`. Confirm the URL never reached
the browser at all — in DevTools → Network, open the `settings` request and search the
response for `feeds/calendars`. **No match** is the pass condition.

### 5. Sync is idempotent

Hit **Sync now** twice more, then:

```sql
select count(*) as rows, max(last_synced_at) as synced_at from assignments;
```

`rows` must not change between runs. Only `synced_at` moves.

### 6. Manual state survives re-sync

Mark an assignment **done** in the UI, then corrupt its title and due date the way a
Canvas edit would, and re-sync:

```sql
update assignments
set title = 'STALE TITLE', due_at = due_at + interval '3 days'
where status = 'done'
returning id, canvas_uid, title, status;
```

**Sync now**, then check the same row: `title` and `due_at` are corrected back from the
feed, and `status` is **still `done`**. That separation is the entire point of the upsert
column list — sync owns the facts, you own the state.

### 7. A broken feed must not destroy data

Save an obviously bad URL in Settings (e.g. `https://example.com/nope.ics`), then
**Sync now**. Expect `Sync failed: canvas responded 404`, the TopBar to read **sync
failed** in amber, and every stored deadline to still be on screen. Then paste the real
URL back.

### 8. The browser never talks to Canvas

DevTools → Network → filter `instructure`, then `canvas`. Reload and sync. **Zero
requests.** All Canvas traffic happens inside the Edge Function.

And nothing leaked into the repo or the bundle:

```bash
npm run build && git grep -iE "instructure|feeds/calendars" -- . ':!docs' ; grep -rilE "instructure|feeds/calendars" dist/ || echo "clean"
```

Column and identifier names like `canvas_ics_url` are fine. A real URL is not.

### 9. The function rejects strangers

```bash
curl -i -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/sync-canvas"
```

Expect **401**. Now with the shared secret:

```bash
curl -i -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/sync-canvas" -H "x-cron-secret: <the value>"
```

Expect **200** and a `{"synced":N}` body.

### 10. The hourly job is really scheduled

```sql
select jobname, schedule, active from cron.job;
```

`sync-canvas-hourly` at `5 * * * *`, active. After the next hour rolls over, confirm it
actually ran:

```sql
select status, return_message, start_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'sync-canvas-hourly')
order by start_time desc limit 5;
```

---

## If something fails

Function logs are the fastest way in:

```bash
supabase functions logs sync-canvas
```

The parser is unit-tested against real feed shapes
(`supabase/functions/sync-canvas/ics.test.ts`) — run `npm run test` before suspecting it.
If a specific assignment is missing, the usual causes are that it has **no due date set**
in Canvas (the feed omits those) or that its UID is not an `event-assignment-` event.
