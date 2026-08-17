# Homeroom — Design Spec

White, clean, classy, sleek, **light-mode neumorphic** dashboard. This doc exists mostly to
prevent the two default AI-dashboard failure modes: card soup, and low-contrast mush.

> ## Fidelity contract — read this before building any screen
>
> The visual target is **`mockup-dashboard-v3.html`** in this folder. It is not a sketch; it is this
> spec made real, and it works (open it in any browser — no server, no build). **The shipped React
> app must match it, not approximate it.**
>
> **How to build a component:** open the mockup, find that component, and **port its actual CSS
> and geometry** — the exact shadow pairs, radii, the dial's masked-groove SVG, the FLIP morph
> math, the celebration keyframe timings, the split-flap roll curve. Do **not** re-derive something
> "close" from prose. Every hard problem here is already solved in that file: carved neumorphic
> grooves that don't turn to mush, legible contrast on a soft surface, the morph that doesn't
> distort, the segmented arc math, the countdown tiering.
>
> **Why this contract exists:** a from-scratch neumorphic guess consistently looks *far* worse than
> the mockup — flat cards, muddy shadows, wrong radii, no depth. The mockup is the quality bar.
> If a screen you build looks worse than the mockup, the answer is not "tune it," it is "go copy
> the mockup's CSS."
>
> **Precedence:** treat each `§` section below as the *why* and the *behaviour*; treat the mockup
> as the *exact how*. Where they disagree: **the mockup wins on look, this doc wins on behaviour.**
>
> **Do not port:** the mockup's in-memory arrays, its `renderX()`/`buildX()` direct-DOM functions,
> or its facade Settings page. Those become React components + hooks + `*.repo.ts` calls. Port the
> *CSS, SVG, geometry, timings, and interaction rules* — not the plumbing.
>
> **Do not copy its field names either.** Having no database, the mockup uses display-shaped
> shorthand (`exam`, `days`, `hours`, `touchedDays`, `loggedMin`, `goalMin`) where the real app uses
> the schema.md columns (`is_exam`, `last_progress_at`, `due_at`, `last_touched_at`, `minutes`,
> `weekly_goal_minutes`). **schema.md is the naming authority**; the mockup is the *look* authority.

> **Version note.** This doc describes the **v3** interface: the dashboard opens with a coloured
> status bar and a hero dial strip, every list row carries a class-colour icon and a bold countdown,
> finishing things celebrates, and the gym habit is tracked. `mockup-dashboard-v2.html` (the morph
> baseline) and `mockup-dashboard.html` (v1) are kept for history; **v3 is the target.**

---

## The Anti-Card-Soup Rules (non-negotiable)

1. **The dashboard answers one question:** "what needs my attention right now?" Everything
   on it serves that. Anything that doesn't is a click away, not on screen.
2. **Hard information budget.** The main dashboard, top to bottom (v3 order):
   - **Status bar** — date + this-week load + behind count + next exam, one coloured line (§statusbar)
   - **Hero dial strip** — cumulative study dial *(Phase 5)* + semester win counter (§hero); see rule 3
   - **Left-off card** — one line of "where you stopped," so re-entry is never cold (§leftoff)
   - **Needs Attention** — the ranked list, top 5 max (formula in schema.md)
   - **Upcoming deadlines** — next 7 days, one line each: class glyph · course · title · countdown
   - **Commitments** — desktop: a grid of small cards (glyph + dot + name + `Nd` + `3/5`); phone: quiet chips
   - **Gym strip** — the one habit, this week's target days as tappable pips (§gym)
   - Stalled commitments: a single collapsed line ("2 stalled ›"), not a section
3. **No stat tiles, no KPI row, no charts — with ONE deliberate exception: the hero dial strip.**
   The ban on feel-good chrome holds everywhere *except* the two dials at the very top, and that
   exception is a considered product decision, not drift: a dashboard that is nothing but a list of
   what you owe is quietly demoralising (especially with ADHD), so the app earns the right to also
   *show progress* — but only as **two** visual objects, at the top, each one click from its full
   screen. The cumulative study dial and the split-flap win counter are that entire budget. Do not
   add a third tile, a KPI row, a greeting, or motivational copy. Momentum everywhere else is still
   a number and a dot. (Per-course study dials still live only inside the expanded Study view; the
   collapsed dashboard shows the single cumulative dial.)
4. **Detail only on deliberate click.** Clicking any item opens its **detail view** (expand-in-place
   morph on desktop, bottom sheet on phone — §expanded): full info + that item's action
   buttons. Actions never clutter the list rows; rows are for reading.
