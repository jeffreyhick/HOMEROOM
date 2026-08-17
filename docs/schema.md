# Homeroom — Schema & Formulas

Postgres on Supabase. All timestamps are `timestamptz`. All deadline *display and bucketing*
math uses **America/Denver**. When the repo exists, `supabase/migrations/` becomes the
source of truth for DDL; this doc explains the model.

---

## Security model (read first)

Single user, but the Supabase anon key is public in the browser, so the database still defends
itself:

- Every table has `user_id uuid not null default auth.uid()` referencing `auth.users`.
- RLS enabled on every table: `user_id = auth.uid()` for select/insert/update/delete.
- Signups disabled in Supabase Auth after Jeffrey's account exists (or restricted to his email).
- The Canvas ICS URL and the Resend API key are **secrets**: they live only in Supabase
  (settings row / Edge Function secrets). They never appear in client code, git, or Vercel env.
  The ICS URL grants read access to the whole Canvas calendar — treat it like a password.

---

## Tables

### `settings` — one row
| Column | Type | Notes |
|---|---|---|
| `id` | `boolean` PK, default `true`, CHECK `(id)` | Enforces a single row |
| `user_id` | `uuid` | RLS anchor |
| `canvas_ics_url` | `text` | Secret. Only Edge Functions read it (service role). |
| `notify_email` | `text` | Where reminders go |
| `digest_hour_local` | `int` default `7` | Daily digest send hour, America/Denver |
| `deadline_alert_hours` | `int` default `36` | The non-negotiable pre-deadline alert window |
| `stale_deadline_days` | `int` default `4` | Assignment untouched this long + due soon → digest |
| `gym_days` | `int[]` default `'{}'` | Target weekdays for the gym habit, `0`=Sun…`6`=Sat (design.md §gym). Empty = habit off. The digest nudges on these days. |
| `left_off_note` | `text` nullable | The dashboard "where you left off" card (design.md §leftoff). One global note, autosaved on blur. |
| `left_off_at` | `timestamptz` nullable | When `left_off_note` was last written; drives the `noted 2d ago` line. |

### `assignments` — synced from Canvas, plus manual extras
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` | RLS |
| `canvas_uid` | `text` unique nullable | ICS `UID`. **Upsert key** for sync. `null` = manually added |
| `course` | `text` | Parsed from ICS event (e.g. "ECEN 2250") |
| `title` | `text` | |
| `due_at` | `timestamptz` | |
| `status` | `text` CHECK in (`upcoming`,`done`,`dismissed`) | `done`/`dismissed` are set manually and **survive re-sync** |
| `is_exam` | `boolean` default `false` | Marks exams/midterms/finals. Drives the status bar's "next exam" (design.md §statusbar) and the `EXAM` tag on deadline rows. Set from the ICS event (Canvas category/keywords) or by hand; a hand-set value **survives re-sync**. |
| `last_touched_at` | `timestamptz` nullable | Set when Jeffrey marks progress on it; drives staleness |
| `first_seen_at` / `last_synced_at` | `timestamptz` | Sync bookkeeping |

Sync rules (Edge Function `sync-canvas`):
1. Fetch ICS server-side, parse VEVENTs with due dates.
2. Upsert by `canvas_uid`: update `title`, `due_at`, `last_synced_at`. **Never overwrite `status`, `last_touched_at`, or a hand-set `is_exam`.** (Sync may *set* `is_exam` from ICS keywords on first insert, but a manual flag wins.)
3. If a previously synced `upcoming` assignment disappears from the feed and is >7 days past due, leave it; it ages out of views naturally. No deletes during sync — sync never destroys manual state.

### `commitments` — everything that isn't a Canvas deadline
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` | RLS |
| `name` | `text` | "Space Grant", "Email professors", "Rocket sim" |
| `category` | `text` CHECK in (`technical`,`career`,`personal`,`school`) | For grouping only, not hierarchy |
| `color` | `text` | Class-identity colour — a hex from the design.md §identity palette (chosen to avoid the status hues). Renders as the row glyph tint + name colour. |
| `icon` | `text` default `'book'` | Key into the shared `ICONS` map (design.md §identity) — `rocket`, `satellite`, `mail`, `code`, … Inline SVG, never emoji. |
| `cadence_days` | `int` default `4` | Expected max gap between progress logs |
| `importance` | `int` CHECK 1–3, default `2` | 3 = high. Multiplies the attention score |
| `last_progress_at` | `timestamptz` nullable | **Denormalized** copy of the latest log's time, maintained by `logProgress`/`resume` in the repo (one write path keeps it honest). Exists so dashboard/digest queries never need a group-by over logs. `progress_logs` stays the durable record. |
| `status` | `text` CHECK in (`active`,`stalled`,`done`,`archived`) | |
| `stalled_at` | `timestamptz` nullable | Set when marked stalled; drives the 7/14/21-day reminder rule |
| `context` | `text` nullable | Freeform notes shown in the expanded view. Never required, never nagged about |
| `created_at` | `timestamptz` | |

