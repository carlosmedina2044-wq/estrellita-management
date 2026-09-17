# Motion: what's left

What remains to finish Cuidala's animation work and make it read as smooth and
deliberate rather than merely animated. Audited 2026-09-16 against
`v1.1-today-momentum`, on an iPhone 17 simulator (iOS 26.5) and in the shipped
bundle at device size.

Companion to the [build & usability review](https://claude.ai/artifact/QLSf5HzukNbmPPooj3fruu)
and the [repair plan](https://claude.ai/artifact/BY5dZ7B1GhmMEL6h7t9ohj). Nothing here
duplicates those; this is motion only.

**Status as of 2026-09-16 (implementation pass):** every item marked ✅ below
is done, verified on the iPhone 17 simulator and in the browser, and covered by
`npm run typecheck` / `npm run lint` / `npm test` (370/370 passing). Items
marked ⏳ are still open. Read **§0** before anything else — it changes which
of the ⏳ items are actually worth doing next.

**Correction, same day, second pass:** §0 is now resolved — the momentum
ceremony is wired into the live `PortraitScene` path (see its note below).
Also, §3.2 and §3.3 were marked ⏳ above but are not open: both were already
built and committed *before* this audit ran (`c18cfe2` "P3-01 Interactive
bottom sheet drag dismiss", 2026-09-13; `a9b4a72` "P3-03 Edge-swipe back on
push screens"). `ui/sheet.tsx`'s hand-rolled pointer-event drag-to-dismiss and
`app-shell.tsx`'s `onEdgePointerDown`/`onEdgePointerMove`/`onEdgePointerUp`
edge-swipe are both fully wired to real DOM handlers, not dead code — this
audit's search for a `motion/react` `drag="y"` prop specifically must have
missed the raw-pointer implementation. Verified live in the browser and by
`git log -S` before touching anything, precisely so no one duplicates this
work a third time.

---

## 0. A discovery that changes the priority of everything below

Verifying §1.3 (`RollingNumber`) turned up something bigger than a motion bug:
**`TodayHero`'s entire "momentum" variant cannot render in the shipped app.**
Traced precisely, not inferred:

```
today-view.tsx:382   momentumOn = household.momentum.enabled && household.mode === "owner"
today-view.tsx:487   sceneMode = momentumOn                          // the exact same boolean
today-view.tsx:622   <TodayHero variant={momentumOn ? "momentum" : "plain"} …>
                      // rendered only in the branch where !sceneMode is true —
                      // i.e. only when momentumOn is false — so `variant`
                      // is "plain" every single time this line executes.
```

`variant === "momentum"` is not a rare edge case that's hard to hit — for any
combination of `household.mode` and `momentum.enabled`, it is **mathematically
unreachable**. When momentum is on, `PortraitScene` renders instead of
`TodayHero`, and `PortraitScene` does not import any of the momentum variant's
building blocks. Confirmed by import chain, not just this one call site:

| Component | Only imported by | Live in the shipped app? |
| --- | --- | --- |
| `HouseOrbit` (the care-level ring) | `today-hero.tsx` | **No** |
| `CareTitle` | `today-hero.tsx` | **No** |
| `RollingNumber` (the odometer) | `today-hero.tsx` | **No** |
| `ClosingReward` (shelf-scene + Share) | `today-hero.tsx` | **No** |
| `KeptRoomsRow` | `today-hero.tsx` | **No** |
| `ClosingStats` (the 3-number count-up) | `today-view.tsx:685` | Yes, but always called with `instant` — its own count-up animation never plays either |
| `CountUp` | Only by `ClosingStats` above | Reachable, but its non-zero-duration path is never exercised in production |

What real users see instead, for the exact same moments, is `PortraitScene`'s
own simpler treatment: more windows lighting up as the day closes, one
`sparkle-burst` at the door, and `arc.minutesLeft` / the closed-day stats
rendered as **plain, unanimated text** (`today-view.tsx:684-689`).

This is almost certainly a leftover from the app's own history — the commits
visible in this repo show a 3D scene retired, then "the scene engine" added,
then the Today hero rebuilt around it (`8565451`, `M8-01`, `M7-09`) — and
`TodayHero`'s momentum branch reads like the design the scene replaced,
never deleted. `/dev/hero` renders it in isolation for exactly this reason:
it's a design-review harness for a component the live app can no longer reach.

**I fixed the bugs in this code anyway** (§1.3, and the token migration in §4
touches every file above) because the component is real, tested via `/dev/hero`,
and the fixes are correct regardless of where the component ends up. But none
of that work is visible to a user today, and no amount of further polish on
`HouseOrbit`/`ClosingReward`/`RollingNumber` will be until one of these
happens — **this is a decision for you, not something I should resolve
unilaterally**:

1. **Wire it up** — bring the richer ceremony (the ring draw, the odometer,
   the animated triple count-up, the shelf-scene reward card) into the live
   `PortraitScene` path, replacing or supplementing today's lights + one
   sparkle + instant numbers. The bigger, better-looking option; also the
   most work, and touches `today-view.tsx`'s rendering logic, not just motion.
2. **Retire it** — delete `TodayHero`'s momentum branch, `HouseOrbit`,
   `CareTitle`, `ClosingReward`, `KeptRoomsRow`, and `RollingNumber`, update
   `/dev/hero` accordingly, and let `PortraitScene`'s simpler treatment be the
   one true ceremony. Least work; loses real, already-built craft.
3. **Leave it** — accept that this code exists only for `/dev/hero` design
   review and is never shown to a user. Cheapest today, keeps a maintenance
   cost that will confuse the next person who reads `today-hero.tsx` and
   reasonably assumes it renders.

I'd lean toward (1): the ceremony is explicitly called out in this app's own
review as the moment worth making people screenshot (§3.5 below), and the
richer version already exists, built and tested — it just needs a wire
connected. But it's a product call, not a motion one, so I stopped short of
making it.

**✅ Resolved, same day:** wired up (option 1) — not by reconnecting
`TodayHero`'s momentum branch verbatim (its `HouseOrbit` ring + `CareTitle`
card don't fit `PortraitScene`'s full-bleed illustration; forcing them in
would have looked like two design languages stapled together), but by
bringing three of its five building blocks into `PortraitScene`'s actual
render path in the spirit §3.5 asks for:

- `PortraitStack`'s windows now warm on with a ~70ms per-window stagger
  during the live "just closed" ceremony (gated on the `ceremony` prop, not
  on `closedToday`, so reopening the app later the same day just shows the
  already-lit end state with no replay)
- The door sparkle now lands at +0.5s instead of instantly, after the lights
- `ClosingStats` counts up instead of always being `instant` during the live
  ceremony
- `ClosingReward` (the shelf-scene card + Share button) now renders in the
  sheet whenever the day is closed — this was the missing "reward card" beat
- `RollingNumber` now drives "X min left" in the sheet's summary row

`HouseOrbit`, `CareTitle`, and `KeptRoomsRow` are still only reachable via
`/dev/hero` — they were the wrong shape for this scene, not merely
unconnected. That's a smaller version of the same §0 decision, deliberately
made this time rather than deferred: retire-in-place is correct for those
three specifically, if anyone revisits this.

---

## Start here: the foundation is already good

Worth saying plainly, because the list below is long and it is a list of gaps,
not a verdict. Several things are done properly and should not be touched:

- **Reduce Motion is genuinely handled, twice.** `MotionConfig reducedMotion="user"`
  covers every `motion/react` animation (`providers.tsx:15`), and a global CSS
  kill-switch covers everything else (`globals.css:705`). Most apps get this wrong.
- **One easing curve, and it is the right one.** `cubic-bezier(0.32, 0.72, 0, 1)`
  is iOS's own push curve, used for the shell push (`globals.css:424`), sheets
  (`ui/sheet.tsx:140`) and exported as `EASE_OUT` (`lib/motion.ts`).
- **The list already does a shared-element transition.** `layoutId={duty.id}`
  (`today-view.tsx:352`) inside `AnimatePresence mode="popLayout"` means a
  completed chore flies from the open list to the done list rather than
  disappearing and reappearing. This is the most sophisticated motion in the app.
- **The completion choreography is properly staged** — circle fills (180 ms),
  check draws by `pathLength` (200 ms at +180 ms), strikethrough sweeps
  (220 ms at +220 ms), with haptics on press and commit (`duty-row.tsx`).
- **The weather canvas is delta-timed correctly** (`today/weather-layer.tsx`),
  which matters below.
- **The shell push is a real iOS parallax** — parent slides to −30 % at 0.9 opacity
  while the child comes in from 100 % (`globals.css:386–430`).

The gap is not craft. It is consistency, a few real bugs, and three or four
places where the app promises a gesture it does not deliver.

---

## 1. Bugs — things that are currently wrong

### 1.1 ✅ The particle burst runs at double speed on 120 Hz

`today/particle-layer.tsx:89–90`

```js
p.x += (p.vx * 16) / 1000;
p.y += (p.vy * 16) / 1000;
```

The physics assumes every frame is 16 ms. iPhone 17 is a ProMotion display, so
rAF fires at ~8 ms — twice as many frames inside the same 600 ms particle life,
so **particles travel roughly twice as far on the device you are shipping to** as
they do on a 60 Hz screen. The burst reads as a wide scatter instead of a tight
pop, and it will look different again on any older device.

`today/weather-layer.tsx` already does this correctly with a `last = performance.now()`
delta. Copy that pattern.

- [x] Delta-time the particle integrator; clamp `dt` to ~32 ms so a stalled frame
      does not teleport particles
- [x] ~~Re-tune `speed`~~ — turned out unnecessary: the old formula
      (`vx * 16 / 1000`) was implicitly assuming a 16 ms frame, which is exactly
      what `dt` equals on a 60 Hz display. Delta-timing reproduces the original,
      correctly-tuned 60 Hz motion exactly, and now also scales correctly on
      120 Hz instead of doubling.

### 1.2 ✅ Cloud size variety never renders

`today/clouds.tsx:49` sets `transform: scale(${c.scale})` inline, then
`globals.css:598` animates `transform: translateX(...)` on the same element. The
running animation wins, so **the scale is discarded and every cloud renders at
1×.** `buildClouds` computes `0.75 + (i % 2) * 0.3` for nothing.

- [x] Move the drift onto a wrapper and keep `scale` on the inner element
- [ ] Still open: only 3 clouds maximum at any cover level, all the same
      lozenge. Two silhouettes and a slight vertical drift would stop the
      repetition reading as a pattern — not done, needs a design call on the
      second silhouette rather than a code fix

### 1.3 ✅ `RollingNumber` is a pop-up, not an odometer — but see §0, it's currently unreachable

`today/rolling-number.tsx`

The `key` includes `value`, so **every digit unmounts and re-animates whenever any
digit changes** — 19 → 20 rolls both digits, and 19 → 29 rolls the unchanged 9.
There is also no outgoing digit: the new one slides up over empty space rather
than pushing the old one out, and the direction is always upward regardless of
whether the number rose or fell.

- [x] Key per digit position (index) with the digit as the inner `AnimatePresence`
      key, so a position whose digit is unchanged never remounts
- [x] Animate the outgoing digit out via `AnimatePresence`, direction signed by
      a `rising` flag derived from comparing to the previous value — done as
      React's sanctioned "adjust state during render" pattern (two `useState`
      calls), not a ref: this project's `react-hooks/refs` lint rule rejects
      reading/writing `ref.current` during render, and an effect would apply
      the direction a frame late
- [x] Switched `h-[1em]` to `h-[1lh]` (clips at the line box, not the em box);
      also switched each digit slot from `inline-block` to `absolute inset-0`
      inside a `w-[1ch]`-wide `relative` wrapper — the entering/exiting digits
      need to overlap, not stack in normal flow, for the slide to read as one
      digit replacing another rather than two digits appearing in sequence

### 1.4 ✅ Verify the kept-rooms pulse is not re-firing

`today/kept-rooms-row.tsx:21` passes a fresh array literal
(`animate={{ scale: [1, 1.06, 1] }}`) on every render. Worth confirming the
keyframe does not restart when the parent re-renders for unrelated reasons —
a room icon that quietly pulses forever is the kind of thing nobody reports and
everybody feels.

- [x] Hoisted `{ scale: [1, 1.06, 1] }` to a module constant (`FRESH_PULSE`)

---

## 2. Smoothness — where the frames go

### 2.1 ✅ `backdrop-filter` is being animated on every scroll frame

`today-view.tsx:543–544`

```js
blur.style.backdropFilter = `blur(${amount}px)`;
blur.style.setProperty("-webkit-backdrop-filter", `blur(${amount}px)`);
```

This is the single most expensive property you can animate in a WKWebView. Each
distinct blur radius forces a fresh backdrop sample and re-composite of the
region underneath, every frame, for the whole first 120 px of scroll — which is
exactly the moment the user is judging whether the app feels expensive.

Three ways out, cheapest first:

- [x] **Quantised it** — 5 steps (0 / 2.4 / 4.8 / 7.2 / 9.6 / 12 px), writing
      to the DOM only when the step actually changes, plus caching the
      `querySelector` lookup in a ref instead of re-running it every scroll
      frame. Chose this over the other two options below since it needed no
      new DOM nodes and no visual difference from the continuous version.
- [ ] Not done: cross-fading two static layers (opacity-only, compositor-free)
      would be cheaper still if 5 steps ever turns out to be not enough
- [ ] Not done: dropping the blur for a gradient scrim — worth trying if (a)
      above is still too expensive on an older device

### 2.2 ⏳ A React state flip inside the scroll handler — not done, low priority

`today-view.tsx:546` — `setCompactBar(y > 120)` re-renders the whole of
`TodayView` at the threshold crossing, mid-scroll. It is guarded so it only fires
on the boundary, but that boundary is crossed during an active flick, which is
the worst possible moment for a full subtree render.

- [ ] Drive the compact bar from a `data-` attribute written directly to the DOM
      node (or a `useMotionValue` + `useTransform`), so crossing the threshold
      costs a class toggle rather than a render

### 2.3 ⏳ A permanent compositor layer — not done

`globals.css:389` — `will-change: transform, opacity` sits on `.app-shell-roots`
for the entire session, not just during a push. That is a standing memory cost
and it removes the browser's ability to make its own decisions.

- [ ] Apply `will-change` only while `data-pushed` is mid-transition, and clear it
      on `transitionend`

### 2.4 ◐ Lottie's first play is late, and on the heaviest renderer — preload done, renderer swap not tried

`illustrated-moment.tsx:117` uses `renderer: "svg"` — the most expensive of
Lottie's three. And the player module plus the JSON are both fetched on demand,
so **the first chore completion in a session has no sparkle**; it falls through to
the canvas particle fallback. `sparkle-burst.json` is 19 KB, the largest of the
four.

- [x] Preload `lottie_light` and `sparkle-burst.json` on idle after first paint —
      `preloadSparkleBurst()` in `illustrated-moment.tsx`, called from
      `app-shell.tsx` via `requestIdleCallback` (with a `setTimeout` fallback)
      once `hydrated` is true, skipped under Reduce Motion since that path
      never loads Lottie at runtime anyway
- [ ] Not done: try `renderer: "canvas"` for the small effects and measure
- [ ] Not done: decide whether the sparkle needs Lottie at all now that §1.1's
      canvas fallback is properly delta-timed

### 2.5 ✅ Dead weight

- [x] `@rive-app/canvas-lite` removed via `npm uninstall` (was in
      `package.json:32` with zero imports in `src/`)

---

## 3. Classy — the choreography gaps

These are the difference between "it animates" and "someone chose this".

### 3.1 ✅ The segmented control teleports

`today-view.tsx:746–762` — Today / This week / This month is three buttons
swapping a background class. The cream pill **jumps** between positions with no
travel. Every native iOS segmented control slides its indicator; this is the most
visible missed opportunity in the app because it is on the first screen and gets
tapped constantly.

- [x] Done as `layoutId="today-scope-pill"` (the plan's suggested name was
      already taken by something else in the file) with `SPRING_SETTLE`.
      Verified in the browser: `aria-selected` and the pill's own DOM node
      move to the newly active tab together, sized to that tab exactly.

### 3.2 ✅ The grabber's gesture — already existed, audit missed it

`ui/sheet.tsx:185` draws the standard iOS grab handle at the top of every bottom
sheet. This section originally claimed there was no drag-to-dismiss behind it.
**That was wrong** — `onSwipePointerDown`/`onSwipePointerMove`/`finishSwipe` in
the same file already implement it: velocity threshold, distance threshold,
upward rubber-banding, and a `canSwipe` guard that backs off inside inputs/
textareas or once the sheet's own content has scrolled. Committed 2026-09-13
(`c18cfe2`), three days before this audit — it's a hand-rolled pointer-event
implementation rather than `motion/react`'s `drag="y"`, which is presumably why
the original search for this gesture missed it. Verified live.

### 3.3 ✅ Interactive back-swipe — already existed, audit missed it

The push animation (`globals.css:424`) does have an edge-swipe partner.
`app-shell.tsx`'s `onEdgePointerDown`/`onEdgePointerMove`/`onEdgePointerUp`
already drive `.app-shell-roots`/`.app-shell-push` from a live drag progress
value exactly as this section originally asked for, complete with a
velocity-or-distance dismiss threshold and a spring-back on release. Committed
as `a9b4a72` "P3-03 Edge-swipe back on push screens". Verified live.

### 3.4 ⏳ No swipe actions on rows — not done

Covered in the review as a UX gap; it is also a motion gap. The row exposes a
`···` button instead of swipe-to-complete and swipe-to-snooze.

- [ ] Reveal-on-drag with a snap point, haptic at the threshold, and a
      full-swipe shortcut that commits without releasing into the menu

### 3.5 ✅ The biggest moment has the least motion — resolved via §0

Was: the closing ceremony counted three numbers up and faded a reward card in,
called from `TodayHero`, which never rendered. Now: `PortraitScene` (the path
that actually renders) stages windows warming on, a delayed sparkle, a
counting `ClosingStats`, and a `ClosingReward` card, in that order, over
roughly the second §3.5 asked for. See §0's resolution note for exactly what
moved where.

- [x] Choreographed as one sequence: house lights warm on → sparkle → stats
      count → reward card
- [ ] Not done: this is a first pass on the sequencing, not art direction. The
      timing reuses `TodayHero`'s existing delay constants (0.5s sparkle, the
      stats' own count-up) rather than being tuned from scratch against the
      real artwork — worth a dedicated look with `?at=` and Slow Animations
      before calling the choreography finished, not just wired

### 3.6 ✅ `animate-pulse` on the one dot you cannot act on

`today/run-strip.tsx:60` — today's open dot gets Tailwind's generic 2 s
ease-in-out opacity pulse. It is the only pulsing element in the app, it is
stock, and it draws the eye to a state rather than an action.

- [x] Replaced with a slow (2.4s) breathing scale + opacity, `today-dot-open` /
      `today-dot-breathe` in `globals.css`. Used a symmetric `ease-in-out`
      curve rather than the literal `EASE_OUT` token: that curve is
      asymmetric (fast-out, slow-in) by design for one-shot settle
      transitions, and applying it to both halves of an infinite back-and-forth
      loop would make it snap oddly on the return swing. Covered by the
      existing blanket Reduce Motion rule at the bottom of `globals.css`, same
      as every other CSS keyframe in this file.

### 3.7 ⏳ Press feedback is inconsistent — not done

Three different press treatments are in use: `whileTap={{ scale: 0.92 }}` with
`SPRING_PRESS` on the check button, `active:scale-[0.98]` with
`transition-transform duration-75` on chips and cards (`today-view.tsx:754, 768,
801, 946`), and `active:bg-foreground/6` with no scale on list rows.

- [ ] Pick one press language — most likely a 0.97 scale on the spring for
      anything card-sized, tint-only for full-width rows — and apply it everywhere

### 3.8 ⏳ Entrances are missing where they would help — not done

Tab switching is instant (`hidden={!todayActive}`), which is correct — iOS tab
bars do not animate. But the **first paint of a tab's content** is also instant,
which is where a 150 ms staggered fade of the top two or three sections would
make the app feel composed rather than stamped.

- [ ] A short, once-per-session entrance on first reveal of each tab. Never on
      subsequent switches — repeated entrances are the fastest way to make an app
      feel slow

---

## 4. ✅ Give it a motion system

Right now durations are literals scattered across components. The audit found
**twelve distinct values between 120 ms and 500 ms** (0.12, 0.16, 0.18, 0.2, 0.22,
0.24, 0.25, 0.26, 0.3, 0.32, 0.4, 0.5) plus six more in CSS. No reader can tell
which differences are intentional.

`lib/motion.ts` already holds `SPRING_PRESS`, `SPRING_SETTLE`, `EASE_OUT`,
`COMPLETE_HOLD_MS`, `CEREMONY_MS` and `PARTICLE_CAP`. Extend it into a real scale
and delete the literals.

Built — five durations (one more than proposed; see the `DUR_AMBIENT` note
below), three springs, one curve, all in `lib/motion.ts`:

| Token | Value | Use |
| --- | --- | --- |
| `DUR_INSTANT` | 120 ms | Press, tint, decoy strokes, a notice card's exit |
| `DUR_QUICK` | 200 ms | Most micro-transitions: draws, strikethroughs, the notice card's entrance |
| `DUR_BASE` | 320 ms | Card in/out, the kept-room pulse, the reward card |
| `DUR_SCREEN` | 400 ms | The care-ring glow, the ceremony's count-up default, the run strip's stagger delay |
| `DUR_AMBIENT` | 600 ms | **New, not in the original proposal.** Background art only — the seasonal-portrait crossfade. Ambient scene painting reads better slower than anything a finger is waiting on, and squeezing it into `DUR_SCREEN` would have meant either speeding up a crossfade that was fine, or muddying `DUR_SCREEN`'s meaning for every *interactive* screen-scale transition that also uses it. |
| `SPRING_PRESS` | existing | Anything tracking a finger |
| `SPRING_SETTLE` | existing | Layout settle, the scope pill |
| `SPRING_DRAG` | new, low stiffness | Added, not yet consumed — reserved for §3.2/§3.4 (sheet rebound, swipe release), which are still open |
| `EASE_OUT` | existing | Every non-spring transition (including `CountUp`'s tween, which was hand-rolling the same array as a raw literal) |

- [x] Added the tokens; migrated every one of the twelve raw duration values
      across 11 files (`duty-row.tsx`, and nine files under `today/`) — nearest-token
      by numeric distance, with two documented exceptions: a tie (0.16, the
      notice card's exit) went to `DUR_INSTANT` since exits read better snappier
      than entrances, and a same-numbered duration/delay pair in the duty-row
      strikethrough was moved together rather than only the duration.
- [x] Added `src/lib/motion.test.ts` — scans every `.tsx` under `src/components`
      for a `duration:` literal in the `[0, 1]` range (motion durations are
      seconds; anything outside that range is a different kind of value
      entirely — a toast's millisecond timeout, clouds.tsx's per-instance CSS
      drift length — and is correctly ignored rather than needing an
      allowlist) and fails the build if one appears. Also asserts the five
      `DUR_*` tokens are strictly increasing with no two closer than 1.25×,
      so the scale itself can't quietly collapse into indistinguishable steps.
- [x] Named the one stagger value in use (`STAGGER_CHILD`, 0.07, the run strip's
      dots) — nothing else to standardise it *against* yet, so it's a name for
      now rather than a resolved conflict.

---

## 5. Verification

None of this is provable by reading. The harness added in P0 makes most of it
cheap to check:

- [ ] `?at=HH:MM` (dev builds) renders Today at any hour — use it to review the
      ceremony and the sky transition at dawn, noon, golden and dusk
- [ ] `xcrun simctl ui <udid> content_size accessibility-extra-large` — confirm
      no animation clips or overlaps at accessibility text sizes
- [ ] Simulator **Debug → Slow Animations** (⌘T) — every transition should still
      look correct at 1/10 speed. Anything that only works at full speed is
      hiding a timing bug
- [ ] `xcrun simctl ui <udid> appearance light|dark` — check the ceremony and the
      particle colours against both grounds. `COLORS` in `particle-layer.tsx:11`
      is three hardcoded hexes that never consult the theme
- [ ] Record at 120 fps and step through the first 300 ms of a chore completion;
      the four staged beats should not overlap
- [ ] Settings → Accessibility → Reduce Motion on, then walk every screen. The
      two kill-switches should mean nothing moves — confirm, do not assume

---

## Suggested order

Effort is rough working days for one developer, including tests. Items 1–4
below — every bug, the worst of the jank, and the token system — are **done**
as of 2026-09-16.

| | Work | Why first | Days | Status |
| --- | --- | --- | --- | --- |
| 1 | §3.1 sliding scope pill | Highest perceived quality per line of code | 0.25 | ✅ Done |
| 2 | §1.1 delta-time particles, §1.2 cloud scale | Straight bugs, both small | 0.5 | ✅ Done |
| 3 | §2.1 scroll cost | The main jank source on the first screen | 1 | ✅ Done (§2.2 left for later — see there for why) |
| 4 | §4 motion tokens | Everything after this gets cheaper and more consistent | 1 | ✅ Done |
| — | §1.3 odometer, §1.4 pulse hoist, §3.6 breathing dot, §2.4 preload, §2.5 drop Rive | Folded into this pass alongside 1–4 | ~0.5 | ✅ Done, not originally scheduled this early |
| — | **§0: the ceremony's fate** | Blocked §3.5 and re-scoped §1.3/§4's `today-hero.tsx` work | — | ✅ Resolved — wired up |
| — | **§3.2 sheet drag-to-dismiss, §3.3 back-swipe** | Thought open, actually already shipped 2026-09-13 (`c18cfe2`, `a9b4a72`) — audit error, not real work | — | ✅ Already done |
| — | **§3.5 closing ceremony** | The screenshot moment | 1.5 | ✅ First pass wired; art direction still worth a dedicated look |
| 5 | §3.7 press language, §3.8 entrances | Consistency pass | 1 | ⏳ Open |
| 6 | §2.4 renderer experiment, §2.2/§2.3 remaining cleanup | Diminishing returns, do if there's time | 0.5 | ⏳ Open |
| 7 | §3.4 swipe actions on rows | Largest remaining item, touches the list | 1.5 | ⏳ Open |

**What's actually left**, now that §0/§3.2/§3.3/§3.5 turned out to be either
resolved or never-open: §3.7/§3.8's consistency pass (~1 day), §3.4's swipe
actions (~1.5 days), and the §2.x cleanup items if there's time. Call it
2–3 days, not the ~5 the table above once implied.

---

## Not on this list, deliberately

- **Tab-switch transitions.** iOS tab bars switch instantly. Animating them would
  be less native, not more.
- **Scroll-linked parallax on the scene.** It was tried and removed (see the
  comment at `today-view.tsx:529`); `position: sticky` lets the browser pin the
  scene natively and it is the right call. Do not reintroduce a JS-driven layer.
- **A loading spinner anywhere.** The app is local-first; there is nothing to wait
  for. The forecast shimmer (`globals.css:447`) is the only justified case.