5. **Empty states are quiet.** Nothing needs attention → the list says "Nothing behind. Go live
   your life." and that section shrinks. Empty ≠ placeholder cards.

## Neumorphic, done legibly

Neumorphism's known failure is contrast. Split the roles: **surfaces are soft, information is sharp.**

- **Surfaces** (background, panels, buttons): neumorphic. Base `#EDF0F4` (cool off-white),
  raised elements use the dual shadow — light top-left `#FFFFFF`, dark bottom-right
  `rgba(163,177,198,0.6)` — soft blur, generous radius (14–20px). Pressed/active state inverts
  to inset shadows. Panels are large and few (the 4 zones above), never per-item cards.
- **Text & status: full contrast, always.** Primary text near-black `#1D2530` (≥ WCAG AA on the
  base), secondary `#5B6472` minimum — never lighter. Urgency/status conveyed by weight +
  a small solid dot (overdue red `#D64545`, due-soon amber `#E09A2F`, on-pace green `#3E9B6B`),
  never by tinting whole rows.
- **One accent color** (pick at Phase 4 — suggest a deep slate blue `#3D5A80`) for interactive
  affordances only. If everything is accented, nothing is.
- **Type:** one family (Inter or General Sans), 3 sizes total on the dashboard (title / row / meta).
  Tabular numerals for dates and counts.
- **Motion:** 150–200ms ease-out on detail-view + press states. Nothing animates unprompted —
  with two named exceptions: the win counter rolls once on load (§hero) and finishing something
  celebrates (§celebration).

### Class identity: colour + icon {#identity}

Monochrome neumorphism has one real failure for a list app: every row looks identical, so nothing
is scannable. v3 fixes that by giving **every course and every commitment its own colour and
icon** — without breaking the status system. The split is strict:

- **Identity = a bounded glyph.** Each course/commitment gets a small rounded-square neumorphic
  tile (`.tag`, 30px; `.tag-sm` 24px on cards) holding a hand-authored **inline SVG icon** stroked
  in the item's colour, plus a faint `inset` ring in that colour at 40%. The short course label
  beside it (`ECEN 2250`) is tinted the same. That's the whole treatment: a glyph and a short
  label, both bounded. **Icons are inline SVG, never emoji** — emoji render inconsistently across
  platforms and read as toy-like. A shared `ICONS` map holds ~14 geometric glyphs (zap, triangle,
  flame, wave, rocket, satellite, mail, briefcase, code, book, flask, dumbbell, trophy, grad); each
  item picks one by key.
- **Status is still only red/amber/green**, still only a dot or a countdown's weight — never a
  class colour. Class colours are picked to **avoid the status hues** (no greens, no pure reds or
  ambers), so a teal wave-icon can never be misread as "on pace." A row can carry both a status
  dot (how urgent) and a class glyph (which class) because they differ in size and in job.
- **Still not a row tint.** The colour lives in the glyph and the short label only; the row surface
  stays neutral. The "never tint a whole row" rule holds.
- Class colour/icon are **data, not code**: a `color` and `icon` column per course/commitment
  (schema.md), set once when the item is created. Never hard-code a course→colour map in a
  component. (The mockup uses a `COURSE_META` literal purely because it has no database.)

### Surface states {#states}

Neumorphism only has two real depths — raised and inset — so hover has to be earned rather
than invented. The rule: **an element hovers toward the depth it will land on when pressed.**

| Element | Rest | Hover | Active / pressed |
|---|---|---|---|
| Panel (clickable, e.g. Deadlines) | raised | raised, larger blur | — |
| Commitment card | raised (small) | raised (full) + `translateY(-1px)` | inset |
| List row inside a panel | flat | **inset** (a soft groove opens under it) | — |
| Button / gear / ✕ | raised (small) | raised (full), text → primary | inset + `translateY(1px)` |
| Subtask checkbox | raised (small) | — | checked = inset + green check |
| Chip | raised (small) | raised (full) | — |

Rows are the interesting case: they have no rest-state surface at all, so hovering *sinks* them
into a groove. That gives a clear affordance without adding a per-item card, which rule 2
forbids. Never signal hover with a background tint — tint is reserved, and status is never
carried by row colour.

### Accessibility & motion {#a11y}

Not optional, and cheap if done from the start:

- Every interactive element is a real `<button>`; nothing important is a click handler on a
  `<div>`. Panels that are clickable get `role="button"` + `tabindex="0"` + Enter/Space.
- Visible focus everywhere: `:focus-visible` → 2px `--accent` outline, 3px offset. Neumorphic
  surfaces have low edge contrast, so an invisible focus ring is a real navigation dead end.