### `subtasks` — a commitment's next actions
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` | RLS |
| `commitment_id` | `uuid` FK not null | |
| `title` | `text` | |
| `done` | `boolean` default false | |
| `created_at` / `done_at` | `timestamptz` (`done_at` nullable) | Display order = `created_at`; no manual reorder in MVP |

Rules: **toggling a subtask to done also inserts a `progress_log`** (note = subtask title) and
bumps `last_progress_at` — one repo function does all three writes (one write path). Commitment
progress = `count(done)/count(*)` — **derived, never stored, no manual progress control exists**.
Un-toggling deletes nothing from the log (history is append-only).

### `courses` — split across two phases
**Phase 2** creates this table with its *identity* columns only (`id`, `user_id`, `code`, `color`,
`icon`), because the class colour/icon system (design.md §identity) is needed as soon as
assignments render, and `sync-canvas` auto-creates a row per new course code anyway.
**Phase 5** *alters* it to add `priority` and `weekly_goal_minutes` (marked below).
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` | RLS |
| `code` | `text` unique | Matches `assignments.course` exactly; rows auto-created by `sync-canvas` upsert when a new course code appears |
| `color` | `text` | Class-identity colour (design.md §identity). Drives the course glyph everywhere its assignments appear, **and** the segment colour in the cumulative hero dial (§hero). Auto-assigned from the palette when the course is created; editable. |
| `icon` | `text` default `'book'` | Key into the shared `ICONS` map. Auto-assigned, editable. |
| `priority` | `int` CHECK 1–3, default `2` | *(Phase 5)* Feeds the assignment score multiplier |
| `weekly_goal_minutes` | `int` nullable | *(Phase 5)* Null = no goal = no dial (opt-in, shame-free) |

### `study_sessions` — Phase 5
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` | RLS |
| `course_id` | `uuid` FK not null | |
| `minutes` | `int` CHECK > 0 | Quick-add increments; never a timer |
| `studied_on` | `date` | Denver-local date, defaults to today |
| `created_at` | `timestamptz` | |

Dial fraction = `sum(minutes where studied_on in current Mon–Sun Denver week) / weekly_goal_minutes`, clamped to 1.
The **cumulative hero dial** (design.md §hero) is the same math summed across courses, with each
course's share drawn as its own colour segment.

### `gym_checkins` — the one habit (design.md §gym)
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` | RLS |
| `went_on` | `date` | Denver-local date you went. **Unique per user** — one row per day; tapping a done pip deletes it (toggle). |
| `created_at` | `timestamptz` | |

The dashboard strip compares this week's `went_on` dates against `settings.gym_days`. There is
deliberately no general habit table — the app tracks exactly one habit.

### `progress_logs` — append-only momentum record
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` | RLS |
| `commitment_id` | `uuid` FK nullable | Exactly one of these two FKs is set |
| `assignment_id` | `uuid` FK nullable | (CHECK constraint enforces XOR) |
| `note` | `text` nullable | Optional one-liner ("finished problems 1–3") |
| `created_at` | `timestamptz` | |

Logging progress on an assignment also updates `assignments.last_touched_at` (in the same
repo function — one write path, but the log is the durable record).

### `reminders_sent` — email dedupe ledger
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` | RLS |
| `kind` | `text` CHECK in (`deadline_36h`,`digest`,`stall_ping`) | |
| `ref_id` | `uuid` nullable | The assignment/commitment concerned (null for digest) |
| `dedupe_key` | `text` unique | e.g. `36h:<assignment_id>`, `digest:2026-09-14`, `stall:<id>:14` |
| `sent_at` | `timestamptz` | |

