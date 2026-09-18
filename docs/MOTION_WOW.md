# Motion: the wow pass

What to add so Cuidala reads as a premium, alive object rather than a well-behaved
list. Written 2026-09-17 against the working tree on `main` (E5-07 plus the
uncommitted decor fixes), after walking every screen in the browser pane at
iPhone 17 size and reading every animation in `src/`. Companion to
[`MOTION_PLAN.md`](./MOTION_PLAN.md), which is the consistency-and-bugs list; this
file is only about the moments people would record and send to someone.

Everything below is a recommendation. Nothing in this pass changed code.

## Where the app stands

The foundation is unusually good and should be built on, not replaced:

- One easing curve (`EASE_OUT`, iOS's own push curve), one duration scale, three
  springs, test-enforced in `src/lib/motion.ts` / `motion.test.ts`.
- Reduce Motion handled twice (`MotionConfig reducedMotion="user"` plus the CSS
  kill-switch), and the canvas layers are delta-timed for 120 Hz.
- Real gestures: sheet drag-to-dismiss, interactive edge-swipe back, the sliding
  scope pill, and a `layoutId` fly from the open list to Done.
- A living house: sky phase, sun/moon, clouds, rain and snow, porch light,
  smoke, string lights, visitors, care decorations, and a staged closing
  ceremony.

The gap is that almost all of that life is concentrated in one place (the top
of Today) and almost none of it is *caused by the user*. Three facts from the
walk-through frame the plan:

1. **The house does not answer a tick.** Completing a chore draws a check,
   flies the row to Done and shows a toast; the house itself only changes when
   the whole day closes. Per the product bar ("acting on it visibly moves
   something"), this is the single biggest missing beat.
2. **Everything off Today is still.** Home (939 lines, zero transitions),
   Restock, Year, Settings, the room sheets, the lock screen and every gauge
   are static. `gauge.tsx` snaps its width on change; the Year dot grid, the
   four stat tiles and the care level never move.
3. **Two built pieces are dormant.** The tilt parallax in
   `portrait-scene.tsx:154-177` listens for `deviceorientation`, but iOS 13+
   WKWebView delivers nothing until `DeviceOrientationEvent.requestPermission()`
   is called from a user gesture, and nothing in `src/` calls it. Separately,
   `SPRING_DRAG` and the `breathing-loop` Lottie are defined and never used.

Two principles run through every item:

- **The house is the interface.** Anything the user does routes through the
  house first; the rest of the app borrows the house's continuity.
- **Numbers never teleport.** A number that changed because you acted rolls; a
  number you arrive at counts up once per session; nothing replays on a tab
  switch.

---

## Tier 1 — Signature moments (Today, ~4.5 days)

These are the ones that make the app feel expensive on the screen people open
every day. All five sit on infrastructure that already exists.

### 1. The house answers every tick

**What.** When a chore commits, the window mapped to that room warms on right
then, with a small sparkle at the window, and the "min left" number rolls in
the same beat.

**Spec.**
- Trigger: `onCommitted` in `today-view.tsx` (after `COMPLETE_HOLD_MS`), not on
  press, so an Undo during the hold never has to un-light a window.
- Resolve `duty.roomId` → `homeSpec.windows[].roomId` → kit window id. Pass a
  transient `pulseWindowId` to `PortraitScene`; `PortraitStack` already owns
  per-window lit/dim/off with a 6 px bloom.
- The window: state → `fresh`, `transition-opacity` 500 ms (exists) plus one
  bloom pulse, `scale 1 → 1.25 → 1` on the bloom layer only, `DUR_BASE`.
- A 72 px `sparkle-burst` at the window centre (the door sparkle in
  `portrait-scene.tsx:510-529` already does this; parametrise the anchor).
- No mapped window (rooms without one, whole-home chores): a soft radial bloom
  behind the house, opacity `0 → 0.3 → 0` over `DUR_SCREEN`.
- The "min left" `RollingNumber` (already wired in the house sheet) also drives
  the number in `DayRunCard`, so the ring, the number and the window move
  together.
- Haptic: the existing `hapticComplete`. Nothing new.
- Reduce Motion: state change only.

**Why.** It closes the loop the product bar asks for, and it makes the
window-to-room mapping (which the user set up in onboarding) visibly matter
every day, not only when tapped.

**Effort.** 0.5–1 day. Files: `today-view.tsx` (commit hook),
`today/portrait-scene.tsx`, `today/portrait-stack.tsx`, `today/day-run-card.tsx`.

### 2. The closing ceremony as a 2.5-second piece

**What.** The sequence exists (`MOTION_PLAN.md` §0/§3.5) but everything lands
inside 0.7 s and settles at 1.2 s. Stretch it into a piece with a beginning,
a middle and an end. This is the screenshot moment, and the Share button sits
at the end of it.

**Timeline** (`CEREMONY_MS` 1200 → 2400):

| t (ms) | Beat | How |
| --- | --- | --- |
| 0 | `hapticClose` (exists) | — |
| 0 | Sky warms one notch toward golden | register `--sky-top/--sky-mid/--sky-horizon` with `@property` as `<color>` so a single `transition: --sky-* 600ms` tweens the gradient; today they snap |
| 0–600 | Windows warm on, 70 ms stagger | exists |
| 500 | Door sparkle | exists |
| 700 | Hearth bloom: radial glow behind the house, `0 → 0.35` over 600 ms, then held at 0.15 for the rest of the closed day | new layer under the house; this becomes the *look* of a closed day, so the difference is visible at a glance later |
| 900 | Today's run dot pops (`scale 0.6 → 1.15 → 1`, `SPRING_SETTLE`) and the streak number rolls +1 | `run-strip.tsx`, `RollingNumber` |
| 1000 | Stats count up (move from delay 0.3 to 1.0); each label fades in 120 ms after its number lands | `closing-ceremony.tsx` |
| 1600 | Reward card rises 12 px (move from 0.7 to 1.6); the Share button gets one 900 ms sheen sweep, never repeated | `closing-ceremony.tsx` |
| 1600–4000 | Firefly drift: 8–12 particles, 6–12 px/s, 2.4 s life, rising from the house footprint | `particle-layer.tsx` gets a `drift` preset beside `burst` |

- The tap-anywhere skip button in `today-hero.tsx:112-122` should be ported to
  `PortraitScene`, which is the path that actually renders.
- Reduce Motion: `hapticSuccess` and the final state, as today.
- Tune with `/dev/portrait?ceremony=1` (exists) and Simulator → Slow
  Animations; record once at 120 fps and step through it.

**Effort.** 1 day.

### 3. The ladder pays out: a level-up ceremony

**What.** Care decorations (planter, window box, bench, wreath) and the
palette unlocks are the reward the whole progression model pays; today they
simply appear on the next render. Give the moment a landing.

**Spec.**
- Trigger: `careLevel` rises versus the level stored at last open (the
  "Since &lt;date&gt;" already exists, so the previous level is derivable; store it
  explicitly to be safe).
- Whole-house bloom (`0 → 0.3 → 0`, `DUR_SCREEN`), then 200 ms later the earned
  piece drops 24 px onto its anchor with `SPRING_SETTLE` overshoot and one
  `detail-puff` at the base (reuse the smoke puff at 60% scale).
- The headline in `DayRunCard` gets the `CareTitle` treatment that currently
  only lives on `/dev/hero`: label fades in, a cream underline draws
  `scaleX 0 → 1`, `DUR_BASE`.
- Palette unlock (Kept → terracotta, Well kept → slate): repaint the house with
  a circular mask from the door outward. Render the new-palette `PortraitStack`
  above the old one and animate `clip-path: circle(0 at door) → circle(120%)`
  over 900 ms `EASE_OUT`. The door anchor now carries size, so the origin is
  exact.
- New haptic `hapticLevelUp`: `impact(Medium)` → 90 ms → `notification(Success)`.
  Distinct from `hapticClose`'s three beats.
- Level down: the piece fades over `DUR_AMBIENT`. No drama, no haptic.
- Reduce Motion: instant.

**Why.** This is the addictive hook: the ladder becomes something you *watch*
pay out, and the payout is on the picture of your own house.

**Effort.** 1–1.5 days. Files: `today/care-decor-layer.tsx`,
`today/portrait-stack.tsx`, `today/day-run-card.tsx`, `lib/native/haptics.ts`.

### 4. A sky that visibly moves

**What.** The sky is fully parametric (`skyGradient(phase, phaseT, …)`), yet a
user only ever sees one frame of it. Two additions:

- **Time-lapse on the first open of the day.** Animate `phaseT` from dawn to
  now over 1.4 s `EASE_OUT`: the sun arcs to its place, the gradient sweeps,
  and the greeting fades in when it lands. Once per calendar day per launch,
  gated by `useSessionArrival`; never on tab switches.
- **Live phase changes tween.** The 30 s ticker currently moves the disc with a
  1000 ms CSS transition but the gradient snaps, because CSS custom properties
  do not transition unless registered. Register the three `--sky-*` tokens
  with `@property` (supported from iOS 16.4, the deployment target) and give
  them `transition: 600ms`. Golden hour and dusk then happen *to* the user who
  has the app open, instead of between opens.

Cost note: a gradient repaint over the whole scene per frame is paint-heavy.
Both cases are one-shot and under 1.5 s; do not make this continuous. The disc
already moves by `left/top`; switch it to `transform` while there.

**Effort.** 0.5 day. Files: `today/portrait-scene.tsx`, `today/sky-disc.tsx`,
`globals.css`, `lib/scene/sky.ts`.

### 5. Wake the tilt parallax and give it depth

**What.** Make the diorama real. `useGyroOffset` is written correctly but
never receives events on iOS.

**Spec.**
- Call `DeviceOrientationEvent.requestPermission()` from the first tap on the
  house (a real gesture), after the house-reveal ceremony so it is not the
  first prompt a new user sees. Persist the answer in Preferences; never ask
  twice. The system prompt copy is Apple's.
- Layer the offset by depth instead of moving only the house: sun/moon 0.3×,
  clouds 0.5×, house 1× (±6 px, as now), decorations and visitor 1.3×. Weather
  canvas stays put.
- Freeze to 0 with `SPRING_SETTLE` while any sheet is open or the compact bar
  is up.
- Verify on a device: the simulator has no gyro, and the browser pane never
  will.

**Effort.** 0.5 day. File: `today/portrait-scene.tsx`, plus a one-line
Preferences key.

---

## Tier 2 — Continuity (~4.5 days)

The app currently has three separate spatial models: Today's scene, the tab
panes, and Radix sheets. These four items make it feel like one place.

### 6. Window → room zoom

Tapping a lit window today switches to the Home tab and slides a sheet up from
nowhere. Instead: a fixed-position clone of the tapped window (rounded rect
with its glow) FLIPs into the room sheet's header art rect while the sheet
rises; the sheet's rows fade in 80 ms later; the house dims to 0.6 behind. The
reverse plays on dismiss when the sheet was opened from a window. `layoutId`
cannot cross the tab panes (different trees, and the Home pane is `hidden`),
so drive the clone with Motion's imperative `animate()` in a portal,
`DUR_SCREEN`, `EASE_OUT`. Haptic: selection on tap (exists), `impact(Light)` on
land. **1.5 days.**

### 7. Onboarding builds the house, then hands it over

`WelcomeScene` already loops the lights. Make each answer change the scene:
choosing a kit crossfades the house (`DUR_AMBIENT`); each room added lights one
window with the 70 ms stagger; a ZIP swaps in the real sky and weather with a
600 ms crossfade. On finish, the onboarding house FLIPs into Today's scene
position over `DUR_SCREEN` so the first Today is the same object, not a new
screen. Add the missing haptics: `selectionChanged` on picks, `Success` on
finish. **1 day.**

### 8. Boot and unlock

The splash is flat cream, then `OpeningScreen`, then a hard swap. Paint the
sky first, rise the house 8 px over `DUR_BASE`, rise the sheet 24 px over
`DUR_SCREEN`, then the existing card stagger. For Face ID, the lock card
scales to 0.96 and fades (`DUR_QUICK`) while the scene sharpens: crossfade the
blurred copy out over `DUR_SCREEN` rather than animating `filter`. Add
`Success` on unlock and `Warning` on failure; the lock screen currently has no
haptic at all. **0.5 day.**

### 9. Swipe actions on rows

Open item §3.4 in `MOTION_PLAN.md`, with the detail that makes it memorable:
bind the check's `pathLength` to drag progress (`useMotionValue` →
`useTransform`) so the tick *draws under the finger*; `selectionChanged` at the
threshold; a full swipe commits and the row flies to Done through the existing
`layoutId`. Swipe left reveals snooze, rubber-banded. Release uses
`SPRING_DRAG`, which was reserved for exactly this and is still unused.
**1.5 days.**

---

## Tier 3 — Everywhere polish (~4 days)

The consistency signal. None of these is a wow on its own; together they are
the difference between "the Today screen is nice" and "this app is nice".

### 10. Numbers never teleport
Adopt `RollingNumber` (action-caused change) and `CountUp` (first reveal per
session) for: Today's three stats outside the ceremony, "min left", Home's
"6 due soon · 3 to reorder" and "Next 90 days: ~$339", Restock's "about 30
days", the four Year stat tiles, milestone "3 of 10", quest "2 of 5 rooms" and
"3 to go". Never on tab switches or plain re-renders. **0.5–1 day.**

### 11. Gauges that move
`gauge.tsx` (the most reused data viz in the app) gets a spring width on change
and a one-time fill on first in-view reveal; the transit hatch slides in. Quest
bar segments fill left → right 60 ms apart on change. Restock "Order early":
the hatch slides in and the row's icon lifts 4 px on `SPRING_PRESS`, with the
existing Medium haptic. **0.5 day.**

### 12. The Year draws itself
First reveal per session: months stagger 40 ms, dots inside 3 ms apart (the
whole year in about a second), closed days pop (`0.6 → 1.15 → 1`,
`SPRING_SETTLE`), today's ring breathes (reuse `today-dot-breathe`). Arriving
from a just-closed day, the new dot pops last with `impact(Light)`. Milestones:
on earn, the row flies from Working towards to Earned (`layoutId` within one
list), the icon draws by `pathLength`, one ring bursts. Note
`milestone-list.tsx` currently re-animates its bars on every mount; gate it on
first reveal. **0.75 day.**

### 13. One press language
Open item §3.7. Cards and tiles: `whileTap` 0.97 on `SPRING_PRESS` with the
shadow stepping down one level. Full-width rows: tint only, 120 ms. Icon
buttons and chips: 0.92 on `SPRING_PRESS`. Primary CTA: 0.98 plus
`brightness(0.96)`. Retire every `duration-75` class. **0.5 day.**

### 14. First-reveal entrances per tab
Open item §3.8. Home: forecast card, whole-home group, rooms group, 60 ms
apart, 8 px rise, `DUR_QUICK`; same for Restock and Year. Generalise
`useSessionArrival` to a per-tab key. Never on later switches. **0.25 day.**

### 15. Sheets, menus, disclosures, checks
Sheet content staggers (header, then rows at `STAGGER_CHILD`), as
`duty-detail-sheet` already does; extend to the room sheet, house sheet and
Settings. The long-press context menu scales `0.9 → 1` from the row with
`SPRING_SETTLE`, exits in `DUR_INSTANT`, and gets `impact(Light)` on open; it is
currently instant and silent. Restock's "Stocked" accordion uses Motion
`layout` on the container instead of popping. `ui/checkbox.tsx` (indicator is
`transition-none`) and `circle-check.tsx` get the same `pathLength` draw as
`duty-row`, so the app has one check. **0.75 day.**

### 16. Ambient depth
Two more cloud silhouettes with slight vertical drift (open §1.2); laundry and
tree sway amplitude coupled to forecast wind; snow that accumulates on the
roof over a snowy day (snow layer opacity by hours of snow). Skip lightning:
it fights the "never startling" rule and needs a photosensitivity guard.
**0.5 day.**

### 17. The toast as the house's voice
The reaction line is good copy on a stock sonner slide. Custom toast: room
glyph, rises 12 px on `SPRING_SETTLE`, exits in `DUR_INSTANT`, one at a time.
**0.25 day.**

---

## Guardrails

- **Reduce Motion first.** Every new piece needs its still version before it
  ships; the FLIPs, the clip-path reveal and the time-lapse are the ones that
  bypass `MotionConfig` and must check `useReducedMotion` themselves.
- **Transform and opacity only.** No tweening `filter`, `backdrop-filter` or
  `box-shadow`. The two exceptions here (sky gradient, palette clip-path) are
  one-shot and under a second.
- **Once per session.** Entrances never replay on a tab switch. The only thing
  allowed to loop for attention is today's breathing dot.
- **Concurrency budget** on Today: two details, one visitor, weather, parallax.
  Pause all of it when a sheet is open (details already pause with the compact
  bar).
- **CSS tokens.** `lib/motion.ts` covers Motion, but the same cubic-bezier is
  hand-typed in `app-shell.tsx:197`, `ui/sheet.tsx:13,142,145` and three places
  in `globals.css`, and CSS durations (150/300/350/500/700/1000 ms) are
  literals. Add `--ease-out` and `--dur-instant/quick/base/screen/ambient`
  custom properties and point everything at them before Tier 3.
- **Deployment target is iOS 16.4.** Motion covers everything above; do not
  reach for the View Transitions API, `@starting-style` or scroll-driven
  animations (iOS 18 / 17.5 / 26). `@property` is fine.
- **Verify on device, not the pane.** Gyro, haptics and WKWebView layout
  quirks do not reproduce in the browser. `MOTION_PLAN.md` §5 still applies;
  add a 120 fps recording of items 1–3.

## Suggested order

| Week | Items | Days | Why this order |
| --- | --- | --- | --- |
| 1 | 1 house answers · 2 ceremony · 3 level-up · 4 sky · 5 parallax | 4.5 | All on Today, all on existing infrastructure, highest wow per line |
| 2 | 6 window zoom · 7 onboarding · 9 swipe actions · 8 boot/unlock | 4.5 | The app becomes one place; onboarding is the first impression |
| 3 | 10–17, tokens first | ~4 | Consistency pass; cheap individually, decisive together |

The seven Lottie details and the four decoration pieces in
[`SCENE_DETAILS_BRIEF.md`](./SCENE_DETAILS_BRIEF.md) raise the ceiling on items
1–3 further, but nothing above waits on the art.

## Housekeeping found on the way

- `SPRING_DRAG` (`lib/motion.ts:17`) is never imported; item 9 is its home.
- `MOMENTS["breathing-loop"]` (`lib/illustrations.ts:88`) is never rendered; a
  candidate for the lock screen or the empty states.
- `.app-shell-main--push` (`globals.css:387`) is a dead rule.
- The browser pane reports `visibilityState: hidden` while it is not the
  focused pane, and Motion clamps its frame delta, so 200 ms tweens crawl over
  seconds there. It looked like the quest card was stuck at opacity 0 for six
  seconds; on a focused load it reached 1 within a second. Not a bug in the app.