- Opening a detail view moves focus to its ✕; closing returns focus to the element that opened
  it. Overlay carries `role="dialog"` + `aria-modal="true"`.
- Status dots are decorative — `aria-hidden`. The urgency is already in the text
  ("due tomorrow 11:59 PM"), which is why colour is never the only channel.
- Toggles expose state: checkboxes `aria-pressed`, the stalled line `aria-expanded`.
- Honour `prefers-reduced-motion: reduce` — collapse every transition to ~1ms and skip the
  morph entirely (render the panel in place). The interface must stay fully usable, just still.

## App structure — pages & navigation {#pages}

Three routes. That is the whole app. There is deliberately no tab bar, no sidebar, no
hamburger — one page matters and the other two are utilities.

| Route | Page | Purpose |
|---|---|---|
| `/login` (implicit: any route while signed out) | **LoginPage** | Centered neumorphic panel: wordmark, email input, "Send link" button, "Check your email" state. Nothing else. |
| `/` | **DashboardPage** | The app. The zones below + detail views. |
| `/settings` | **SettingsPage** | Notify email, digest hour, stale threshold, **gym days** (§gym), Canvas feed URL (write-only: shows "set ✓", never echoes the secret), sign out. Single column, same width as dashboard. |

**TopBar (both signed-in pages), 56px:**
- Left: wordmark ("homeroom", lowercase, medium weight, near-black). Clicking it goes to `/`.
- Right: sync indicator ("synced 12m ago" — secondary text, quiet; "sync failed" in amber
  if last attempt errored) + a gear icon → `/settings`. **Nothing else.** Sign-out lives on the
  Settings page, not the bar.

**Dashboard zones, top to bottom (fixed order, the information budget above is the law):**
1. **Status bar** (§statusbar) — one full-width coloured line: date + this-week load + behind + next exam.
2. **Hero dial strip** (§hero) — cumulative study dial + semester win counter, side by side.
3. **Left-off card** (§leftoff) — one editable line of "where you stopped."
4. **Needs Attention** — ranked top-5 (formula in schema.md). Row = status dot + **class glyph** + coloured course kicker + title + **bold countdown** (§countdown). Overdue rows carry an `OVERDUE` tag. Click → that item's detail view.
   The course prefix is a kicker *inline* with the title, not a column — this zone is ranked, so
   rows deliberately do **not** align tabularly with each other.
5. **Deadlines — next 7 days** — one line each: `class glyph · course · title · countdown`.
   Collapsed preview shows the **3 soonest** and **excludes overdue** — an overdue assignment is
   already pinned atop Needs Attention, and repeating it spends budget on something already said.
   The full set lives in the Deadlines window view (§deadlines-expanded).
6. **Commitments** — desktop: card grid, collapsed card = class glyph + dot + name + `Nd` + `3/5` subtasks. Phone: quiet chips. Click → expanded view (§expanded).
   Use `repeat(auto-fit, minmax(215px, 1fr))` so the 720px column yields **2 per row**; 3 only
   if the column ever widens. Prefer 2 over 3 — with 4 commitments a 3-wide grid leaves a
   lone orphan card on row 2, which reads as a layout bug.
7. **Gym strip** (§gym) — the one habit: this week's target days as tappable pips.
8. **Stalled line** — single collapsed line `2 stalled ›`, expands in place to chips.

**Detail views:** on desktop (≥768px) every detail is an **expand-in-place morph** (§expanded) — the drawer pattern is retired on desktop. On phone, the same content renders as a full-height bottom sheet (200ms ease-out, backdrop closes). One detail view open at a time; Esc always closes.

### Status bar {#statusbar}

Full-width, spanning the same width as the panels below, and deliberately **not a card** — no
shadow, no box. The point is a light, colourful header line, not another surface. One flex row that
wraps on narrow widths:

`Tuesday, Sep 15 · [book] 3 deadlines this week · [flame] 1 thing behind · [grad] Thermodynamics Midterm 1 in 8d`

(the bracketed items are small inline-SVG icons). **Colour does the work here** — this line was
previously one flat grey sentence and read as bland:
- **date** — primary text, weight 700
- **deadline count** — `--accent`, weight 700, with an accent book icon
- **behind count** — `--status-red`, with a red flame icon; when zero, collapses to a green
  `on pace` instead
- **next exam** — the exam's **class colour** on a grad-cap glyph, the name in primary text, and an
  urgency-tiered `in 8d` (neutral → amber ≤7d → red ≤2d)
- **separators** — small round dots (`.sb-sep`), not slashes or pipes

