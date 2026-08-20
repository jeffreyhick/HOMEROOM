# Homeroom — Implementation Plan (execution-grade)

This plan is written to be executed by an AI agent (Sonnet 5) **without interpretation**.
Where a choice existed, it has been made here. If something is genuinely underspecified,
STOP and ask Jeffrey — do not invent.

Conventions in this doc:
- **🧑 JEFFREY** = human step (dashboards, accounts, secrets). The agent prompts for these and waits.
- **🤖 AGENT** = agent step.
- Every phase ends with a verification checklist. **Do not start phase N+1 until phase N's checklist passes.** Commit after each passing checklist.
- Phases 0–4 are the MVP. Phase 5 (courses & study) is **gated** on dogfood evidence; Phase 6 is explicitly later.
- Companion docs are law: [CLAUDE.md](CLAUDE.md) (rules), [schema.md](schema.md) (DDL + formulas), [coding-standards.md](coding-standards.md) (file roles), [design.md](design.md) (UI + app structure), **`mockup-dashboard-v3.html` (the visual target)**.

> **The mockup is not optional reading.** `mockup-dashboard-v3.html` is a working, self-contained
> implementation of every screen in this plan — open it in a browser before writing any UI. For
> each component you build, **open the mockup, find that component, and port its actual CSS/SVG/
> timings** (see design.md's *fidelity contract*). Do not re-derive neumorphic styling from prose:
> from-scratch attempts consistently come out flat and muddy, and the mockup already solved the
> carved grooves, the FLIP morph, the dial arc math, and the countdown tiering. Port the CSS,
> geometry and interaction rules — **not** the mockup's in-memory arrays or direct-DOM `renderX()`
> functions, which become React + hooks + `*.repo.ts` here.

---

## Phase 0 — Skeleton & rails

### 0.1 🧑 Accounts & names
1. Confirm final app name (docs use `homeroom`; substitute everywhere if changed).
2. Create GitHub repo `homeroom` (private). Create a **new** Supabase project (region: US West/Denver-adjacent). Not the VoiceCRM org/project.
3. Provide to agent: Supabase project URL + anon key. (Service role key is **never** given to the client app; it's only used inside Edge Functions where Supabase injects it.)

### 0.2 🤖 Scaffold
```bash
npm create vite@latest homeroom -- --template react-ts
cd homeroom && npm i react-router-dom @supabase/supabase-js
npm i -D tailwindcss @tailwindcss/vite vitest eslint typescript-eslint @eslint/js
```
- Tailwind v4 style: add `@tailwindcss/vite` plugin to `vite.config.ts`; `@import "tailwindcss";` at top of `src/index.css`.
- `tsconfig`: `"strict": true`, path alias `@/* → src/*` (mirror the alias in `vite.config.ts` via `resolve.alias`).
- `package.json` scripts: `dev`, `build` (`tsc -b && vite build`), `typecheck` (`tsc -b`), `lint` (`eslint .`), `test` (`vitest run`).
- `.env.local` (gitignored): `VITE_SUPABASE_URL=…`, `VITE_SUPABASE_ANON_KEY=…`. Confirm `.gitignore` covers `.env*`.
- Copy the planning docs into `docs/`; `CLAUDE.md` to repo root.

### 0.3 🤖 Folder tree (create now, empty files where needed — this exact tree)
```
src/
├── main.tsx            # ReactDOM bootstrap only
├── App.tsx             # Router + auth gate (session ? routes : LoginPage)
├── index.css           # tailwind import + design tokens (design.md §tokens)
├── types/domain.ts     # ALL shared types
├── lib/
│   ├── supabase.ts     # createClient from env — nothing else
│   ├── auth.ts         # session hook + signInWithOtp + signOut (may import supabase)
│   ├── attention.ts    # pure formulas (schema.md §formulas) — no I/O
│   ├── attention.test.ts
│   └── format.ts       # pure display helpers (relativeDays, formatDue, denverToday)
├── components/         # role: UI. TopBar, ExpandedPanel (morph/bottom-sheet shell), StatusDot,
│                       # ConfirmInline, UndoToast, ClassTag (+icons.ts), Countdown,
│                       # StatusBar, LeftOffCard, Celebration (burst/pop/finale)
├── pages/              # role: UI. LoginPage, DashboardPage, SettingsPage
└── features/
    ├── commitments/    # commitments.repo.ts, useCommitments.ts, CommitmentCards.tsx,
    │                   # CommitmentExpanded.tsx, StalledLine.tsx
    ├── assignments/    # assignments.repo.ts, useAssignments.ts, DeadlineList.tsx,
    │                   # DeadlinesExpanded.tsx, AssignmentExpanded.tsx
    ├── attention/      # NeedsAttentionList.tsx (UI only — imports lib/attention)
    ├── gym/            # gym.repo.ts, useGym.ts, GymStrip.tsx            (Phase 4)
    ├── wins/           # wins.repo.ts, useWins.ts, WinCounter.tsx (split-flap),
    │                   # WinsExpanded.tsx, flaps.ts (shared roll logic)  (Phase 4)
    ├── courses/        # courses.repo.ts, useCourses.ts, StudyExpanded.tsx,
    │                   # CourseDial.tsx, CumulativeStudyDial.tsx         (Phase 5)
    └── settings/       # settings.repo.ts, useSettings.ts, SettingsForm.tsx
supabase/
├── migrations/         # 0001_settings.sql … 0008_study.sql (0004 is skipped; schema.md is the DDL spec)
└── functions/
    ├── sync-canvas/index.ts
    └── send-reminders/index.ts
```

### 0.4 🤖 ESLint import boundaries (`eslint.config.js`)
Flat config, three `no-restricted-imports` blocks — copy this logic exactly:
```js
// 1. Global default: nothing may import the supabase client…
{ files: ['src/**/*.{ts,tsx}'],
  rules: { 'no-restricted-imports': ['error',
    { paths: [{ name: '@/lib/supabase', message: 'Only *.repo.ts and lib/auth.ts (Rule 2).' }],
      patterns: [{ group: ['**/*.repo'], message: 'Repos are imported only by hooks (use*.ts).' }] }] } },
// 2. …except repos and auth (allow supabase, still forbid cross-repo imports):
{ files: ['src/**/*.repo.ts', 'src/lib/auth.ts'],
  rules: { 'no-restricted-imports': ['error',
    { patterns: [{ group: ['**/*.repo'], message: 'Repos do not import other repos.' }] }] } },
// 3. …and hooks (allow repos, still forbid supabase):
{ files: ['src/**/use*.ts'],
  rules: { 'no-restricted-imports': ['error',
    { paths: [{ name: '@/lib/supabase', message: 'Hooks call repos, never supabase (Rule 2).' }] }] } },
```

### 0.5 🧑 Supabase Auth setup
1. Dashboard → Auth → Providers: Email ON, magic link (OTP) flow; disable password signups.
2. Sign in once from the deployed/local app (step 0.7) to create the user, then Dashboard →
   Auth → Settings → **disable new user signups**.
3. Auth → URL Configuration: add `http://localhost:5173` and the Vercel URL to redirect allow-list.

### 0.6 🤖 Migration `0001_settings.sql`
DDL exactly per [schema.md](schema.md#tables) `settings` table — **including the v3 columns
`gym_days int[]`, `left_off_note text`, `left_off_at timestamptz`** — plus:
`alter table settings enable row level security;` and one policy
`for all using (user_id = auth.uid()) with check (user_id = auth.uid())`.
Apply via `supabase db push` (🧑 Jeffrey links the project: `supabase link --project-ref <ref>` — needs his login).

### 0.7 🤖 Auth gate + shell
- `lib/supabase.ts`: `export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)` — 5 lines max.
- `lib/auth.ts`: `useSession()` (subscribes to `onAuthStateChange`), `signInWithEmail(email)` → `supabase.auth.signInWithOtp`, `signOut()`.
- `App.tsx`: if no session → `LoginPage`; else `BrowserRouter` with routes `/` → `DashboardPage`, `/settings` → `SettingsPage` (design.md §pages).
- `LoginPage`: per design.md §pages. `DashboardPage`: TopBar + empty column placeholder. `SettingsPage`: TopBar + sign-out button (form comes in Phase 2).

### 0.8 🧑→🤖 Deploy
Jeffrey connects the repo to Vercel (framework: Vite). Env vars in Vercel: the two `VITE_*` values only. Agent confirms build passes.

### ✅ Phase 0 checklist
- [ ] `npm run typecheck && npm run lint && npm run build && npm run test` all clean
- [ ] Deployed URL: signed-out shows login only; magic link signs Jeffrey in; a second email cannot sign up
- [ ] Boundary proof: temporarily add `import '@/lib/supabase'` to `DashboardPage.tsx` → `lint` fails; add `import '../features/commitments/commitments.repo'` to a `.tsx` → fails; revert both
- [ ] `settings` has RLS enabled (Supabase table editor shows the shield)
- [ ] `git grep -i "service_role\|ics"` → no hits

---

## Phase 1 — Commitments core

### 1.1 🤖 Migration `0002_commitments.sql`
Four tables exactly per schema.md: `commitments` (including the denormalized
`last_progress_at timestamptz`, `context text`, and the v3 identity columns
`color text` + `icon text default 'book'` — design.md §identity), `subtasks`, `progress_logs` (with the XOR CHECK
`(commitment_id is null) <> (assignment_id is null)` — note `assignments` FK is added in 0003;
in 0002 create `progress_logs.assignment_id uuid` without FK, add the FK constraint in 0003),
`pending_actions`. RLS on all three, same single policy pattern as 0001.

### 1.2 🤖 `types/domain.ts`
Define and export: `Commitment`, `NewCommitment` (name, category, cadence_days?, importance?),
`ProgressLog`, `PendingAction`, `Settings`, and (Phase 2) `Assignment`. Field names/types mirror
the DDL 1:1, timestamps as `string` (ISO). Plus `AttentionItem`:
```ts
export type AttentionItem =
  | { kind: 'assignment'; score: number | 'overdue'; item: Assignment }
  | { kind: 'commitment'; score: number; item: Commitment };
```

### 1.3 🤖 `commitments.repo.ts` — exact function set
Every function: explicit `.eq('user_id', user.id)` (get user via `supabase.auth.getUser()`),
returns `{ data, error }`.
```ts
listCommitments(includeArchived = false)                    // order: name asc
createCommitment(input: NewCommitment)
updateCommitment(id: string, patch: Partial<Pick<Commitment,'name'|'category'|'cadence_days'|'importance'>>)
logProgress(commitmentId: string, note?: string)
   // 1) insert progress_logs  2) update commitments.last_progress_at = now, status → 'active' if 'stalled'
markStalled(id: string)      // status='stalled', stalled_at=now
archive(id: string)          // status='archived'
markDone(id: string)         // status='done'
listLogs(sinceIso: string)   // all logs (both FKs) since date — feeds streaks
updateContext(id: string, context: string)
listSubtasks(commitmentId: string)          // order created_at asc
addSubtask(commitmentId: string, title: string)
toggleSubtask(id: string)    // done → also insert progress_log(note=title) + bump last_progress_at
                             // un-done → just flip the flag (logs are append-only, never deleted)
deleteSubtask(id: string)
```

### 1.4 🤖 `lib/attention.ts` — pure, exact signatures
Implement the formulas from [schema.md §formulas](schema.md#formulas) with these signatures
(every function takes `now: Date` — never call `Date.now()` inside):
```ts
stalenessRatio(lastProgressAt: string | null, createdAt: string, cadenceDays: number, now: Date): number
commitmentScore(c: Commitment, now: Date): number        // 0 when ratio < 1 or status !== 'active'
assignmentScore(a: Assignment, staleDeadlineDays: number, now: Date): number | 'overdue' | 0
needsAttention(assignments: Assignment[], commitments: Commitment[], settings: Pick<Settings,'stale_deadline_days'>, now: Date): AttentionItem[]
   // overdue pinned first (earlier due_at first), then score desc, ties by earlier due_at/created_at; slice(0,5)
weeklyStreak(logIsoDates: string[], now: Date): number   // consecutive 7-day windows ending now, each with ≥1 log
```
`attention.test.ts` must cover at minimum: never-logged commitment uses `created_at`; ratio
exactly 1.0 excluded (`< 1` → 0, `≥ 1` → included); importance multiplies; stalled/done/archived
score 0; assignment due in 6h ≈ 400 and 4 days = 25; stale×1.5 multiplier applies only when due
≤ 7 days; overdue pinned above any score; top-5 cap; streak: logs 3 and 9 days ago → 2, no logs → 0.

### 1.5 🤖 `useCommitments.ts`
State: `{ commitments, loading, error }`; loads on mount. Actions (each calls repo, then
refreshes list optimistically): `create`, `update`, `logProgress(id, note?)`, `markStalled`,
`resume(id)` (= `logProgress(id, 'resumed')`), `archive`, `markDone`. Exposes `undoableAction`
wrapper used by UI for the undo toast (buffer the previous row, expose `undo()` for 5s).

### 1.6 🤖 UI (all per design.md: §zones, §identity, §expanded, §drawer-actions, §tokens)
Build the shared **`ClassTag`** component first (design.md §identity): a bounded neumorphic tile
holding an inline-SVG icon tinted by the item's `color`, plus the `ICONS` map — port both from the
mockup (`tagEl` / `ICONS`). Every row and card uses it; **never emoji.**
Also build **`LeftOffCard`** (design.md §leftoff) reading/writing `settings.left_off_note` —
inset panel, click-to-edit textarea, autosave on blur.
`CommitmentCards` (desktop card grid: class glyph + dot + name + `Nd` + `3/5`; phone chips), `StalledLine`,
and `CommitmentExpanded` — the expand-in-place morph view (design.md §expanded):
header/meta/progress-groove/context field (autosave on blur)/subtask checklist (toggle =
auto-log)/recent 5 logs/actions row (Archive uses `ConfirmInline`). Shared `ExpandedPanel`
shell component owns the morph (desktop) / bottom sheet (phone), ✕ + backdrop + Esc close.
Wire into `DashboardPage` zones 4–5.

### 1.7 🧑 Seed real commitments via the UI
Space Grant (technical, cadence 4, importance 3) · Rocket sim (technical, 4, 3) ·
Email professors (career, 7, 2) · Internship apps (career, 7, 2).

### ✅ Phase 1 checklist
- [ ] `npm run test`: all attention cases above green; `typecheck`/`lint` clean
- [ ] Create → log progress → strip shows "0d", green dot
- [ ] SQL-backdate `last_progress_at` −9 days on a cadence-4 commitment → appears in Needs Attention above a −5-day one; on-pace commitment absent
- [ ] Stall → leaves attention list, joins stalled line; Resume → active with fresh log
- [ ] Archive requires inline confirm; Log progress commits instantly + undo toast works (undo restores prior `last_progress_at`)
- [ ] Add 3 subtasks, check one → progress groove shows 1/3 **and** a progress_log row exists with the subtask title **and** the card's `Nd` resets to 0d; un-check → groove 0/3, log row remains
- [ ] Expanded view morphs open/closed from the card (desktop) and renders as bottom sheet at 375px; context text survives reload
- [ ] Log-progress round trip ≤ 2s on deployed app
- [ ] Temp second user sees zero rows (RLS proof); delete temp user after

---

## Phase 2 — Canvas sync

### 2.1 🧑 Canvas feed + settings
Canvas (canvas.colorado.edu) → Calendar → **Calendar Feed** → copy the `.ics` URL.
Do not paste it into chat/git — paste it only into the app's Settings form (2.4).

### 2.2 🤖 Migration `0003_assignments.sql`
`assignments` per schema.md + RLS — **including `is_exam boolean default false`** (design.md
§statusbar) — unique index on `canvas_uid` (where not null); add the deferred FK
`progress_logs.assignment_id → assignments(id)`.

Also create **`courses` with its identity columns only** (`id`, `user_id`, `code` unique, `color`,
`icon`) + RLS. Rationale: rows are auto-created by `sync-canvas` as course codes appear, and the
class colour/icon system (design.md §identity) is needed from Phase 2 onward — assignment rows are
unscannable without it. Phase 5 *alters* this table to add `priority` and `weekly_goal_minutes`;
it does not create it. Assign `color`/`icon` round-robin from the design.md §identity palette on
insert; both stay user-editable.

### 2.3 🤖 Edge Function `sync-canvas` (Deno, service role)
Auth gate, first thing: accept iff (a) `x-cron-secret` header equals `CRON_SECRET` env, **or**
(b) the `Authorization: Bearer <jwt>` resolves via `supabase.auth.getUser(jwt)` to the app's
user. Otherwise 401.
Algorithm:
1. Service-role client reads `settings.canvas_ics_url`. Missing → 200 `{skipped:'no url'}`.
2. `fetch` the ICS, 10s timeout. Non-200/network fail → 502 `{error}`, **do not** modify data.
3. Unfold RFC 5545 line folding (a line starting with space/tab appends to the previous line, minus the leading whitespace). Split into `BEGIN:VEVENT…END:VEVENT` blocks.
4. Per block extract `UID`, `SUMMARY`, and date: prefer `DTSTART`. Two forms:
   `DTSTART:20260914T235900Z` → parse as UTC instant; `DTSTART;VALUE=DATE:20260914`
   (all-day) → interpret as **23:59:59 America/Denver** on that date.
5. Keep only blocks whose UID starts with `event-assignment-` (Canvas assignment events; plain calendar events are out of scope).
6. Parse SUMMARY `"Title [COURSE]"`: course = last `[...]` group's contents, title = the rest trimmed. No bracket group → course `"Canvas"`, title = whole SUMMARY. Unescape ICS `\,` `\;` `\n`.
7. Upsert by `canvas_uid`: **update only** `title`, `course`, `due_at`, `last_synced_at`; new rows get `status='upcoming'`, `first_seen_at=now`, `user_id` = the single user's id (service-role reads it from `settings.user_id`). Never touch `status`/`last_touched_at`; never delete (CLAUDE.md Rule 3).
8. Return `{ synced: <count>, at: <iso> }`.

### 2.4 🤖 Settings feature
`settings.repo.ts`: `getSettings()`, `upsertSettings(patch)`, `triggerSync()` →
`supabase.functions.invoke('sync-canvas')` (invoke lives in a repo — Rule 2 applies to functions
too). `SettingsForm`: notify email, digest hour (0–23), stale threshold days, and the ICS URL as a
**write-only** field — shows `Canvas feed: set ✓` when present, never echoes the stored value;
typing a new one overwrites.

**Write-only means the value never reaches the browser at all**, not just that the input is
blank. Two things enforce that: `0003` adds a generated column
`settings.canvas_ics_url_set boolean` (`canvas_ics_url is not null and length(…) > 0`), and
`getSettings()` selects an **explicit column list** that omits `canvas_ics_url`. A `select('*')`
here would ship the feed secret on every dashboard load. The write side takes a
`SettingsPatch`, which allows `canvas_ics_url` in and never reads it back; saving other
fields omits the key entirely so an existing feed can't be blanked by accident.

### 2.5 🤖 Assignments feature + dashboard wiring
`assignments.repo.ts`: `listAssignments()` (status `upcoming` or done/dismissed within last 7 days;
order `due_at` asc), `markDone(id)`, `dismiss(id)`, `reopen(id)`,
`logAssignmentProgress(id, note?)` (insert log + set `last_touched_at`).
`useAssignments.ts`: loads, exposes actions, and fire-and-forgets `triggerSync()` on mount —
render stored rows immediately, refresh when sync resolves; sync failure = console-quiet, data
stays. `DeadlineList` (deadlines zone) + `AssignmentExpanded` per design.md (the windowed
`DeadlinesExpanded` lands in Phase 4). Assignments join `needsAttention` input in `DashboardPage`.
TopBar shows "synced Nm ago" from max `last_synced_at`.

Two v3 components land here, both ported from the mockup:
- **`Countdown`** (design.md §countdown, mockup `countdownEl`) — the bold right-aligned label on
  every deadline row, tiered `OVERDUE`/`DUE TODAY` red · `DUE TOMORROW` amber · `N days left`,
  with the literal date/time as a sub-line. Unit-test the tier boundaries (Denver-local).
- **`StatusBar`** (design.md §statusbar, mockup `renderStatus`) — replaces the flat status line:
  full-width, not a card, colour-coded counts, plus the **next exam** (soonest `is_exam` upcoming
  row) always shown with an urgency-tiered `in Nd`. Deadline rows carry an `EXAM` tag.
Assignment rows render `ClassTag` + a course kicker tinted with the course's `color`.

### 2.6 🤖 Migration `0005_cron.sql` — hourly sync (see also 3.3)
Enable `pg_cron` + `pg_net`. Schedule at minute 5.

The project URL and cron secret are read from **Vault at job run time**, never written
into the migration. That keeps the secret out of git *and* leaves the file safe to apply
with `supabase db push` as-is — a migration carrying `<PLACEHOLDER>` text would abort the
push and block every later migration behind it.

```sql
select cron.schedule('sync-canvas-hourly', '5 * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/sync-canvas',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb);
$job$);
```

🧑 Jeffrey creates the two Vault secrets once from the SQL editor and sets the matching
function secret, so the job and the function agree on the same value:

```sql
select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
select vault.create_secret('<openssl rand -hex 32>',            'cron_secret');
```
```bash
supabase secrets set CRON_SECRET=<the same random value>
```

The migration is idempotent (it unschedules an existing job of the same name first).
Until both Vault secrets exist the job is scheduled but its run fails harmlessly —
the dashboard keeps rendering stored rows regardless.

### ✅ Phase 2 checklist
- [ ] Real assignments render with correct course/title and Denver-local due times
- [ ] Sync twice consecutively → row count and `updated` fields identical (idempotent)
- [ ] Mark done → re-sync → still done; SQL-change a `due_at` upstream-style → sync corrects it, `status` untouched
- [ ] Break the ICS URL in settings → sync returns 502, dashboard still renders stored data
- [ ] DevTools network: zero client requests to any canvas/instructure host
- [ ] `git grep -iE "instructure|ics_url|feeds/calendars"` → only docs/code identifiers, no real URL; bundle (`dist/`) grep too
- [ ] Cron: `select * from cron.job;` shows the job; next hour's run bumps `last_synced_at`
- [ ] Unauthenticated `curl` to the function URL → 401; with `x-cron-secret` → 200

---

## Phase 3 — Emails

### 3.1 🧑 Resend
Create account → API key → `supabase secrets set RESEND_API_KEY=…`. Decide sender: default
`onboarding@resend.dev` works but may spam-fold; a personal domain is the fix if so (open
decision). Set `notify_email` in Settings.

### 3.2 🤖 Migration `0006_reminders.sql`
`reminders_sent` per schema.md; unique constraint on `dedupe_key`; RLS.

**Numbered 0006, not 0004.** `0005` was already applied to the remote database at the end
of Phase 2, and `supabase db push` refuses a local migration that sorts *before* the last
applied one — it demands `--include-all`. Keeping the numbers strictly increasing keeps
every future push a plain `db push`. `0004` is simply never used, and Phase 4/5 shift to
`0007_gym.sql` and `0008_study.sql`.

### 3.3 🤖 Edge Function `send-reminders` (service role; same auth gate as sync-canvas)
Runs hourly at minute 10 — ten minutes after the Canvas sync, so a deadline that arrived
in this hour's feed can still raise its T-36h alert in the same hour. The job is scheduled
**in `0006`, not by editing `0005`**: applied migrations are immutable, and changes are
always a new file. Order of operations is law:
**insert dedupe key first; on unique-violation skip; send email only after successful insert.**
1. Load settings, assignments (`upcoming`), commitments, and today's Denver date via
   `Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver'})` → `YYYY-MM-DD`.
2. **T-36h alerts**: assignments with `due_at ≤ now + deadline_alert_hours` and `due_at > now`.
   For each: try insert `dedupe_key = '36h:'+id` → on success send individual email.
   Subject: `Due in ~<h>h: <course> — <title>`. Body: title, course, due (Denver, human), one
   link to the app URL. Plain text.
3. **Digest** (only when Denver hour == `digest_hour_local`): try insert `digest:<denver-date>`;
   on success compose sections — (a) overdue `upcoming` assignments; (b) due ≤7d with
   `last_touched_at` null-or-older than `stale_deadline_days`; (c) active commitments with
   `stalenessRatio ≥ 1` (port the formula — a tiny `_shared/attention.ts` in the functions dir
   mirroring `src/lib/attention.ts`; keep the two files line-for-line comparable, Rule 7).
   The duplication is **verified, not trusted**: `_shared/attention.test.ts` runs both the
   client and server implementations over the same grid of cadences, importances, staleness
   values, and statuses, and fails the build the moment they disagree;
   (d) stall pings: stalled commitments where `floor((now−stalled_at)/7d) = k ≥ 1` and
   `stall:<id>:<k>` inserts successfully. **All sections empty → delete the digest dedupe row
   and send nothing.** Subject: `Homeroom — <n> behind, <m> due in the next 7 days`
   (the plan originally said "due this week"; the function counts a rolling seven days
   rather than the status bar's Monday–Sunday week, and the subject says what it counts
   instead of mirroring the week-bounds helper into the function runtime).
   Section composition lives in a pure `_shared/digest.ts` — `buildDigest()` returns
   `null` for a clean day — so the "silent when there is nothing to say" rule is unit
   tested rather than discovered in a real inbox at 7am.
4. Send via `fetch('https://api.resend.com/emails', …)`; non-2xx → log, leave dedupe row
   (better one missed email than spam-on-retry — deliberate).

### ✅ Phase 3 checklist
- [ ] Seed assignment due in 30h → next run sends exactly one alert; invoke function 3× more → zero repeats
- [ ] Digest at digest hour with correct sections; a clean day sends nothing (verify dedupe row also absent)
- [ ] Stall + backdate `stalled_at` 8 days → ping in next digest; backdate 15 → second ping (`k=2`), never repeats a `k`
- [ ] **Kill test**: 48h without opening the app across a T-36h boundary → alert arrived on time
- [ ] Emails land in inbox (not spam) — else escalate the sending-domain decision
- [ ] Dashboard "behind" list and digest section (c) agree on the same seeded data (Rule 7)

---

## Phase 4 — Ranking, polish, dogfood

### 4.1 🤖 Needs Attention final + Deadlines window view
`NeedsAttentionList`: rows = status dot + `ClassTag` + coloured course kicker + title +
`Countdown`; overdue rows flagged `OVERDUE`; row click → the item's detail view. Empty state:
"Nothing behind. Go live your life."

Plus **`DeadlinesExpanded`** (design.md §deadlines-expanded): clicking the Deadlines panel (not a
row) morphs it open. Three requirements that are easy to get wrong:
1. **Window selector** — segmented `Next 24h · 3 days · 1 week · 2 weeks · 4 weeks · All`,
   **defaulting to Next 24h**; overdue always shown regardless; selection persists for the session.
2. **Fixed body height** — measure the tallest window's content once and lock `min-height` to it,
   so changing the window **never resizes the panel**. Resizing on switch is jarring and was
   explicitly rejected; leftover whitespace is the intended "you're caught up" signal.
3. **Time-ordered day groups** — group in encounter order over hours-sorted rows, not a fixed
   weekday array, or a 2-week window renders next Monday above this Friday.

### 4.2 🤖 Visual pass + the v3 feel-good layer
Implement design.md §tokens exactly (CSS custom properties in `index.css`); apply raised/inset
shadows, radii, type scale. Verify AA contrast for every text style against `#EDF0F4`
programmatically (vitest on token pairs with a contrast function — not by eye).

Then build the v3 layer that makes the app pleasant rather than purely a debt list. **Port each
from `mockup-dashboard-v3.html`; do not improvise the CSS.**

1. 🤖 Migration `0007_gym.sql`: `gym_checkins` per schema.md (unique `went_on` per user) + RLS.
2. 🤖 **`GymStrip`** (design.md §gym) + the Settings day picker writing `settings.gym_days`.
   Tapping a pip toggles today's check-in — the one dashboard element with a direct action.
3. 🤖 **`Celebration`** (design.md §celebration): the `checkpop` on checkboxes, the spark burst
   (capture the source rect *before* re-render), and the 100% finale ring + trophy banner. All
   three gated on `prefers-reduced-motion`.
4. 🤖 **`HeroStrip`** (design.md §hero), the sanctioned exception to the no-stat-tiles rule:
   - **`CumulativeStudyDial`** — the segmented semicircle. Ships only when Phase 5 exists; until
     then the left hero panel is absent and the right panel spans the row.
   - **`WinCounter`** — the split-flap, from a derived `semesterDone` count (schema.md). Shared
     `buildFlaps` logic powers both this and the Wins screen. Rolls once on mount, silent after;
     Replay re-rolls and must `stopPropagation` so it doesn't open the panel.
   - **`WinsExpanded`** — the big board + the reserved placeholder for later dials.
5. 🤖 Verify: nothing animates unprompted except the counter's one roll on load.

### 4.3 🤖 Phone + manifest
`public/manifest.webmanifest` (name, `display: standalone`, theme `#EDF0F4`, two placeholder
icons 192/512). Bottom-sheet drawer < 768px; all tap targets ≥ 44px. No service worker/offline —
explicitly out of MVP.

### 4.4 🧑 Dogfood week
One full week of real use before school. Rule: **fix friction, add nothing.** Log every moment
of "I didn't check it / I didn't trust it / updating felt like work" and fix only those.

### ✅ Phase 4 checklist
- [ ] Dashboard zones match design.md §zones exactly — status bar, hero strip, left-off, Needs Attention, Deadlines, Commitments, gym, stalled — and **nothing else** (no third stat tile)
- [ ] Deadlines window: switching 24h ↔ 2 weeks leaves panel height **unchanged**; overdue always shown; groups chronological
- [ ] Status bar shows the next exam even when it is >1 week out; tier colours correct at 8d/7d/2d
- [ ] Countdown tiers correct across a Denver midnight boundary (unit-tested, not eyeballed)
- [ ] Every course/commitment renders a distinct colour+icon; no emoji anywhere in the UI
- [ ] Checking a subtask pops + sparks; completing the last one fires the finale ring + banner; all silent under `prefers-reduced-motion`
- [ ] Gym: tapping a target pip records a check-in, undo works, digest nudge fires only on a target day with no check-in
- [ ] Win counter rolls exactly once on load, not on every re-render; Replay works and does not open the Wins panel
- [ ] Seeded ranking scenario (overdue HW + due-tomorrow HW + ratio-2.25 commitment + ratio-1.5 commitment + on-pace commitment) renders in hand-computed order; on-pace invisible
- [ ] Contrast tests green; detail views at 375px wide fully usable one-handed
- [ ] Deadlines panel click → This Week (grouped by day, overdue pinned); assignment row → detail → back returns to This Week
- [ ] Lighthouse (deployed): installable, no console errors
- [ ] End of dogfood week: zero missed deadlines, zero incorrect data moments — else fix before school

---

## Phase 5 — Courses & study dial (GATED)

**Gate: build only after the Phase 4 dogfood week shows real, sustained use of log-progress.**
This is the only feature that adds a new recurring manual-logging habit; it is earned, not
assumed. If the gate isn't met, skip — the app's #1 job (never miss a deadline) doesn't need it.

1. 🤖 Migration `0008_study.sql`: **ALTER** `courses` (created in Phase 2 with identity columns)
   to add `priority int default 2` + `weekly_goal_minutes int null`; CREATE `study_sessions` per
   schema.md, RLS. Do not re-create `courses`.
2. 🤖 `sync-canvas` already inserts course rows (Phase 2); confirm new codes default to
   priority 2 / no goal.
3. 🤖 `courses.repo.ts`: `listCourses()`, `updateCourse(id, {priority?, weekly_goal_minutes?})`,
   `logStudy(courseId, minutes)`, `listStudySessions(weekStartIso)`. `useCourses.ts` hook.
4. 🤖 **`StudyExpanded`** with per-course dials + quick-log buttons, exactly per design.md
   §study-expanded. Dial is an SVG semicircle with the masked carved groove (§dial); needle
   rotation = clamped week fraction, 300ms ease-out. Port the SVG wholesale from the mockup —
   note filter/mask ids must be suffixed per course or the last dial's filters win globally.
5. 🤖 Enable the **`CumulativeStudyDial`** in the hero strip (design.md §hero): one semicircle
   whose arc is split into per-course colour segments via `stroke-dasharray`/`dashoffset`, using
   each course's `color`. Clicking it opens `StudyExpanded`.
6. 🤖 `attention.ts`: apply the course-priority multiplier (×0.8/1.0/1.2) with unit tests;
   unknown/absent course = ×1.0.

### ✅ Phase 5 checklist
- [ ] New course code in feed → `courses` row auto-appears; no goal → no dial, no red state
- [ ] Set goal 9h, log +30m/+1h → dial needle and `Xh / 9h` update; sum resets Monday Denver (SQL-backdate a session to last week → excluded)
- [ ] Priority 3 course's assignment outranks an identical priority-1 assignment (test + visual)
- [ ] Quick-log round trip ≤ 2s with undo toast; no timer anywhere

---

## Phase 6 — Explicitly later
Canvas API token (auto-done on submit) · NLU voice layer via `pending_actions` (socket built) ·
Sunday-reset guided view · push notifications. **Nothing here gets built until the MVP habit
is real.**