**Invariant: no email is ever sent without first inserting its `dedupe_key`.** The unique
constraint is what makes an hourly cron safe — a reminder can fire at most once no matter
how many times the function runs.

### `pending_actions` — future NLU socket (create the table now, no UI writes it yet)
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` | RLS |
| `action` | `jsonb` | `{ "fn": "logProgress", "args": {...} }` — names a repo function + args |
| `source` | `text` CHECK in (`voice`,`text`) | |
| `status` | `text` CHECK in (`proposed`,`confirmed`,`rejected`,`expired`) | |
| `created_at` / `resolved_at` | `timestamptz` | |

The contract: a future NLU layer may only *propose* rows here; executing a confirmed action
calls the **same repo function** the buttons call. The NLU layer never gets its own write path.

---

## Formulas (documented here, implemented in one place: `src/lib/attention.ts`)

### Staleness (commitments)
`days_since_last_log / cadence_days` → ratio. `1.0` = exactly at cadence, `2.0` = twice as
overdue. No log ever → treat `days_since_last_log` as days since `created_at`.

### Needs Attention score (the ranked list on the dashboard)
Computed client-side from fetched rows — no AI, no magic, fully explainable:

- **Assignment** (status `upcoming`):
  `score = 100 / max(hours_until_due / 24, 0.25)` → due in 6h ≈ 400, 1 day = 100, 4 days = 25.
  If also stale (`last_touched_at` older than `stale_deadline_days` and due ≤ 7 days): `score × 1.5`.
  Past due and not done: pinned to top, flagged, not scored.
  *(Phase 5, once `courses` exists:)* multiply by course priority — `×0.8` (1), `×1.0` (2), `×1.2` (3);
  neutral `×1.0` until then and for unknown courses.
- **Commitment** (status `active`):
  `score = 20 × staleness_ratio × importance`. Below `staleness_ratio 1.0` → excluded (on pace
  = invisible; the list only ever shows things that are behind).
- **Stalled commitments** never appear in Needs Attention. They resurface only via the
  7/14/21-day email pings and in their own collapsed dashboard section.

Dashboard shows the **top 5** by score. Never more. Ties: earlier `due_at` first.

### Momentum display (per commitment)
Two numbers only: `last touched N days ago` + current streak (consecutive 7-day windows,
ending now, containing ≥1 log). No charts on the dashboard.

### Countdown label (design.md §countdown)
From `hours_until_due`: `< 0` → `OVERDUE` (red); same Denver day → `DUE TODAY` (red); next day →
`DUE TOMORROW` (**amber**, deliberately not red); else `round(hours/24) days left` (amber ≤2d,
secondary beyond). Fully derived — no stored field.

### Next exam (design.md §statusbar)
The soonest `assignments` row with `is_exam = true`, `status = 'upcoming'`, `due_at` in the future.
Always shown in the status bar, even weeks out, with `in Nd` (amber ≤7d, red ≤2d). Derived.

### Semester wins count (design.md §hero, §wins)
The split-flap counter is a plain count of finished things this term:
`count(assignments where status = 'done') + count(subtasks where done) + count(gym_checkins)`,
scoped to the current semester. **Derived, never stored** — the counter reads it live. Every
celebration (a subtask check, a gym tap, an assignment marked done) already writes one of those
rows, so the number and the confetti can never disagree.

### Email rules (Edge Function `send-reminders`, hourly cron)
1. **T-36h non-negotiable** (`deadline_36h`): assignment `upcoming` and `due_at` within the
   next `deadline_alert_hours` and no `36h:<id>` dedupe key → send individual email, record key.
   Hourly cron + "within the window" predicate means a deadline synced late (e.g. professor
   posts it 20h out) still gets its alert immediately on next run.
2. **Daily digest** (`digest`, at `digest_hour_local` America/Denver, key `digest:<local-date>`):
   sections — overdue assignments; assignments due ≤ 7 days with `last_touched_at` staler than
   `stale_deadline_days`; active commitments with `staleness_ratio ≥ 1.0`; stall pings due today
   (rule 3); **a gym nudge** when today is in `settings.gym_days` and no `gym_checkins` row exists
   for today (design.md §gym). **If every section is empty, no email is sent.** Silence means
   "you're on pace."
3. **Stall pings** (`stall_ping`): commitment `stalled` and `now - stalled_at ≥ 7×k` days with no
   `stall:<id>:<k>` key → include in that day's digest (not a separate email), record key.