Definitions, so the bar can't drift from the list beneath it:
- **deadlines this week** = `upcoming` assignments inside the calendar week, not yet past due.
- **behind** = deadlines actually *missed*. A commitment past its cadence is **not** "behind" — it
  is "needs attention," the list right below; counting it here double-reports the same thing.
- **next exam** = soonest upcoming assignment flagged `is_exam` (schema.md). Exams also appear in
  the deadline lists with an `EXAM` tag, but the bar surfaces the next one *always*, even weeks
  out, because that's the thing a student most wants standing in view.

### Left-off card {#leftoff}

An **inset** panel (sunk, not raised — it's a note *in* the page, not a card on it) directly under
the hero, so re-entering the app is never cold. Shows the last thing you noted plus a quiet
`noted today`. Click → it becomes an inset textarea; autosaves on blur, Esc cancels. Empty state is
a single italic placeholder line, never a card. One **global** note — not per item; per-item context
is what a commitment's Context field is for. This is session continuity: "where was I."

## The hero dial strip {#hero}

Two neumorphic panels side by side (`grid-template-columns: 1fr 1fr`; stacked on phone), directly
under the status bar. This is the sanctioned rule-3 exception — the app's "here's your progress"
moment. Both panels are clickable and open a full screen. The only hard rule: there are exactly
**two**.

### Cumulative study dial (left panel) *(Phase 5 — absent until courses & study ship)*

**Phasing:** this panel depends on the `courses` + `study_sessions` tables, which are Phase 5 and
**gated on dogfood evidence**. Until Phase 5 lands, the left hero panel simply does not render and
the win counter spans the full strip. The hero strip is therefore *one* panel in the MVP and two
after Phase 5 — it is never a placeholder or an empty state.

One semicircular neumorphic gauge showing the week's total study time against the total weekly
goal, **its arc split into class-coloured segments** — so a single glance answers *both* "how close
am I to my 20h goal" *and* "which classes actually got the time." This is where the §identity
colours pay off a second time. Below the dial sits a legend (`● ECEN 2250 4.5h  ● Statics 1.5h …`),
and the whole panel opens the per-course Study screen (§study-expanded).

Port exactly from the mockup's `renderHeroStudy`:
- Same carved-groove semicircle as the per-course dials (§dial): `viewBox="0 0 160 100"`, arc
  `M20 80 A60 60 0 0 1 140 80`, radius 60, arc length **L = π·60 = 188.5**. Reuse the masked
  light/dark blurred strokes verbatim — that mask is what makes it a channel, not a bent bar.
- **Segments:** for each course with logged time, one coloured arc in the course colour, width 11,
  `opacity 0.82`, `stroke-linecap: butt`, drawn with `stroke-dasharray: draw (L−draw)` and
  `stroke-dashoffset: −cum`, where `cum` accumulates each segment's length `(loggedMin/totalGoal)·L`
  and `draw = segLen − 1.2`. That 1.2 hairline gap is what keeps adjacent segments legible.
- Centre label absolutely positioned over the arc: big `13h` primary + `/ 20h` secondary, tabular.
- **No needle here** — the needle belongs to the single-course dials; segments carry the reading.

### Semester win counter (right panel) — the split-flap

A real airport-departure-board **split-flap** counter of everything finished this term (assignments
done + subtasks checked + gym days — `semesterDone` in schema.md). Dark flap units on the light
neumorphic panel, a centre seam, tabular digits, plus a **Replay** button. Port `buildFlaps`:
- One `.flap` per digit (min 2): dark rounded unit (`linear-gradient(#20293A,#171E2B)`, raised
  shadow + inset hairline), a `::after` seam line at 50%, one big digit.
- **Roll = ease-out count-up.** From 0, each tick `inc = max(1, round(remaining × 0.14))` with delay
  `55 + (target − remaining) × 0.4` ms — fast at first, easing into the final number. Every digit
  that changes replays a 120ms `flapflip` keyframe (squash `scaleY` to 0.06 and back, brief
  brightness lift) so it reads as a physical flap.
- **Rolls once on load** — the one sanctioned unprompted animation, a greeting — then updates
  **silently** on later re-renders. Replay is the only re-trigger. Clicking the panel (but not the
  Replay button, which must `stopPropagation`) opens the Wins screen (§wins).
  `prefers-reduced-motion`: skip the roll, just set the number.

The same `buildFlaps` powers the big board in the Wins screen — one implementation, so the hero
counter and the Wins board can never disagree.

## Countdowns {#countdown}

Every deadline row (Needs Attention, the Deadlines preview, the Deadlines window view) ends with a
**bold countdown**. It is the urgency carrier, which is what frees the class glyph to be pure
identity. Tiered by weight *and* colour, with the literal date/time as a small sub-line beneath:

| Condition | Label | Style |
|---|---|---|
| past due | `OVERDUE` | red, uppercase, weight 800 |
| due today | `DUE TODAY` | red, uppercase, weight 800 |
| due tomorrow (≤24h) | `DUE TOMORROW` | **amber**, uppercase, weight 800 |
| ≤ ~2 days | `2 days left` | amber, weight 600 |
| further out | `5 days left` | secondary, weight 600 |

**Red is reserved for today and overdue.** Tomorrow is amber on purpose — when everything urgent
is red, "due tomorrow" screams as loudly as "you already missed this," and the tiering stops
meaning anything. The sub-line carries the exact `Fri · 5:00 PM` / `11:59 PM`. This replaces the
old plain right-aligned meta text.

## Celebration {#celebration}

Finishing things must *feel* good — the counterweight to a screen full of obligations, and
deliberately a small dopamine hit. Neumorphic-friendly, never confetti-cheap. Three layers, all
disabled under `prefers-reduced-motion`:

1. **Check pop.** Ticking a subtask replays a 240ms `checkpop` on the checkbox (squash to 0.82,
   overshoot 1.14, settle) — it reads as physically pressed in.
2. **Spark burst.** At the checkbox centre, 12 small rounded sparks in the celebrate palette
   (green, accent, amber, plum, teal) fly outward on eased trajectories over ~620ms and fade. A
   `position:fixed` `.burst` host is spawned at the element's screen coords and removed after.
   **Capture the source rect *before* the re-render** — the old node is gone by the time you paint.
3. **Finale (100%).** When the *last* subtask of a commitment is checked: the whole expanded panel
   pulses a green inset ring (900ms), a trophy **"All steps done!"** banner drops in at the top
   (1500ms), and a bigger 22-spark burst fires. This is the payoff for finishing a whole "small
   project."

Gym check-ins get the small burst too; the win counter's roll (§hero) is the fourth celebratory
beat. Keep these to the moments that earn them — logging progress and finishing. Never idle, never
on load except the counter.

## Expanded views (v2) {#expanded}

The signature desktop interaction. Clicking a card or panel morphs it from its cell into a
centered overlay panel; closing reverses the morph back into the cell.

**Morph mechanics:** panel animates from the source element's bounding box to centered,
max-width 880px, max-height 85vh, scrollable inside; 220ms ease-out on transform+opacity;
backdrop `rgba(29,37,48,0.18)`. Close via ✕ top-right (36px hit target), backdrop click, or Esc.
Same raised neumorphic surface, radius 20px.

**How the morph is built (FLIP):** render the panel at its *final* centered position first, measure
it, then apply the inverse transform to put it back over the source element's box, and transition
to identity. Do not animate width/height — that reflows text on every frame and looks cheap.

```
target = panel.getBoundingClientRect()          // after render, before paint
source = sourceEl.getBoundingClientRect()
panel.transform = translate(source.left-target.left, source.top-target.top)
                  scale(source.width/target.width, source.height/target.height)
// next frame: transition transform → none, 220ms ease-out
```

Scaling a box distorts its contents, so **cross-fade the panel's inner content in over the last
~160ms** (opacity 0 → 1, ~70ms delay) while the box itself is still moving. The distortion is
real but never visible, and the panel reads as *becoming* the detail rather than replacing it.
Reverse exactly on close, re-measuring the source (it may have moved). If the source element
is gone, fall back to a plain `scale(.96)` fade — never leave the morph pointing at a stale box.

**Detail on top of detail:** keep an explicit stack, not a single "current" slot. An assignment
row inside This Week pushes; closing it pops and re-renders the parent *without* a morph
(a second morph on the way back reads as a glitch). Esc pops one level, backdrop click closes
the whole stack. Restore focus to the source element on close and `overflow:hidden` the body
only while the stack is non-empty.

**Triggers:** a commitment card → that commitment expanded. The **Deadlines panel itself**
(header or panel background — not an individual row) → the Deadlines window view. An individual
assignment row (anywhere) → that assignment's detail. The **hero study dial** → the Study view;
the **hero win counter** → the Wins view (its Replay button re-rolls without opening).

### Commitment expanded — "a small project"
Top to bottom:
1. Header: name · category + importance · status. ✕ in corner.
2. Meta row (secondary text): last progress `9d ago` · cadence `every 4d` · streak `3 wk`.
3. **Progress groove** — thin inset bar, filled = done/total subtasks, label `3/5`. Derived only;
   there is no manual progress control anywhere.
4. **Context** — freeform multiline text (inset field), autosaves on blur. Empty state: single
   quiet placeholder line. Never required.
5. **Subtasks** — checklist. Row = neumorphic checkbox + title; checked = strikethrough +
   sinks (inset). **Checking a subtask auto-logs progress** (one tap feeds momentum — no
   separate log needed). Add-input pinned at list bottom (`+ add a next step`); delete on hover ✕.
   No due dates, no nesting, no reorder in MVP.
6. **Recent progress** — last 5 logs, one line each (relative date · note). Read-only.
7. Actions row (bottom): same state-legal table as §drawer-actions.

### Deadlines expanded — the window view {#deadlines-expanded}
All `upcoming` assignments inside a chosen **time window**, grouped under day headers: `Overdue`
(pinned, red) · `Today` · `Tomorrow` · weekday names. Row = class glyph + coloured course kicker +
title + countdown (§countdown); exam rows also carry an `EXAM` tag. Row click opens that
assignment's detail on top; closing it returns here. Footer: `n deadlines shown · m done this week`.

- **Window selector:** a segmented control under the title — `Next 24h · 3 days · 1 week · 2 weeks ·
  4 weeks · All`, **defaulting to Next 24h**. Overdue is always shown regardless of window (it is
  pinned). The selection persists across re-opens within a session.
- **Fixed height — this one matters.** The body carries a `min-height` equal to the *tallest*
  window's content, so **changing the window never resizes the panel.** Going from 2 weeks back to
  24h must not snap the panel smaller; that jump is jarring and was explicitly rejected in review.
  Fewer items simply leave calm whitespace — and that whitespace is itself the signal *"you're
  caught up."* (The mockup locks `min-height: 672px`, measured from its 2-week content. In the app,
  measure the tallest window once and lock to that rather than copying the number.)
