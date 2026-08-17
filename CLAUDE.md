# Homeroom — Build Rulebook for Claude Code

> Copy this file to the repo root when the repo is created. Until then it lives with the
> planning docs. It is the always-loaded rulebook; heavier docs are linked at the bottom.

## The App in One Paragraph

Homeroom is Jeffrey's single-user school command center: Canvas assignments and deadlines
sync in automatically (read-only ICS feed, server-side), non-school **commitments** are tracked
with a momentum measure, a ranked **Needs Attention** list makes "what do I work on now?"
a glance, and scheduled emails (daily digest + non-negotiable T-36h deadline alerts) keep the
system working even when the app isn't opened. Design constraint number one: **the system
must survive its owner ignoring it for two weeks.** Full overview: [docs/README.md](docs/README.md).

## Tech Stack (final — do not suggest alternatives)

React + TypeScript on Vite, Tailwind CSS, Supabase (Postgres + Auth + Edge Functions + cron),
Resend for email, deployed on Vercel. Single user, single timezone (America/Denver).
**This project is fully separate from VoiceCRM: different repo, different Supabase project.
Never touch, reference, or reuse VoiceCRM code, config, or credentials.**

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build` (typechecks too) |
| `npm run typecheck` | `tsc -b` — run after every batch of edits |
| `npm run lint` | ESLint (includes the import-boundary rules) |
| `npm run test` | Vitest |

After a batch of edits, run `npm run typecheck` and show the output. Verify your own work.

## Architecture Rules (invariants, not preferences)

### Rule 1: One write path
Every mutation routes through one function in that feature's `*.repo.ts`. UI buttons, Edge
Functions acting on user data, and the future NLU layer all call the same repo functions.
Never add a second write path.

### Rule 2: Every file plays exactly one role — repo, hook, or UI
Only `*.repo.ts` files and `src/lib/auth.ts` import `src/lib/supabase.ts`. Components import
hooks, hooks import repos. No JSX outside UI files, no fetching inside UI files, no formatting
inside repos. Full contract + smell tests: [docs/coding-standards.md](docs/coding-standards.md).
ESLint `no-restricted-imports` enforces the boundaries — never disable that rule to "just ship."

### Rule 3: Sync never destroys manual state
Canvas sync upserts by `canvas_uid` and updates `title`/`due_at` only. It never overwrites
`status`, `last_touched_at`, or anything Jeffrey set by hand, and it never deletes rows.
A re-sync must always be safe to run twice.

### Rule 4: No email without a dedupe key
Every outbound email first inserts its `dedupe_key` into `reminders_sent` (unique constraint).
The insert failing = the email already went = skip silently. This is what makes hourly crons safe.

### Rule 5: Secrets stay server-side
The Canvas ICS URL and Resend API key exist only in Supabase (settings row / function secrets).
Never in client code, never in git, never in Vercel env, never logged. The browser never fetches
Canvas directly — Edge Functions only.

### Rule 6: Confirm before destruction, frictionless everything else
Archive/dismiss confirm inline. Log-progress and mark-done commit instantly with an undo
toast. Never add confirmation friction to the hero action (logging progress); never remove it
from destructive ones. Future NLU actions go through `pending_actions` preview → confirm
and then call the normal repo function — the NLU layer proposes, it never writes.

### Rule 7: Formulas live in one place
Attention score, staleness ratio, and streaks are implemented once in `src/lib/attention.ts`
(pure functions, unit-tested) and imported everywhere they're shown or emailed. If the
dashboard and the digest ever disagree about what's "behind," this rule was broken.

### Rule 8: Types defined once
All shared types in `src/types/domain.ts`. Never redefine a shape locally.

## Cross-cutting invariants

- **Dates:** `timestamptz` in Postgres, ISO strings across layers, formatted only in UI /
  `src/lib/format.ts`. All "due soon / stale / digest day" bucketing in **America/Denver**.
- **Every repo function returns `{ data, error }`**; always check `error` first.
- **RLS on every table** (`user_id = auth.uid()`) even though there's one user — the anon key
  is public. Repos still filter `user_id` explicitly; RLS is the backstop.
- **Derived, never manual:** progress bars and study dials are computed from records
  (subtasks, study_sessions, logs) — there is no manually-set percentage or gauge anywhere.
- **Dashboard information budget** (top-5 Needs Attention, 7-day deadlines, no charts/tiles)
  is an invariant, not a styling choice: [docs/design.md](docs/design.md). When adding a feature,
  the default location for its UI is the detail drawer, not the dashboard.

## Reference Docs

| Doc | Read it when |
|---|---|
| [docs/README.md](docs/README.md) | Product overview, principles, open decisions |
| [docs/implementation-plan.md](docs/implementation-plan.md) | What to build, in what order, with per-phase verification |
| [docs/schema.md](docs/schema.md) | Writing a repo query, sync logic, email rules, or the formulas |
| [docs/coding-standards.md](docs/coding-standards.md) | Writing any file — role separation contract |
| [docs/design.md](docs/design.md) | Building any UI — neumorphic spec + layout + drawer actions |

## Open Questions — do not guess, ask Jeffrey

Listed in [docs/README.md](docs/README.md#open-decisions-do-not-guess--ask-jeffrey).
