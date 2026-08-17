# Homeroom — Coding Standards

The one structural law: **every file plays exactly one role.** A file is a repo file, a hook file,
or a UI file — never two of those. If you can't say which role a file is in one word, it's wrong.

---

## The Three Roles

### 1. Repo files — `src/features/<feature>/<feature>.repo.ts`
The **only** files that import `src/lib/supabase.ts`.

- Plain async functions. No React. No JSX. No `useState`, no imports from `react` at all.
- Every function returns `{ data, error }`. Never throws for expected failures.
- Every query filters `user_id = auth.uid()` explicitly (RLS is the backstop, not the plan).
- Every mutation of a feature's table lives here and **only** here — one write path.
- No formatting, no display strings, no date prettifying. Repos speak database.

```ts
// commitments.repo.ts — CORRECT
export async function logProgress(commitmentId: string, note?: string):
  Promise<{ data: ProgressLog | null; error: PostgrestError | null }> { ... }
```

### 2. Hook files — `src/features/<feature>/use<Feature>.ts`
The bridge. Imports the repo (never `supabase`). Imported by UI (which never imports the repo).

- Owns loading / error / data state and exposes typed actions.
- May compose repo calls (e.g. `logProgress` then refresh list) — that's orchestration, allowed.
- No JSX. No Tailwind classes. No direct DOM.
- No SQL-ish logic (filtering/sorting that belongs in the query goes in the repo; pure
  presentation-independent computation like attention scores goes in `src/lib/`).

### 3. UI files — `src/features/<feature>/*.tsx` and `src/components/*.tsx`
Render only.

- Import hooks and `src/lib/` helpers. **Never** import a repo file, never `supabase`.
- No business rules: a UI file may ask "is `status === 'stalled'`" to pick a style, but the
  decision of *what makes something stalled* lives in lib/repo.
- No data fetching, no `useEffect` that talks to the network.
- Formatting (dates, plurals, "3 days ago") happens here or in `src/lib/format.ts` — never in repos.

### Shared non-role files (the only exceptions)
- `src/lib/supabase.ts` — client creation only.
- `src/lib/auth.ts` — the only non-repo file allowed to touch supabase (session handling).
- `src/lib/attention.ts`, `src/lib/format.ts` — **pure functions only** (no I/O, no React, no
  supabase). Testable in isolation.
- `src/types/domain.ts` — every shared type, defined once. No type defined in two places.
- Edge Functions (`supabase/functions/*`) — server-side; they are their own world, use the
  service role, and duplicate *no* client code except types.

## Smell test — "is this file doing two roles?"
| Symptom | Verdict |
|---|---|
| A `.tsx` file with `supabase` or `.repo` in its imports | UI doing repo's job. Split. |
| A repo function returning `"3 days ago"` or a Tailwind class | Repo doing UI's job. Split. |
| A hook with JSX or a `className` | Hook doing UI's job. Split. |
| A `useEffect` in a component fetching data | UI doing hook's job. Move to the hook. |
| The same score/staleness formula written in two files | Neither's job. It goes in `src/lib/attention.ts`, imported by both. |

## Everything else (kept short deliberately)
- **TypeScript strict mode on; zero `any`** in committed code. `unknown` + narrowing if stuck.
- **Naming:** repo functions are verbs (`logProgress`, `markStalled`); hooks return objects with
  named actions, not positional arrays; components are nouns.
- **Timestamps** cross layers as ISO strings; `Date` objects only inside a single function scope.
- **No barrel files, no clever abstractions.** Three similar lines beat one premature helper.
  This app is small; keep it boring and greppable.
- **Verification is part of the change:** after a batch of edits run `npm run typecheck` and show
  the output. An ESLint `no-restricted-imports` rule enforces the import boundaries mechanically
  (configured in Phase 0) so role separation doesn't depend on memory.