- **Groups are time-ordered.** Rows are pre-sorted by hours-until-due, so build day groups in
  encounter order — start a new group whenever the day label changes — rather than iterating a
  fixed weekday array. Otherwise a 2-week window renders next Monday above this Friday.

### Study expanded *(Phase 5 — courses & study)* {#study-expanded}
Reached from the **hero study dial** (§hero). Grid of per-course panels, 2 per row (see §layout).
Each panel:
- **Dial** — semi-realistic neumorphic semicircular gauge. Full construction in §dial.
  Renders **only** for courses with a weekly goal set (opt-in; a course without a goal shows
  just name + logged hours — no red guilt state).
- **Quick-log row** — `+30m` `+1h` `+90m` buttons + a small custom-minutes input. One tap
  logs; undo toast. Never a running timer.
- Course meta: priority (1–3 stepper) · weekly goal (editable) · `logged Xh this week`.
  Keep the goal input and its `h` suffix in one nowrap group — they must never wrap apart.
Week = Monday–Sunday, America/Denver; dials reset Monday 00:00.

#### The dial, precisely {#dial}

The gauge is the one place in the app allowed to be *decorative*, so it has to actually look
machined rather than like a progress bar bent into an arc. What sells it is that the track is a
**carved channel** — light and shadow living *inside* the groove — not a stroke with a drop
shadow under it. That comes from masking, and the mask is the non-obvious part.

