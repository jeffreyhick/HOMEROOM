# Homeroom — Personal School Command Center

**Working title:** Homeroom (rename freely — nothing depends on the name yet).
**Owner/only user:** Jeffrey.
**Status:** Building. Phases 0–2 are written (auth shell, commitments core, Canvas sync);
Phase 3 (emails) is next. See [implementation-plan.md](implementation-plan.md) for what each
phase contains and [verification.md](verification.md) for the checks that need a live database.

---

## The App in One Paragraph

Homeroom is a single-user webapp that replaces scattered, unreliable self-admin (Canvas
checking, mental to-do lists, forgotten commitments) with one calm dashboard. It pulls every
assignment and deadline from Canvas automatically (read-only ICS feed — no manual entry,
no intervention), tracks non-school **commitments** (Space Grant, professor emails, internship
apps, personal technical projects) with a simple momentum measure, and ranks what most
needs attention *today* so a single glance answers "what should I work on right now?" It emails
a daily digest of things going stale and a non-negotiable alert 36 hours before every deadline —
so the system works even when Jeffrey doesn't open it. That is the core design constraint:
**the system must survive its owner not caring about it for two weeks.**

## Design Principles (in priority order)

1. **Survives neglect.** Canvas sync and reminder emails run server-side on a schedule. The
   app being ignored for a week must not make it wrong or silent.
2. **Zero-maintenance intake.** Deadlines appear without Jeffrey doing anything. Manual entry
   is reserved for commitments only, and updating one is a single tap.
3. **Glanceable, not exhaustive.** The dashboard shows minimal essential information —
   a ranked "needs attention" list, the next deadlines, commitment momentum. Detail exists
   only behind a deliberate click. No card soup.
4. **One write path, confirm before write.** Every mutation goes through the repo layer, and
   destructive/bulk changes preview before commit. This is also the socket for the future
   voice/NLU layer (preview → confirm).
5. **Boring technology, already known.** Same stack as the summer's work: React + TypeScript
   + Vite + Tailwind + Supabase + Vercel. Nothing new to learn, nothing exotic to maintain.

## What This Is Not

- Not a productivity methodology app. No projects/areas/labels taxonomy, no habit gamification.
- Not a Canvas replacement. Grades, submissions, and course content stay on Canvas.
- Not multi-user, not multi-tenant, not a product. One user, forever, by design.
  (If that ever changes, that's a new plan — don't pre-build for it.)

## Tech Stack (final — do not revisit)

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript on Vite, Tailwind CSS |
| Backend | Supabase (Postgres + Auth + Edge Functions + cron) — **new project, fully separate from VoiceCRM** |
| Canvas intake | Canvas personal calendar feed (ICS URL), fetched server-side by an Edge Function |
| Email | Resend (free tier) sent from Edge Functions |
| Hosting | Vercel |
| Auth | Supabase magic-link, restricted to one email address |
| Timezone | America/Denver everywhere deadline math happens |

## Doc Map

| Doc | Purpose |
|---|---|
| [implementation-plan.md](implementation-plan.md) | Phased build plan with verification checks per phase. Read before building anything. |
| [CLAUDE.md](CLAUDE.md) | The rulebook to copy into the repo root when the repo is created. Architecture invariants. |
| [schema.md](schema.md) | Database schema, RLS, and the ranking/momentum formulas. |
| [design.md](design.md) | Neumorphic light UI spec, app structure (pages/navbar/drawers), design tokens, progressive-disclosure rules. |
| [coding-standards.md](coding-standards.md) | One-role-per-file contract (repo / hook / UI) with smell tests. |
| [verification.md](verification.md) | The human half of each phase checklist — copy-pasteable SQL and click-throughs that need a live Supabase project. |
| **`mockup-dashboard-v3.html`** | **The visual target** — double-click to open in a browser (self-contained, no server). Working implementation of every screen: coloured status bar, hero dial strip, class colour/icon identity, countdowns, celebrations, gym strip, deadline windows, Study + Wins. **Port its CSS when building UI** — see design.md's fidelity contract. `-v2` (morph baseline) and `mockup-dashboard.html` (v1) are kept for history. Nothing persists in any mockup; reload resets. |

## Open Decisions (do not guess — ask Jeffrey)

| Question | When it matters |
|---|---|
| Final app name | Repo is `HOMEROOM` and the wordmark is "homeroom"; still open for the email sender name (Phase 3) |
| Resend sending domain: use resend.dev shared domain or a personal domain? | Phase 3 (emails land in inbox vs. spam folder) |
| Exact per-commitment cadence defaults (how many days of no progress = "going stale") | Phase 1; default proposal is in schema.md |