Geometry: `viewBox="0 0 160 98"`, centre `(80,80)`, radius `60`.
Arc path (reused by every layer): `M20 80 A60 60 0 0 1 140 80`.

Layers, bottom to top:

1. **Track groove** — all three strokes below are wrapped in a `<g>` with
   `mask="url(#…)"`, where the mask is that same arc stroked **15px, round cap**. Clipping to
   the band is what makes it read as carved: the blurred light and dark strokes are cut off at
   the channel walls instead of bleeding onto the surface.
   1. base — stroke `#E4E8EE`, width 15
   2. dark wall — stroke `rgba(163,177,198,0.8)`, width 6, `translate(-2,-2)`, Gaussian blur 1.7
   3. light wall — stroke `#FFFFFF`, width 6, `translate(2.4,2.4)`, same blur

   Offsets follow the global light source (top-left light, bottom-right dark), inverted here
   because the channel is *below* the surface.
2. **Value arc** — same path, stroke = the status colour, width 9, round cap, `opacity 0.55`.
   Fill via `stroke-dasharray: (188.5 × ratio) 188.5`, where **188.5 = π × 60** (the semicircle's
   length). `ratio = logged / goal`, **clamped to 1**. Colour: red below 0.5, amber below 1.0,
   green at 1.0.
3. **Goal tick** — line `(140,80) → (150,80)`, stroke `--text-secondary`, width 2.
4. **Needle** — three stacked strokes from `(80,80)` to `(80,31)`, rotated together:
   1. shadow — `rgba(163,177,198,0.8)`, width 4, `translate(1.2,1.2)`
   2. highlight — `#F6F8FA`, width 3.4, `translate(-0.9,-0.9)`
   3. body — `#7C8798`, width 2.2

   Rotation is `ratio × 180 − 90` degrees about `transform-origin: 80px 80px`, transitioned
   300ms ease-out. The three-stroke stack is what makes the needle read as a raised object
   catching light rather than a drawn line.
5. **Hub** — circle `r=7` filled `--surface` with a dual `feDropShadow`
   (`1.4,1.4 rgba(163,177,198,0.85)` and `-1.2,-1.2 #FFFFFF`), then a `r=3` cap in `#8B95A5`.

**Gotcha:** SVG `<filter>` and `<mask>` ids are document-global. Several dials render at once,
so every id must be suffixed with the course key or the last dial's filters silently win.

At `ratio = 1.0` the needle sits horizontal and overlaps the goal tick. That is correct, not a
collision to design around — needle-on-tick *is* the "goal met" reading.

### Wins expanded {#wins}
Reached from the **hero win counter**. The big **split-flap board** (same `buildFlaps` as §hero)
with a "Roll it up" play button, a caption (`assignments completed + steps checked off + gym days`),
and a reserved placeholder for **future feel-good dials** — "how caught up am I," streak rings, a
term-progress arc. Those are deliberately deferred; the Wins screen is the room they will live in.
It stays a place you *visit to feel good*, never a place with homework.

### Gym — the one habit {#gym}
Homeroom tracks exactly **one** habit, on purpose: the gym. No general habit engine, no
streaks-for-everything — that becomes the productivity-methodology app this explicitly is not.

- **Dashboard strip:** a dumbbell glyph, `Gym`, `2 of 3 this week`, and a 7-pip week strip
  (`Su…Sa`). Each pip shows its weekday plus a mark, and the pip's *surface* carries its state:
  **done** = inset with a green check; **target, not yet** = raised with an open ring; **today** =
  raised with an accent ring; **missed** (past target, not done) = red mark; **rest day** = dimmed,
  `disabled`, inert. Tapping a target/today pip toggles the check, with the small spark burst
  (§celebration) and an undo toast.
- This is the **one** place a dashboard element carries a direct action rather than opening a
  detail view. That's justified: a habit check has to be a single tap or it won't happen. It is not
  a precedent for putting buttons in list rows.
- **Settings:** a `Su…Sa` toggle row sets the target days. Dropping a target day also clears any
  check recorded for it.
- **Digest tie-in:** on a target day with no check-in, the daily digest includes a gym nudge
  (schema.md email rules). "Going" = tapping the pip.

**Mockup note:** **`mockup-dashboard-v3.html` is the current visual target.** Everything in this
doc works in it: the coloured status bar with next-exam, the hero strip (segmented cumulative dial
+ split-flap counter), class colour/icon on every row, tiered countdowns, the celebration layers,
the left-off card, the gym strip, the fixed-height deadline window, and the Study/Wins screens.
`mockup-dashboard-v2.html` (morph baseline) and `mockup-dashboard.html` (v1) are kept for history.

All mockups hold state in in-memory JS arrays. **Nothing persists — reload resets.** The Settings
page there is a facade (Save and `set ✓` are cosmetic). Every place a mockup mutates an array is
where a `*.repo.ts` call goes in the real build.

## Design tokens {#tokens}

Defined once as CSS custom properties in `src/index.css`; components use them via Tailwind
arbitrary values or utilities — never a raw hex in a component file.

| Token | Value | Use |
|---|---|---|
| `--surface` | `#EDF0F4` | Page + panel base |
| `--shadow-light` / `--shadow-dark` | `#FFFFFF` / `rgba(163,177,198,0.6)` | The neumorphic pair; raised = `-6px -6px 14px light, 6px 6px 14px dark`; inset variant for pressed/active |
| `--text-primary` | `#1D2530` | All primary text (AA on surface) |
| `--text-secondary` | `#5B6472` | Meta text — the legal minimum lightness |
| `--accent` | `#3D5A80` | Interactive affordances only |
| `--status-red` / `--status-amber` / `--status-green` | `#D64545` / `#E09A2F` / `#3E9B6B` | Status dots, OVERDUE/countdown tiers, celebration ring — never row tints |
| Radius | 14px small / 20px panels | |
| Type scale | 22px title / 15px row / 13px meta, Inter (or system-ui stack), tabular numerals for dates/counts | |

**Class-identity palette (v3, §identity)** — per-course/commitment `color` + `icon` are **data, not
tokens**: they live in table columns (schema.md), not `index.css`. Draw from a set chosen to avoid
the status hues — teal `#2C8C7C`, indigo `#4257B2`, rust `#B5642E`, ocean `#2E6E9E`, plum `#8E4585`,
violet `#6B4FA0`, bronze `#8A6D3B`, steel `#5B7085`. `--status-*` and `--accent` stay reserved for
their jobs; a class colour never stands in for status.

Visual target lives in this docs folder (open in any browser, no server needed):
**`mockup-dashboard-v3.html`** is current; `-v2` (morph baseline) and the original (v1) are kept
for history. All were built strictly from this spec. When code and mockup disagree, **this doc wins
on behaviour and the v3 mockup wins on look** — see the fidelity contract at the top.

## Layout {#layout}

- **Desktop/laptop (primary):** single centered column, max-width ~720px. Not a grid of
  widgets — a column reads top-to-bottom in priority order: status bar → hero dials → left-off →
  Needs Attention → Deadlines → Commitments → gym → stalled. The hero strip is the **only**
  two-column row in the layout. Detail is an expand-in-place morph (§expanded), centered over the
  column — nothing slides in from the right.
- **Phone (secondary, same app in the browser / PWA):** the same column, full-width, detail
  becomes a bottom sheet. Nothing is removed — the layout is already phone-shaped because
  it's one column. Tap targets ≥ 44px.

**Breakpoint is 768px**, and only a few things actually change:
1. Commitment cards → quiet chips (pill radius, single row of content).
2. The **hero strip** collapses to one column (`grid-template-columns: 1fr`) — study dial stacks
   above the win counter. **Gym pips** flex to fill the row width.
3. Detail panel → bottom sheet: full width, `border-radius` on the top corners only,
   `max-height: 88dvh`, and bottom padding that adds `env(safe-area-inset-bottom)`.
4. Deadline rows **wrap instead of holding the fixed course column**. This one is a trap:
   leaving the desktop column width in place on a 390px screen pushes the title and time
   clean off the row. Let the row wrap, let the course size to content, and push the time
   right with `margin-left:auto`. The status bar wraps the same way (next exam drops a line).

Use `dvh` rather than `vh` for the sheet — `vh` on mobile Safari measures against the
*collapsed* toolbar, so a `vh`-sized sheet gets clipped by the browser chrome.

Wide content (the This Week table, long titles) never scrolls the page sideways; the column is
the only horizontal authority.

## Interaction: buttons appear on intent {#drawer-actions}

Per the requirement "buttons with specific functions that only appear when I click on that
commitment" — list rows and collapsed cards have **zero** buttons. The detail view (expanded
panel on desktop, bottom sheet on phone) shows exactly its legal actions:

| Item state | Detail view actions |
|---|---|
| Assignment `upcoming` | **Log progress** · **Mark done** · Dismiss |
| Assignment `done` | Reopen |
| Commitment `active` | **Log progress** (+ optional one-line note) · Mark stalled · Edit cadence/importance · Archive |
| Commitment `stalled` | **Resume** (= log progress, auto-unstalls) · Archive |

- **Log progress** is the hero action everywhere: one tap, optimistic UI, the detail view closes
  itself. The whole system lives or dies on this being ≤ 2 seconds end-to-end.
- Destructive/irreversible (Archive, Dismiss) confirm inline, in place ("Archive — sure?").
  Everything else commits instantly with an undo toast. Confirm friction is reserved for
  destruction; logging progress must never feel like paperwork.
  The confirm is the *same button* relabelling in place (turning red + inset), not a dialog —
  a modal on top of a modal is exactly the friction this rule exists to avoid. An armed button
  **disarms itself after ~4s** and reverts to its original label, so a half-pressed Archive can
  never sit waiting to catch the next click.
- **Undo toast:** bottom-center, ~4.5s, one action. Undo must restore the *full* prior state —
  for a subtask that means the checkbox, the derived progress groove, the auto-inserted
  progress log, and the dashboard card behind it. Half-undo is worse than no undo.
- Actions are laid out left-to-right in escalating consequence, with the destructive one pushed
  to the far right by a spacer. The hero action is the only one carrying `--accent`.
- **Future NLU slot:** the preview→confirm surface for voice actions is this same detail view
  rendering a `pending_action` ("Will log progress on Rocket sim with note '…' — Confirm /
  Cancel"). No new UI concept needed later; that's deliberate.
