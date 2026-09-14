# Cuidala Today: "A well-kept home glows" — execution handoff (v2)

This document is written for an autonomous coding agent (Cursor on auto). Part 1 is the executable scope: Stage A (composition fix, M7-09) and Stage B commits M8-01 to M8-04. Part 2 is the design vision and later stages, for reference and for the next handoff. Do not implement Part 2 in this run.

Every decision is made. Do not re-ask. Where a detail is left to judgment the text says "judgment call"; record such calls in the commit body and in the stop-point report.

## How to run this document

There are four stop points, so this document is executed in **four separate runs**, each started with the full document plus one opener line:

| Run | Opener line | Delivers | Stops after |
|---|---|---|---|
| 1 | `Execute Stage A only (M7-09). Stop at the M7-09 stop point.` | M7-09 | M7-09 |
| 2 | `Execute M8-01 and M8-02. Stop at the M8-02 stop point.` | M8-01, M8-02 | M8-02 |
| 3 | `Execute M8-03. Stop at the M8-03 stop point.` | M8-03 | M8-03 |
| 4 | `Execute M8-04. Stop at the M8-04 stop point.` | M8-04 | M8-04 |

A human reviews the stop-point report between runs. Never continue past a stop point in the same run.

---

# PART 1 — EXECUTE

## 0. Rules

1. **Branch** `v1.1-today-momentum` (already exists; contains M7-00…M7-08 and one follow-up commit `Fix overlapping Today hero illustrations (M7-fix).`). Never commit to `main`. One commit per task, message style `Verb the thing (M7-09).`, trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
2. **Gates** before every commit: `npm test && npm run typecheck && npm run lint && npm run build`. All green or do not commit.
3. **Staging.** Stage named paths only (`git add <path> …`). Never `git add -A` or `git add .`. The working tree already contains untracked `.tmp/`, `exports/`, `.agents/`, `.mcp.json`, `.verify-screenshots/`; leave them alone. In the first commit of run 1, append to `.gitignore`: `.verify-screenshots/`, `.tmp/`, `tools/blender/out/`, `tools/blender/reference/png/`, `*.blend1`.
4. **Visual self-check is mandatory** for every task that touches UI. Start `npm run dev` (port 3456), open http://localhost:3456 at a 390×844 viewport, capture screenshots of the states listed in the task into `.verify-screenshots/<task>/`, and look at them before committing. Use your browser tool; if you have none, add Playwright as a devDependency and `scripts/shot.mjs` that loads a URL, sets the viewport and `deviceScaleFactor: 2`, optionally toggles `.dark` on `<html>`, and saves PNGs. Compare each screenshot against the layout spec numbers in this document. If anything overlaps, wraps beyond the stated line count, or exceeds the height budget, fix it before committing. Copy the screenshots named in the task (converted to WebP, ≤ 8 per task) into `docs/handoff/<task>/` so the report can link them; `.verify-screenshots/` itself is gitignored.
5. **Stop points.** After M7-09, M8-02, M8-03, and M8-04, stop and write a short report (`docs/handoff/<task>.md`: what was done, measured numbers, screenshot links, judgment calls, anything unverified). Do not continue past a stop point in the same run.
6. Read `AGENTS.md` (the Next.js version differs from training data; read `node_modules/next/dist/docs/` before Next-specific code).
7. Every visible string in `src/components/**` comes from `t()` (eslint `react/jsx-no-literals`). Every new key goes to `src/i18n/messages/en.json`, `es.json`, `pt-BR.json` in the same commit (parity test). Strings are in **§7**.
8. **Allowed new dependencies** in this handoff, exact versions: `three@0.186.0` (dependency); `three-mesh-bvh@0.9.15` (optional dependency, only if raycasting the sun disc needs it); devDependencies `playwright@1.63.0` and `sharp@0.35.4`. `motion` and `lottie-web` are already installed. Nothing else. Meshopt decoding uses `three/examples/jsm/libs/meshopt_decoder.module.js`, which ships inside `three`.
9. **Blender**: `/Applications/Blender.app/Contents/MacOS/Blender`, version 5.2.1 LTS (verified). Scripts target the Blender 5.x Python API (`bpy`); consult the 5.2 API docs, not memory. Known 5.x differences: `Mesh.use_auto_smooth` no longer exists — use `bpy.ops.object.shade_auto_smooth(angle=…)` or the "Smooth by Angle" modifier; the glTF exporter exposes `export_yup`, `export_draco_mesh_compression_enable`, and `export_meshopt_compression_enable` (meshopt is available in this install, verified); the colour management view transform `AgX` exists and `WEBP` is a valid render output format. Run headless: `/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/kit.py -- --out public/scene/kit`. Commit the outputs; CI never runs Blender.
10. **Long-running commands** (reference renders, kit bake) run in the background with a log file (`nohup … > tools/blender/out/<name>.log 2>&1 &`) and are polled; never let a tool timeout kill a render. Scripts must support resuming (`--only-missing 1`).
11. **Node**: default is 20. Before `npx cap sync ios` run `. ~/.nvm/nvm.sh && nvm use 22` (v22.23.2 is installed). Simulator steps are optional in this handoff; if unavailable, note it and continue.
12. **Do not touch**: vault/crypto beyond the parse clauses named here, onboarding flow logic (Stage B adds a card on Today, not an onboarding step), budget, restock, cleaner visit, notifications.
13. Performance guardrails in **§5.2** are requirements.
14. Tests run through `npm test`, whose glob expands one directory deep under npm's shell. New scene tests live in `src/lib/scene/*.test.ts` (not deeper).

## 1. Repository facts (verified 2026-09-13)

- Next.js 16 static export in Capacitor 8 WKWebView, React 19, Tailwind v4 CSS-first (`src/app/globals.css`), shadcn, sonner, lucide, `next-themes` (`.dark`), locales en/es/pt-BR (flat dotted keys), tests via `node --test` over `src/lib/**/*.test.ts`, `src/lib/*.test.ts`, `src/hooks/*.test.ts`, `src/i18n/i18n.test.ts`. No component tests; do not add a test framework.
- M7 delivered (all green): `src/components/today/` (`use-completion-flow.ts`, `today-hero.tsx`, `house-orbit.tsx`, `rolling-number.tsx`, `run-strip.tsx`, `kept-rooms-row.tsx`, `care-title.tsx`, `closing-ceremony.tsx`, `count-up.tsx`, `particle-layer.tsx`, `today-notice-card.tsx`, `whole-house-card.tsx`, `attention-tiles.tsx`), `src/components/illustrated-moment.tsx` (Lottie wrapper, svg renderer), `src/components/illustration.tsx`, `src/components/room-type-icon.tsx` (`RoomTypeIcon({ room, className })`), `src/lib/{illustrations,today-copy,care-level,kept-rooms,value-ledger,payoff-lines}.ts` with tests, `dayArc`/`runStripDays` in `src/lib/momentum.ts` (`DayArc = { total, done, open, fraction, minutesLeft, minutesDone, state: "open"|"closed"|"clear"|"rest", nextUp }`), `MomentumSettings = { enabled, bestRun, care? }`, widget snapshot fields, `scripts/prepare-illustrations.mjs`, `public/illustrations/**` (528 KB).
- The `M7-fix` commit already switched `house-orbit.tsx` to `AnimatePresence mode="wait"` and reworked `illustrated-moment.tsx`; Stage A replaces the orbit crossfade anyway.
- `src/components/today-view.tsx` (1007 lines) wires `TodayHero` at ~492 with `arc = dayArc(household, viewDate, filter)`, `momentumOn = household.momentum.enabled && household.mode === "owner"`, `ceremonyActive`, `ceremonyStats`, `monthLedgerLine`, notices, `shareClosedDay`. The `%%` minutes template is split in both `today-view.tsx` (~369) and `today-hero.tsx` (~71).
- `Household` (`src/lib/types.ts` ~359) stores: `homeType: "house"|"townhouse"|"condo"|"apartment"|"other"`, `tenure?`, `location: HomeLocation { lat?, lng?, postalCode?, placeName?, climateZone?, climateZoneOverride? }`, `attributes: HomeAttributes { hasGarage, hasYard, hasPool, hasIrrigation, hasFireplace, hasBasement, hasAttic, hasLaundry, hasHomeOffice, hasGutters, hasSepticSystem, hasWell, hasSolar, hasEvaporativeCooler, roofType? }`, `floors`, `rooms: HomeRoom[]` with `type: RoomType` (kitchen, primary_bedroom, bedroom, bathroom, living, dining, office, laundry, garage, basement, attic, hallway, closet, patio, other), `assets: HomeAsset[]` (with optional `installDate`), `householdName`, `ownerName`, `seenTips` (capped at 32 in `migrate.ts`), `momentum`.
- **There is no home-level age field.** `AgeBucket` (`"new"|"mid"|"old"|"unsure"`) exists only per system in `src/lib/onboarding/generate.ts`. **There is no `household.settings` object.** New settings go on `MomentumSettings`.
- `deriveClimate(location)` in `src/lib/climate.ts` returns `"hot-arid"|"cold"|"humid-subtropical"|"marine"|"mixed"`.
- **Weather**: the forecast is not persisted on `Household`. `app-shell.tsx` holds `forecast: WeatherForecast | null` in state (fetched via `fetchForecastFor` in `src/lib/weather/client.ts`) and derives `weather = weatherCaption(forecast, household.location)`. `WeatherForecast = { days: DailyWeather[]; fetchedAt }`, `DailyWeather = { date, tempMinF, tempMaxF, windMph, precipIn }` (`src/lib/weather/provider.ts`). The native plugin `plugins/cuidala-weatherkit` (`CuidalaWeatherKitPlugin.swift`, `src/definitions.ts`) returns exactly those five per-day fields from WeatherKit `.daily`. **No cloud cover or condition exists today**; M8-01 adds them.
- Migrations: `src/lib/storage/migrate.ts` re-normalizes every field on load; add a parse clause for new optional fields; no version bump.
- Design tokens (`globals.css` ~71–163): `--background #faf6ef`, `--card #fffcf7`, `--primary #9a5a35`, `--brand-cream #f5ebd8`, `--signal #e0662b`, `--done #57843b`, `--soon #8a5a12`, `--overdue #c44d32`, `--done-soft`, `--soon-soft` (mapped to `bg-done-soft`, `bg-soon-soft`), dark under `.dark` (`--background #1f1a16`, `--card #2c2420`). Type: `.ui-hero` 2rem/700, `.ui-display`, `.ui-title` 1.176rem, `.ui-card` 1rem, `.ui-body` .882rem, `.ui-caption` .765rem, `.num` rounded tabular. `.ui-group` card (`overflow: hidden`, radius 20px). Reduced-motion CSS blanket at ~614 (CSS only; JS animations gate with `useReducedMotion`).
- Haptics `src/lib/native/haptics.ts` exports `hapticPress`, `hapticComplete`, `hapticSuccess`, `hapticUndo`, `hapticClose`, `hapticTab`, `hapticOrdered`, `hapticDestructive`. Motion presets in `src/lib/motion.ts`: `SPRING_PRESS`, `SPRING_SETTLE`, `EASE_OUT`, `COMPLETE_HOLD_MS` 320, `CEREMONY_MS` 1200, `PARTICLE_CAP` 24.
- Existing i18n keys used below: `today.minutesLeft`, `today.runBest`, `today.ceremonyShare`, `today.ceremonySkipAria`, `settings.momentumHelp`, `common.gotIt`.
- `useNow()` is day-granular. Images ship in `public/` as WebP via `next/image` unoptimized; `public/` is copied into the iOS bundle.
- npm versions verified on 2026-09-13: `three` 0.186.0, `three-mesh-bvh` 0.9.15, `playwright` 1.63.0, `sharp` 0.35.4.

## 2. Stage A — `Rebuild the Today hero composition (M7-09).`

Purpose: make the current build presentable with existing assets. Everything except the ring carries into Stage B.

### 2.1 Layout spec (390 px wide; numbers are CSS px at 1x)
- Hero card `ui-group bg-card`, padding 16. Rows:
  1. Greeting row: greeting `ui-card font-semibold` left; settings button 44×44 `rounded-full bg-secondary` right.
  2. Headline `<h1>` full width, class `ui-hero-serif` (new: `font-family: ui-serif, "New York", Georgia, serif; font-size: 2.125rem; line-height: 1.1; font-weight: 600; letter-spacing: -0.01em; text-wrap: balance;`), `max-width: 22ch`, margin-top 4. Must never exceed 2 lines in en/es/pt-BR for every pool string (check all).
  3. Secondary line `ui-caption num text-muted-foreground`: date · weather only.
  4. Band, margin-top 12, `flex items-start gap-16px`: left column 116 wide = `<HouseOrbit size={116}>` with `<CareTitle>` centred under it (`ui-caption text-primary text-center`, margin-top 6); right column `min-w-0 flex-1 flex flex-col gap-8 pt-4`.
     - Open: minutes line (`ui-body font-medium num`, `RollingNumber` + `today.minutesLeft`), `<RunStrip>` (8 px dots, gap 6, `today.runBest` caption), `<KeptRoomsRow>` (glyph dots, §2.4).
     - Closed: `<ClosingStats>` (three `CountUp`s `ui-title num font-semibold` with `ui-caption` captions in one row, gap 12), `<RunStrip celebrate>`, ledger caption, `<KeptRoomsRow>`.
  5. Closed only, margin-top 16: `<ClosingReward>`: `rounded-2xl bg-secondary/60 px-12 py-8 flex items-center gap-12` containing `<IllustratedMoment kind="shelf-scene" size={120} loop autoplay />` over a cream radial vignette and a Share pill `h-40 rounded-full bg-card ring-1 ring-border px-16 ui-caption font-medium` on the right.
- Height budget: open ≤ 260 px, closed ≤ 400 px (measure `getBoundingClientRect().height` in the browser and record in the report).
- Plain variant (momentum off or cleaner mode): rows 1–3 only.

### 2.2 `house-orbit.tsx`
`size` prop (116); `r = size/2 - 6`; `strokeWidth 3.5`; track: one continuous faint circle `stroke: var(--border)`, no dash; filled segments `stroke: var(--done)`, 3° gaps, `pathLength` 0→1 260 ms; when `arc.state === "closed"` render one continuous filled circle animating `pathLength` 0→1 over 500 ms; remove the head dot; cream disc opacity ≤ 0.35; halo 0 at every level; always `kind="living-house"` (delete the clip crossfade; keep `houseMomentFor` exported); `dimmed` keeps `saturate-[0.85]`.

### 2.3 Ceremony
Replace `closing-ceremony.tsx` with two exports `ClosingStats` and `ClosingReward` (specs above). Timeline ownership in `today-hero.tsx`: `useEffect` on `ceremony` → `hapticClose()` and `onSettled` after `CEREMONY_MS` (reduced motion: `hapticSuccess()`, settle immediately); skip overlay `<button aria-label={t("today.ceremonySkipAria")}>` absolutely over the hero while `ceremony && !settled`; headline in `AnimatePresence mode="wait"` keyed by `arc.state` (exit `y -8` opacity 0, enter `y 8→0`, 250 ms, delay 150 ms when `ceremony`); count-ups delay 300 ms; run dots stagger from 400 ms; reward fades in at 700 ms (`scale .98→1`); `<IllustratedMoment kind="sparkle-burst" size={160} />` centred on the orbit at 500 ms while `ceremony && !settled`.

### 2.4 `kept-rooms-row.tsx`
Replace scene tiles with `RoomTypeIcon` glyphs (`className="size-4"`) inside 28 px circles: fresh `bg-done-soft text-done`, due `bg-soon-soft text-soon`, waiting `bg-secondary text-muted-foreground/60`; gap 6; up to 8 then `+N` chip; whole-house = `ui-caption text-done` line above, no pill wrapper. The scene stills remain used by notice cards and the whole-house card.

### 2.5 Other
- `care-title.tsx`: centred caption, keep the rise underline.
- `scripts/prepare-illustrations.mjs`: for `breathing-loop`, set `hd: true` on the layer named `Breathing sun`; re-run (`node scripts/prepare-illustrations.mjs`); add an assertion in `src/lib/illustrations.test.ts` that the shipped `breathing-loop` JSON has that layer hidden.
- `today-view.tsx`: move the `%%` minutes template split into the hero (single copy); remove `children` from `TodayHero`.
- `globals.css`: add `.ui-hero-serif`.
- `.gitignore`: rule 3 additions.
- `settings.momentumHelp` text update (§7).

### 2.6 Screenshots (light and dark each): open-many, open-one, closed-settled, closed-mid-ceremony (capture at ~600 ms), clear, momentum-off, es-open, pt-BR-closed. Then STOP (report `docs/handoff/M7-09.md`).

## 3. Stage B1 — `Add the scene engine (M8-01).`

Pure logic in `src/lib/scene/` with node tests. No UI except the Settings switch.

```ts
// sun.ts
export type SunTimes = { sunrise: Date; sunset: Date; solarNoon: Date };
export function sunTimes(lat: number, lon: number, date: Date): SunTimes;      // NOAA approximation; ±3 min ok
export function sunPosition(lat: number, lon: number, at: Date): { altitudeDeg: number; azimuthDeg: number };
export const FALLBACK_SUN = { sunriseMinutes: 390, sunsetMinutes: 1170 };       // 06:30 / 19:30 local
export type SkyPhase = "night" | "dawn" | "day" | "golden" | "dusk";
export function skyPhase(now: Date, times: SunTimes | null): { phase: SkyPhase; t: number };
// dawn = sunrise-40min..sunrise+25min; golden = sunset-60min..sunset-10min; dusk = sunset-10min..sunset+35min; night otherwise; day between.

// sky.ts
export type WeatherKind = "clear" | "cloudy" | "rain" | "snow" | "fog";
export type SkyStops = { top: string; mid: string; horizon: string; ambient: string; textTone: "ink" | "cream";
  sunColor: string; sunIntensity: number; hemiSky: string; hemiGround: string; exposure: number };
export function skyGradient(phase: SkyPhase, t: number, weather: WeatherKind, cloudCover: number): SkyStops;
```
Base stops (clear), interpolate in oklab between neighbours by `t` at phase edges:
| phase | top | mid | horizon | textTone |
|---|---|---|---|---|
| night | `#0f1626` | `#1a2238` | `#2a2f45` | cream |
| dawn | `#4a5a86` | `#c98a6b` | `#f2c9a0` | cream |
| day | `#8fb8e8` | `#c9dcf0` | `#eef2f0` | ink |
| golden | `#6f8fc2` | `#e6a56a` | `#f6d3a2` | cream |
| dusk | `#2b3358` | `#7a5a7a` | `#e08a6a` | cream |
Weather: cloudy mixes `cloudCover × 60%` toward `#b9bec4/#d8dbde/#e9ebec`; rain 60% and exposure −0.2; snow mixes toward `#dfe3e6/#eef0f2/#f7f8f9`; fog sets horizon to `#e6e4df` and mid 50% toward it. `textTone` = ink when the top stop's relative luminance > 0.45. `ambient = mid`. Sun colour/intensity: day `#fff4e0`/2.4, golden `#ffb872`/2.0, dawn `#ffc9a0`/1.4, dusk `#ff9a6a`/0.9, night `#8fa3ff`/0.25 (moon). Exposure: day 1.0, golden 0.95, dawn 0.9, dusk 0.85, night 0.7. `hemiSky = top`, `hemiGround = #6b5a48` (day/golden/dawn) or `#2a2622` (dusk/night).

```ts
// weather.ts
export type SceneWeather = { kind: WeatherKind; cloudCover: number; precipIntensity: number; source: "native" | "derived" };
export function sceneWeather(forecast: WeatherForecast | null, today: string): SceneWeather;
// Uses forecast.current when present (native path, below); else derives from today's DailyWeather:
//   precipIn >= 0.05 && tempMaxF <= 36 → snow; precipIn >= 0.05 → rain; else clear.
//   cloudCover = current?.cloudCover ?? clamp(precipIn * 4, 0, 1) (0 when clear); precipIntensity = clamp(precipIn / 0.5, 0, 1).
// season.ts — export function seasonFor(now: Date, lat: number | null): "spring"|"summer"|"autumn"|"winter"; hemisphere flip when lat < 0.
// light.ts
export type HouseLight = { windowsLit: number; lanternOn: boolean; smoke: boolean; stringLights: boolean; companion: "hidden"|"porch"|"asleep" };
export function houseLight(arc: DayArc, phase: SkyPhase, closedToday: boolean, season: Season, gardenLevel: 0|1|2|3|4, windowCount: number): HouseLight;
// windowsLit = round(arc.fraction * windowCount) (all when closedToday); lanternOn = closedToday || ((phase dusk|night) && arc.done > 0);
// smoke = closedToday && (season winter || phase night); stringLights = gardenLevel === 4 && (phase dusk|night); companion = closedToday ? (phase night ? "asleep" : "porch") : "hidden".
// css.ts — export function sceneCssVars(stops: SkyStops): Record<"--sky-top"|"--sky-mid"|"--sky-horizon"|"--ambient"|"--scene-text", string>;
```

**Native weather fields (same commit).** Extend the WeatherKit plugin so cloudy and fog are reachable:
- `plugins/cuidala-weatherkit/src/definitions.ts`: `WeatherKitDay` gains optional `condition?: string` (WeatherKit `WeatherCondition` raw value, e.g. `"cloudy"`, `"foggy"`, `"rain"`, `"snow"`) and `precipChance?: number`; `WeatherKitForecast` gains optional `current?: { condition: string; cloudCover: number; isDaylight: boolean }`.
- `CuidalaWeatherKitPlugin.swift`: request `including: .current, .daily`; add `day.condition.rawValue` and `day.precipitationChance` per day; add the `current` block from `CurrentWeather` (`condition.rawValue`, `cloudCover`, `isDaylight`).
- `src/lib/native/weatherkit.ts`, `src/lib/weather/provider.ts` (`DailyWeather`, `WeatherForecast.current?`), `src/lib/weather/client.ts` pass the new optional fields through. Existing tests keep passing; add a test for `sceneWeather` on both paths. Mapping from `condition`: contains `fog`/`haze` → fog; `snow`/`sleet`/`flurr`/`blizzard` → snow; `rain`/`drizzle`/`thunder` → rain; `cloudy`/`overcast` → cloudy; else clear (cloudCover from `current.cloudCover`).
- `npx cap sync ios` is optional here (rule 11); if skipped, say so in the M8-02 report.

**Setting.** `MomentumSettings.nightFollowsSky?: boolean` (default true) with a parse clause in `migrate.ts` and a Settings switch labelled `settings.nightFollowsSky` with help `settings.nightFollowsSkyHelp` (§7), placed under the existing momentum switch.

Tests: phase boundaries at ±1 min; fallback sun; every phase × weather yields valid hex and the `textTone` contrast (WCAG relative luminance of the top stop vs `#1d1d1f` or `#f7f3ec`) ≥ 4.5:1 — if a combination fails, adjust that stop and keep the test; season hemisphere flip; `houseLight` rounding and closed override; `sceneWeather` native and derived paths. Commit. No stop.

## 4. Stage B2 — `Build the kit in Blender and add HomeSpec (M8-02).`

This stage sets the visual bar for the whole program. The Cycles reference renders are the truth: the runtime (M8-03) is measured against them, the widgets and recap video will be cut from them later, and the human reviews them at the stop point. Treat every render as a product image, not a debug output.

### 4.0 Order of work
1. TypeScript first: `HomeSpec` (§10), `src/lib/scene/archetypes.ts` (the 16 canonical specs from §11, one per archetype, deterministic colours from the swatches), `src/lib/scene/swatches.ts`, `src/lib/scene/assemble.ts` (§4.5), `scripts/export-archetypes.mjs` → `tools/blender/reference/archetypes.json`.
2. Blender package `tools/blender/cuidala_kit/` (§4.1), then `kit.py` (§4.2), `reference.py` (§4.3), `check_kit.py` (§4.4).
3. Parity tests (§4.5), then commit.

### 4.1 Package layout and conventions
```
tools/blender/
  cuidala_kit/__init__.py
  cuidala_kit/parts.py       # geometry builders, each returns (low_poly_obj, high_poly_obj)
  cuidala_kit/materials.py   # procedural node groups per material family
  cuidala_kit/layout.py      # Python port of assemble.ts; identical numbers
  cuidala_kit/world.py       # sky per phase/weather
  cuidala_kit/camera.py      # framing
  cuidala_kit/render.py      # Cycles settings, compositor
  cuidala_kit/bake.py        # high→low bakes and atlas packing
  cuidala_kit/export.py      # glTF export + manifest
  kit.py  reference.py  preview.py  check_kit.py
  reference/archetypes.json  reference/placements.json  reference/<archetype>-<phase>.webp  reference/showcase/*.webp
  preview/kit.webp
  out/   (gitignored: .blend files, logs, png)
```
- Units metres. Build with Blender Z up, the **front face toward −Y**. Export with `export_yup=True` so runtime space is x right, y up, z toward the camera. `layout.py` computes placements in **runtime coordinates** (x, y-up, z) and converts to Blender with `(x, −z, y)` in one helper; no other file converts.
- Every part's origin is its front-bottom-centre: x centred, y = 0 at ground, z = 0 at the front face. Parts that attach to a face (windows, doors, garage doors, dormers, bay) have their origin on the wall plane and extrude outward (+z) and, where needed, a 0.12 m reveal inward (−z).
- Two tiers from the same builders: `tier="kit"` (low-poly, export) and `tier="reference"` (high-poly: booleans for openings, bevel 0.02 m/3 segments, subdivision where useful, real shingle/lap/brick relief). Reference tier has no polygon budget. The kit tier receives the reference tier's detail through baking (§4.2).
- Hard edges: bevel modifier width 0.02 m, 3 segments, clamp overlap, then `bpy.ops.object.shade_auto_smooth(angle=radians(30))`. UVs: `smart_project(angle_limit=66°, island_margin=0.02)` per part, then family-level `uv.pack_islands(margin=0.004, rotate=False)`.

**Materials (`materials.py`)** — procedural node groups, one per family, with a `Tint` input (default white) multiplied into base colour so the runtime can tint via `material.color`:
| family | build | roughness |
|---|---|---|
| plaster | fine noise bump (scale 40, strength 0.15), slight colour noise ±3% | 0.85 |
| siding | horizontal laps 0.2 m (wave texture → bump 0.6), grain noise | 0.7 |
| brick | Brick Texture (0.22 × 0.07, mortar 0.012, mortar colour `#d9d2c6`, brick colour variance 0.25) → colour and bump | 0.9 |
| stone | voronoi cells (scale 6, randomness 0.9) → colour ramp, mortar lines, bump 0.8 | 0.9 |
| cedar | vertical wood grain (wave + noise distortion), board lines every 0.15 m | 0.6 |
| stucco | coarse noise bump (scale 14, strength 0.35) over fine noise | 0.9 |
| log | horizontal cylinders 0.3 m (geometry in parts.py) + bark noise bump | 0.7 |
| roof tile | barrel rows (wave 0.35 m across, 0.4 m along) bump 0.7 | 0.75 |
| shingle | Brick Texture stretched (1.0 × 0.3, offset 0.5) bump 0.5 | 0.8 |
| metal roof | standing seams every 0.4 m (bump 0.9), roughness noise | 0.35, metallic 0.6 |
| glass | Glass BSDF IOR 1.5 roughness 0.05 mixed with Emission (`#ffb86b`) by a `Lit` input 0–8 | — |
| wood door | vertical grain, panel bevel via geometry | 0.45 |
| brass | metallic 1.0, colour `#c9a25e` | 0.3 |
| leaves | translucent mix 0.3 (Principled + Translucent), colour from season table, roughness 0.9 | — |
| grass/ground | noise green/brown mix, roughness 0.95; path flagstones (voronoi) | — |
| snow (overlay) | white, roughness 0.6, subsurface 0.2, mixed by world-normal Z > 0.7 × `SnowAmount` | — |

Season leaf colours: spring `#7fae4f`, summer `#4f8a3b`, autumn `#c8742e` (deciduous/oak) — evergreen stays `#2f5d3a`, palm `#4d8a45`, desert `#7a8a52`; winter deciduous/oak show bare branches (`leaves` mesh hidden, twig mesh visible).

**Interior cards** (reference tier only): behind each window glass, a 0.6 m deep box with warm grey walls, an emissive ceiling plane (2700 K, strength 6 × `Lit`), and a curtain plane covering 40% of the opening. This gives lit windows depth and a natural falloff. The kit tier has no box; the glass emission plus the runtime bloom sprite stand in.

### 4.2 `tools/blender/kit.py`
Args: `--out <dir>`, `--family <name>|all`, `--bake 1|0`, `--preview 1|0`, `--only-missing 1|0`.

**Families** (one GLB + one atlas set each): `walls_plaster`, `walls_siding`, `walls_brick`, `walls_stone`, `walls_cedar`, `walls_stucco`, `walls_log`, `roofs`, `openings` (windows, doors, garage doors, dormer, bay, balcony, lobby_door), `porches`, `garden` (trees, beds, planter, fences, path, skirting, neighbour_slab), `facade` (facade_module).

**Parts** (dimensions in metres; storey height 2.9; wall thickness 0.3):
- `wall_<material>_<width>`: widths narrow 6, standard 8, wide 11; depth 0.7 × width; one storey; solid module (openings are separate units placed on the face). Also `wall_<material>_half` (1.45 storey for 1.5-storey archetypes, gable-end knee wall).
- `roof_<type>_<pitch>_<width>`: gable, hip, flat (parapet 0.4), gambrel, aframe, shed; pitches low 18°, medium 30°, steep 42°; ridge/eave overhang 0.45 with soffit faces (no light leaks at the wall join); separate `gable_end_<width>_<pitch>` pieces. Roof surface material is a swatch-tinted shingle by default; `tile` and `metal` variants for spanish/farmhouse.
- `dormer` (gable, 1.4 wide, with its own window), `bay_window` (1.8 × 1.3), `window_<style>` grid/plain/arched/wide (0.9 × 1.3, frame 0.06, sill 0.08, mullions for grid, 0.12 reveal, glass as a separate mesh named `glass`), `shutter_pair`, `door_unit` (0.95 × 2.1 with frame, 0.2 step, brass handle, lantern with `lantern_glass` mesh at 2.0 m beside the door), `porch_stoop`, `porch_small` (2.4 deep, 2 posts, railing), `porch_full` (width-following: `porch_full_6/8/11`, tapered posts for bungalow variant), `porch_wrap` (corner piece), `garage_door_1` (2.6 × 2.1, panel relief), `garage_door_2` (4.9 × 2.1), `chimney` (0.6 × 0.6 × 1.5, brick or stone), `gutter` (per metre) + `downspout`, `solar_panel` (1.0 × 1.6, glass + frame), `path_segment` (1 m, flagstone), `bed` (rounded slab 2 × 0.9 × 0.25 with 3 shrub clusters), `planter`, `fence_picket` (per metre), `fence_iron` (per metre), `tree_<kind>` deciduous/evergreen/oak/palm/desert (trunk + leaf clusters as separate meshes named `leaves`; deciduous/oak also carry a `twigs` mesh), `skirting` (per metre), `neighbour_slab` (a flat, untextured neighbour silhouette 8 wide × 2 storeys), `facade_module` (3 × 3 window grid per floor, 9 wide), `balcony`, `lobby_door`, `courtyard_wall` (spanish, 1.2 high per metre with a tile cap).

**Bake** (`bake.py`, Cycles GPU Metal, 256 samples, margin 8 px, selected-to-active from the reference tier to the kit tier with cage extrusion 0.03 m and max ray distance 0.05 m):
- `kit_<family>_albedo` (base colour with `Tint` = white; brick mortar, siding shadows and wood grain land here),
- `kit_<family>_normal` (tangent space, OpenGL +Y convention — glTF's convention; captures bevels, laps, bricks, shingle rows),
- `kit_<family>_mask` (R = AO distance 1.0, G = curvature via Geometry ▸ Pointiness baked as emission, B = roughness). Runtime multiplies AO into the material and uses G for a subtle edge lightening.
- Atlas sizes: walls/roofs/openings 2048, porches/garden/facade 1024. Export textures as WebP quality 90 (`export_image_format='WEBP'`); normals accept lossy WebP at this quality (judgment call: if seams or banding appear in the preview, export that family's normal atlas as PNG and note it).
- `bpy.context.preferences.addons['cycles'].preferences.compute_device_type = 'METAL'`, enable all Metal devices, `scene.cycles.device = 'GPU'` (verified available on this machine).

**Export** (`export.py`): `kit_<family>.glb`, `export_yup=True`, `export_meshopt_compression_enable=True`, `export_apply=True`, `export_materials='EXPORT'`, `export_draco_mesh_compression_enable=False`. Budget: each part ≤ 600 triangles after decimate (trees ≤ 1200, facade_module ≤ 900); each family GLB ≤ 1.2 MB; `public/scene/kit/` ≤ 8 MB total.

**Manifest** — `kit.py` writes `src/lib/scene/kit-manifest.json` (committed; imported by `assemble.ts` so placement numbers are never hard-coded twice):
```json
{ "version": 1, "families": { "roofs": { "file": "kit_roofs.glb", "bytes": 812345 } },
  "parts": { "wall_siding_8": { "family": "walls_siding", "tris": 412, "bbox": { "min": [-4, 0, -5.6], "max": [4, 2.9, 0] },
             "anchors": { "eaveY": 2.9, "width": 8, "depth": 5.6 }, "meshes": ["body"] },
             "door_unit": { "...": "...", "anchors": { "lantern": [0.75, 2.0, 0.08], "step": [0, 0, 0.3] }, "meshes": ["body", "glass", "lantern_glass"] } } }
```
Anchors required: walls `eaveY,width,depth`; roofs `ridgeY,spanWidth,eaveY`; door `lantern,step`; porch `depth`; trees `height`; facade `floorHeight,unitWidth`.

**Preview** (`--preview 1`): a contact sheet of every part at reference tier, day lighting, 6 per row, labelled, plus a second row per wall material showing a 3 × 3 m sample under golden light: `tools/blender/preview/kit.webp` (≤ 2.5 MB).

### 4.3 `tools/blender/reference.py` — the quality bar
Args: `--archetype <id>|all`, `--phase <phase>|all`, `--only-missing 1|0`, `--samples <n>` (override for quick checks), `--showcase 1|0`.

**Scene.** Load `tools/blender/reference/archetypes.json`; for each archetype, `layout.py` assembles the reference-tier parts; ground: 40 m disc with the grass material, a 0.02 m lawn edge, path and beds by spec; `houseLight` state per phase: dawn/day → `windowsLit 0, lanternOn false`; golden/dusk/night → all windows lit, lantern on, `smoke` on for night (smoke as a thin emissive-free volume cone: skip if it costs > 20% render time; judgment call). Season summer, weather clear for the 80-frame grid.

**World (`world.py`).** Lighting and background are separated with a Light Path ▸ Is Camera Ray mix:
- Camera rays see the `skyGradient` stops (§3 table, hard-coded here) as a vertical gradient on the view direction, so the reference background equals the runtime CSS sky.
- Lighting rays see a Sky Texture node of type Nishita: `sun_disc=True`, `sun_size` 0.545°, `sun_elevation`/`sun_rotation` per phase (dawn 8°/95°, day 55°/180°, golden 12°/265°, dusk −4°/275°), `air_density 1.0`, `dust_density 1.0` (2.5 for golden and dusk), `ozone_density 1.0`, `sun_intensity` 1.0. Night: gradient world at strength 0.35 plus a Sun lamp `#8fa3ff`, strength 0.1, angle 1°, at 30°/120° (moon).
- Lantern: point light 12 W, 2700 K, radius 0.04, at the door anchor when `lanternOn`. Lit windows: interior card emission strength 6.
- Colour management: `view_transform="AgX"`, `look` = the item containing `"Base Contrast"` if present, else `"None"` (record which). Exposure per phase: day 0.0, golden +0.3, dawn +0.5, dusk +0.8, night +1.5. Target: no clipped whites on the sunward wall, lit windows clearly warm at dusk and night, shadow side readable. If a wall clips at day, lower that phase's exposure by 0.2 and record it.

**Camera (`camera.py`).** Position (9, 6.5, 11) runtime space looking at (0, 1.6, 0), 35 mm on a 36 mm sensor, `shift_y` so the house bounding box top sits below 46% of frame height and the ground line at 92% (compute from the bbox; identical rule to §5.1), f/5.6 with focus on the door anchor, 6 blades. This mild depth of field gives the "portrait, not replica" feel without blurring the roof.

**Render (`render.py`).** Cycles, GPU Metal, 1290 × 860, adaptive sampling on (threshold 0.01, min 128, max 1024 samples), OpenImageDenoise (prefilter Accurate, guiding by albedo + normal), light tree on, bounces total 8 / diffuse 3 / glossy 4 / transmission 6 / transparent 8, clamp indirect 10, filter glossy 0.5, pixel filter Blackman-Harris 1.5, `render.use_persistent_data = True` (big win across the 80-frame batch). Compositor: Mist pass mixed toward the horizon stop (start 18 m, depth 22 m, 35% at full depth), Glare ▸ Bloom (threshold 1.0, size 6, mix 0.15) so lit windows and the lantern glow the way the runtime sprites do, vignette 0.12, no grain. Output WebP quality 92 directly (`image_settings.file_format='WEBP'`, `quality=92`) to `tools/blender/reference/<archetype>-<phase>.webp`; cap 400 KB each (raise the compression if needed); also write PNG to `tools/blender/reference/png/` (gitignored). Print per-frame time and write `tools/blender/out/reference.log`. Expect roughly 30–60 s per frame on Apple silicon (~1 h for 80 frames); run in the background (rule 10).

**Showcase set** (`--showcase 1`, 2580 × 1720, max 2048 samples, WebP 95, ≤ 1.5 MB each, `tools/blender/reference/showcase/`): `cottage-golden-clear-autumn`, `capecod-dusk-snow-winter` (snow overlay on roofs and ground, 300 falling flakes as a particle system), `ranch-day-rain-spring` (wet ground roughness 0.2, 400 rain streaks), `spanish-golden-clear-summer`, `apartment-night-clear-summer`, `farmhouse-dawn-fog-autumn` (world Principled Volume density 0.02, this frame only). These six are the human's judgment set and the future wallpaper bar; they are not SSIM-gated.

**Quality checklist** (the agent checks every frame against this before the stop point; the human re-checks):
- Silhouette recognisable as its archetype at 645 px wide; no z-fighting; no light leaks at wall/roof joins; soffits present.
- Window reveals and sills read; glass shows sky reflection by day; lit windows are warm with visible interior depth at dusk and night; lantern pool lands on the step.
- Long soft shadows at golden; pink light on the sunward wall at dawn; ground contact shadow under the house; trees show leaf translucency at golden.
- Fog only near the horizon; no fireflies; no clipped highlights on walls; the sky background matches the §3 stops (sample the top-left pixel and compare within ΔE 6).

### 4.4 `tools/blender/check_kit.py`
Headless: re-imports every `kit_<family>.glb`, asserts triangle budgets, named meshes (`glass`, `lantern_glass`, `leaves`, `twigs`), bbox equality with the manifest (±0.01 m), and file sizes; exits non-zero on failure. `kit.py` runs it at the end.

### 4.5 `HomeSpec`, swatches, assembly, parity
- `src/lib/types.ts`: `HomeSpec` exactly as §10; `Household.homeSpec?: HomeSpec`; migrate parse clause (drop if invalid).
- `src/lib/scene/swatches.ts`: 10 wall, 5 roof, 8 door, 3 trim swatches grouped by climate zone (values: judgment call, warm and muted, all door swatches ≥ 3:1 against both card colours).
- `src/lib/scene/assemble.ts` (pure; reads `kit-manifest.json`; no three.js):
```ts
export type Placement = { part: string; position: [number, number, number]; rotationY: number; scale?: [number, number, number]; tint?: string; emissive?: boolean; windowId?: string };
export function assemble(spec: HomeSpec): Placement[];
export function windowLayout(spec: HomeSpec): Array<{ id: string; face: "front"; storey: number; x: number }>;
```
Rules (identical in `layout.py`): footprint width by `width` (6/8/11), depth 0.7×; storeys stacked at `eaveY`; door centred (offset 1.5 m toward the non-garage side when a garage exists); windows on the front face at 2.2 m spacing, skipping the door and garage spans, upstairs windows aligned above; dormers centred on the roof at `dormers` count; porch module by `porch`; garage attached on `garage` side with `garageDoors`; chimney at the ridge quarter; gutters along eaves when `gutters`; two `solar_panel`s on the sunny slope when `solar`; path from the door to the front edge; beds either side of the path when `hasYard`; trees at ±(width/2 + 1.5) by `trees` and `treeKind`; fence along the front when set; townhouse adds `neighbour_slab`s at ±width; apartment builds `facade_module`s for `floors` with the unit highlighted; manufactured adds `skirting`; spanish adds `courtyard_wall`.
- Parity: `layout.py` writes `tools/blender/reference/placements.json` for all 16 archetypes; `src/lib/scene/assemble.test.ts` asserts `assemble()` output equals it (part names, positions ±0.001, rotations), plus: placement counts and bounding boxes per archetype, and no two placements of the same part overlap on the front face (interval check).

### 4.6 STOP. Report `docs/handoff/M8-02.md` with `tools/blender/preview/kit.webp`, the 80 reference renders, the 6 showcase renders, per-frame render times, kit sizes and triangle counts, the exposure and look values used, and every judgment call. The human reviews render quality here before any three.js work.

## 5. Stage B3 — `Add the 3D home scene (M8-03).`

### 5.1 Layout spec (390 wide)
- `HomeScene` region: full-bleed at the top of the Today tab, height `calc(env(safe-area-inset-top) + 300px)`, `overflow: hidden`. Inside: CSS sky (`linear-gradient(var(--sky-top), var(--sky-mid) 55%, var(--sky-horizon))`) as the background; the WebGL canvas fills the region with `alpha: true`; a scrim `linear-gradient(color-mix(in oklab, var(--sky-top) 70%, transparent), transparent 45%)` over the top; text overlay padded `calc(env(safe-area-inset-top) + 12px) 20px 0`.
- Text overlay: greeting `ui-caption` at 80% of `--scene-text`; headline `ui-hero-serif` 34px, `max-width: 20ch`, ≤ 2 lines, colour `--scene-text`; caption `ui-caption` 80%. Text block max height 128 px. Settings button 44×44 top-right: `rounded-full bg-black/12 backdrop-blur-md` with the icon in `--scene-text`.
- Camera framing: identical to §4.3 — camera at (9, 6.5, 11) toward (0, 1.6, 0), 35 mm equivalent, then `camera.setViewOffset` so the house bbox top sits below 46% of the canvas height and the ground line at 92%.
- `TodaySheet`: begins at `scene height − 28px`, `rounded-t-[28px] bg-background`, `box-shadow: inset 0 1px 0 color-mix(in oklab, var(--ambient) 18%, transparent)`, padding 16 20 0. Header row (min-height 56): left = minutes line or `ClosingStats`; right = `RunStrip`. Then the existing content in order: notice card, ZIP banner, attention pills, scope tabs, calendar, filters, lists, season section, restock, week wrapped, teaching, More. `KeptRoomsRow` is removed from Today (leave the component; it moves to Home in a later handoff).
- Scroll: the Today scroll container drives `scene.style.transform = translateY(-0.4 * scrollY)` and a `backdrop-filter: blur(min(scrollY/120, 1) * 12px)` layer over the scene with `-webkit-mask-image: linear-gradient(black, transparent)`; at `scrollY > 120` a compact bar (`height: calc(env(safe-area-inset-top) + 44px)`, `bg-background/90 backdrop-blur-md`) shows `today.compactTitle` / `today.compactClosed` and the settings button. Passive scroll listener + rAF.
- Ambient UI: publish `sceneCssVars` on the Today root; `.ui-group` and `.app-tab-bar` get the `--ambient` inset highlight (`globals.css`); page background for the Today root mixes 4% toward `--ambient`. Night-follows-sky: when `momentum.nightFollowsSky` is on and phase is dusk or night, add a `.today-night` class to the Today root that re-declares the dark tokens; do not toggle the global theme.
- Plain variant (momentum off or cleaner): the scene region collapses to the M7-09 hero card.

### 5.2 Scene implementation (`src/components/today/home-scene-3d.tsx`, `src/lib/scene/three/*`)
- Load the component with `next/dynamic(..., { ssr: false })`; nothing from `three` may execute during the static export build.
- Renderer: `WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" })`, `setPixelRatio(min(devicePixelRatio, 2))`, `outputColorSpace = SRGBColorSpace`, **`toneMapping = AgXToneMapping`** (matches the Blender references), `toneMappingExposure` from `SkyStops.exposure`, shadows `PCFSoftShadowMap`.
- Load `public/scene/kit/kit_<family>.glb` with `GLTFLoader` + `MeshoptDecoder`; cache per family; instantiate placements from `assemble(spec)`; tint via `material.color` from the swatch; apply the mask atlas (R as `aoMap`, G as a small edge-light term via `onBeforeCompile`, B as roughness); `glass` meshes get `MeshPhysicalMaterial` with `emissive` amber `#ffb86b`, `emissiveIntensity` 0 (dark) → 1.6 (lit); `lantern_glass` likewise; `leaves` colour per season; `twigs` visible only in winter.
- Lights: `DirectionalLight` from `sunPosition` (colour/intensity from stops), shadow map 2048, frustum fitted to the house bounds; `HemisphereLight(hemiSky, hemiGround, 0.9)`; a `PointLight` at the door `lantern` anchor when on (warm, distance 4). Environment: build a 64 px `PMREMGenerator` cubemap from the sky stops each minute (`scene.environment`). Fog: `Fog(horizon, 18, 40)`.
- Sprites: sun/moon disc and bloom (`Sprite` with additive blending), window blooms (one sprite per lit window, scale 1.2, opacity 0.35), star field (200 points, opacity by phase).
- Weather: rain `InstancedMesh` of 400 thin boxes falling with wrap; snow 300 small spheres with drift and a roof `snow` mix (material `onBeforeCompile` mixing white by world-normal.y > 0.7 × `snowAmount`, same rule as the Blender material); fog handled by the scene fog; clouds: 1–3 `Sprite`s from `public/illustrations/cloud-*.webp` if present, else skip (judgment call; the asset may not exist yet).
- Render policy: rAF loop runs at 60 fps while `interacting || ceremony`, else every 100 ms (10 fps), and stops entirely when `document.hidden` or the Today pane has `[hidden]`; dispose the renderer after 60 s hidden and rebuild on show. Gyroscope parallax: `deviceorientation` (request permission on first tap where `DeviceOrientationEvent.requestPermission` exists; ignore failures), clamp ±4°, spring-smoothed; fallback idle drift ±1.5° over 14 s.
- Fallback: on `webglcontextlost` or load failure render the last captured still (`renderer.domElement.toDataURL` cached in memory) or, if none, the M7-09 hero card.
- Reduce Motion: render once per state change; no idle loop; no parallax.
- Accessibility: the region has `role="img"` and `aria-label={t("scene.label", {...})}` (§7) composed from phase, weather, lit windows, open count.
- Dev-only overrides behind `process.env.NODE_ENV !== "production"`: `?scene=<archetype>,<phase>[,<weather>[,<season>]]` (defaults clear, summer).
- SSIM gate: `tools/scene-diff.mjs` (node, `sharp` + a small SSIM implementation) compares `.verify-screenshots/M8-03/<archetype>-<phase>.png` (captured from the dev server with the query overrides, canvas only, at 1x) against `tools/blender/reference/<archetype>-<phase>.webp` after resizing both to 645×430; prints a table; fails below 0.85. Playwright capture: if headless Chromium cannot create a WebGL context, launch headed (judgment call; record it).

### 5.3 Screenshots: cottage at all 5 phases, colonial-golden, spanish-day, apartment-night, ranch-rain, capecod-snow (light and dark UI where relevant), scrolled state showing blur and compact bar. Run the SSIM table and include it. STOP (report `docs/handoff/M8-03.md`).

## 6. Stage B4 — `Infer the home portrait and add the picker (M8-04).`

- `src/lib/scene/infer.ts`: `inferHomeSpec(household): HomeSpec` per §9 rules, seeded by a hash of `householdName`. Era is not inferable today (no home-level age field): use the regional default and let the seed pick among the zone's equivalents; round 1 of the picker is where the user corrects it. Tests over a fixture grid (5 climate zones × 5 home types × attribute toggles × 4 seeds) asserting a valid spec, archetype in the allowed set for the zone, and `assemble` within budget.
- Rooms → windows: `assignRooms(spec, rooms)` in household order (kitchen, living, primary_bedroom, bedrooms, bathrooms, office, laundry; garage → garage door light; patio → lantern). Tests.
- Entry card on Today (notice priority below milestone): `portrait.cardTitle` / `portrait.cardBody` with buttons `portrait.makeItYours` and `common.gotIt`; dismissal via `seenTips` `portrait-card`.
- Picker sheet (`src/components/today/portrait-picker.tsx`, bottom sheet, full height): three rounds. Each round: title (`portrait.round1..3`), `portrait.expectation` as a caption under the first title, three cards stacked (335×180, `rounded-2xl`, live 3D via one renderer using `setScissor`/`setViewport` per card at 1x, label under each from `portrait.archetype.*` / `portrait.option.*`), tap selects (ring `--primary`), progress dots, `portrait.skip` top-right. Round 1 shape: the inferred archetype and its two nearest by region (§11 table). Round 2 face: three material + wall swatch combos from the zone group. Round 3 front: three detail sets varying porch/garage/trees. Then dials: swatch chips 36 px for walls/roof/door (`portrait.walls/roof/door`), `portrait.surprise` (reseed within zone), `portrait.reset` (back to inferred), `portrait.done`. Settings entry `settings.portrait` opens the same sheet. Persist `homeSpec` on done.
- Screenshots: entry card, each round, dials, and the resulting scene for three different fixtures. STOP (report `docs/handoff/M8-04.md`). End of this handoff.

## 7. Strings (en | es | pt-BR)

Stage A
- `today.minutesLeft`, `today.ceremonyShare`, `today.ceremonySkipAria` already exist. No new keys except the `settings.momentumHelp` update: `Shows the living house, day ring, runs, and milestones on Today.` | `Muestra la casa, el anillo del día, las rachas y los hitos en Hoy.` | `Mostra a casa, o anel do dia, as sequências e os marcos em Hoje.`

Stage B
- `settings.nightFollowsSky` = `Night follows the sky` | `La noche sigue al cielo` | `A noite segue o céu`
- `settings.nightFollowsSkyHelp` = `After sunset, Today switches to its evening look.` | `Después del atardecer, Hoy cambia a su look de noche.` | `Depois do pôr do sol, Hoje muda para o visual noturno.`
- `settings.portrait` = `Your home's portrait` | `El retrato de tu casa` | `O retrato da sua casa`
- `today.compactTitle` = `Today · {count} left` | `Hoy · faltan {count}` | `Hoje · faltam {count}`
- `today.compactClosed` = `Today · closed` | `Hoy · cerrado` | `Hoje · fechado`
- `scene.label` = `{phase}, {weather}. {lit} of {windows} windows lit, {count} left.` | `{phase}, {weather}. {lit} de {windows} ventanas encendidas, faltan {count}.` | `{phase}, {weather}. {lit} de {windows} janelas acesas, faltam {count}.`
- `scene.phase.night` = `Night` | `Noche` | `Noite`; `scene.phase.dawn` = `Dawn` | `Amanecer` | `Amanhecer`; `scene.phase.day` = `Daytime` | `Día` | `Dia`; `scene.phase.golden` = `Golden hour` | `Hora dorada` | `Hora dourada`; `scene.phase.dusk` = `Dusk` | `Atardecer` | `Anoitecer`
- `scene.weather.clear` = `clear` | `despejado` | `céu limpo`; `scene.weather.cloudy` = `cloudy` | `nublado` | `nublado`; `scene.weather.rain` = `rain` | `lluvia` | `chuva`; `scene.weather.snow` = `snow` | `nieve` | `neve`; `scene.weather.fog` = `fog` | `niebla` | `neblina`
- `portrait.cardTitle` = `This is a portrait of your home` | `Este es un retrato de tu casa` | `Este é um retrato da sua casa`
- `portrait.cardBody` = `Drawn from what you told us. Make it yours in a few taps.` | `Hecho con lo que nos contaste. Hazlo tuyo en unos toques.` | `Feito com o que você nos contou. Deixe do seu jeito em poucos toques.`
- `portrait.makeItYours` = `Make it yours` | `Hazlo tuyo` | `Deixe do seu jeito`
- `portrait.expectation` = `A portrait, not a floor plan. Get the feel right.` | `Un retrato, no un plano. Que se sienta como tu casa.` | `Um retrato, não uma planta. O importante é a sensação.`
- `portrait.round1` = `Which shape is closest?` | `¿Qué forma se parece más?` | `Qual formato é mais parecido?`
- `portrait.round2` = `Which look is closest?` | `¿Qué acabado se parece más?` | `Qual acabamento é mais parecido?`
- `portrait.round3` = `Which front is closest?` | `¿Qué frente se parece más?` | `Qual frente é mais parecida?`
- `portrait.walls` = `Walls` | `Paredes` | `Paredes`; `portrait.roof` = `Roof` | `Techo` | `Telhado`; `portrait.door` = `Door` | `Puerta` | `Porta`
- `portrait.surprise` = `Surprise me` | `Sorpréndeme` | `Me surpreenda`; `portrait.reset` = `Reset` | `Restablecer` | `Redefinir`; `portrait.skip` = `Skip` | `Omitir` | `Pular`; `portrait.done` = `Done` | `Listo` | `Pronto`
- `portrait.archetype.<id>` for the 16 archetypes: cottage `Cottage`|`Casita`|`Casinha`; bungalow `Bungalow`|`Bungalow`|`Bangalô`; craftsman `Craftsman`|`Craftsman`|`Craftsman`; colonial `Colonial`|`Colonial`|`Colonial`; capecod `Cape Cod`|`Cape Cod`|`Cape Cod`; farmhouse `Farmhouse`|`Casa de campo`|`Casa de fazenda`; ranch `Ranch`|`Rancho`|`Térrea`; splitlevel `Split-level`|`Desnivel`|`Meio-nível`; spanish `Spanish`|`Española`|`Espanhola`; contemporary `Contemporary`|`Contemporánea`|`Contemporânea`; aframe `A-frame`|`A-frame`|`A-frame`; cabin `Cabin`|`Cabaña`|`Cabana`; townhouse `Townhouse`|`Adosada`|`Geminada`; duplex `Duplex`|`Dúplex`|`Duplex`; manufactured `Manufactured`|`Prefabricada`|`Pré-fabricada`; apartment `Apartment`|`Apartamento`|`Apartamento`
- `portrait.option.material.<id>` plaster `Plaster`|`Yeso`|`Reboco`; siding `Siding`|`Revestimiento`|`Revestimento`; brick `Brick`|`Ladrillo`|`Tijolo`; stone `Stone`|`Piedra`|`Pedra`; cedar `Cedar`|`Cedro`|`Cedro`; stucco `Stucco`|`Estuco`|`Estuque`; log `Log`|`Troncos`|`Toras`
- `portrait.option.porch.<id>` none `No porch`|`Sin porche`|`Sem varanda`; stoop `Stoop`|`Escalón`|`Degrau`; small `Small porch`|`Porche pequeño`|`Varanda pequena`; full `Full porch`|`Porche completo`|`Varanda inteira`; wrap `Wraparound porch`|`Porche envolvente`|`Varanda em volta`

## 8. Acceptance for this handoff
- All gates green at every commit; reports at the four stop points with screenshots.
- M7-09: hero heights within budget; headline ≤ 2 lines in all locales; no overlap.
- M8-01: engine tests pass; `sceneWeather` works on both the native and the derived path.
- M8-02: kit ≤ 8 MB; every part within its triangle budget; `check_kit.py` passes; 80 reference renders and 6 showcase renders present; contact sheet reviewed; every frame passes the §4.3 quality checklist; `assemble.ts` matches `placements.json`.
- M8-03: SSIM ≥ 0.85 for every archetype × phase; 60 fps in the dev tools performance panel during a completion on a desktop browser (device measurement is the next handoff); idle loop at 10 fps; loop stops when the tab is hidden (assert via a console counter).
- M8-04: inference fixture grid passes; picker screenshots reviewed.

---

# PART 2 — DESIGN VISION AND LATER STAGES (reference; do not implement in this run)

## 9. Inference rules (used by M8-04)
`kind` from `homeType` (`other` → house; condo → apartment). `stories`: bedrooms ≥ 3 or `hasAttic` → 2, else 1; townhouse 2–3. `garage` from `hasGarage` (side by seed); `chimney` from `hasFireplace`; `solar` from `hasSolar`; `gutters` from `hasGutters`; `trees`/beds from `hasYard`; `irrigation` shows a sprinkler head in summer. Regional style by climate zone: hot-arid → spanish/contemporary, stucco, tile, low pitch, arched windows, desert trees; cold → colonial/capecod/farmhouse, siding, steep gable, dormers; humid-subtropical → bungalow/farmhouse, deep porch, hip, oak; marine → craftsman/cottage, cedar, evergreens; mixed → ranch or colonial. Era: no home-level age exists today, so the regional default applies and the seed (from `householdName`) picks among the zone's equivalents; a future handoff may derive era from the oldest asset `installDate`. Apartment: default 5 floors, unit centred, balcony when a `patio` room exists.

## 10. `HomeSpec`
```ts
export type Archetype = "cottage"|"bungalow"|"craftsman"|"colonial"|"capecod"|"farmhouse"|"ranch"|"splitlevel"|"spanish"|"contemporary"|"aframe"|"cabin"|"townhouse"|"duplex"|"manufactured"|"apartment";
export type HomeSpec = {
  version: 1; kind: "house"|"townhouse"|"duplex"|"apartment"; archetype: Archetype;
  stories: 1|1.5|2|3; roof: "gable"|"hip"|"flat"|"gambrel"|"aframe"|"shed"; pitch: "low"|"medium"|"steep"; dormers: 0|1|2|3; bay: boolean;
  garage: "none"|"left"|"right"; garageDoors: 1|2; porch: "none"|"stoop"|"small"|"full"|"wrap"; windowStyle: "grid"|"plain"|"arched"|"wide";
  material: "plaster"|"siding"|"brick"|"stone"|"cedar"|"stucco"|"log"; roofMaterial: "shingle"|"tile"|"metal"; colors: { walls: string; roof: string; door: string; trim: string };
  chimney: boolean; solar: boolean; gutters: boolean; fence: "none"|"picket"|"iron"; trees: 0|1|2; treeKind: "deciduous"|"evergreen"|"oak"|"palm"|"desert";
  apartment?: { floors: number; floor: number; unit: "left"|"center"|"right"; balcony: boolean }; townhouse?: { unit: "end"|"middle" };
  windows: Array<{ id: string; roomId: string|null }>; seed: number;
};
```

## 11. Archetypes (kit params)
cottage 1.5/gable steep/1 dormer/small porch/plaster · bungalow 1/gable low/full porch tapered posts/siding · craftsman 2/gable medium wide eaves/full porch/cedar/grid · colonial 2/gable medium symmetric/stoop/siding or brick/shutters · capecod 1.5/gable steep/2 dormers/stoop/siding · farmhouse 2/gable steep/wrap porch/metal roof/siding · ranch 1/hip low/wide/garage/plain · splitlevel 1.5 offset/gable low/garage under · spanish 1–2/hip low/tile/stucco/arched/courtyard wall · contemporary 2/flat or shed/wide windows/stone+siding · aframe 1.5/aframe/deck porch/cedar · cabin 1/gable medium/log/stone chimney/evergreens · townhouse 2–3/flat or gable/stoop/iron fence/neighbours · duplex 2/gable/two doors/shared porch · manufactured 1/gable low/long narrow/skirting/stoop · apartment facade grid/unit highlighted/balcony/lobby. Nearest-neighbour table for round 1: cottage↔capecod↔colonial; bungalow↔craftsman↔ranch; farmhouse↔colonial↔capecod; spanish↔contemporary↔ranch; aframe↔cabin↔cottage; townhouse↔duplex↔colonial; manufactured↔ranch↔bungalow.

## 12. Concept, principles, experience, rituals, off-app, assets (summary for the next handoff)
- Concept: a well-kept home glows; portrait not replica; real sky, weather, season; rooms light windows; drag the sun down to close the day; the house follows the user (widgets, StandBy, Dynamic Island) via on-device stills; recap video; life (birds, first snow, fireflies, smoke, companion sprite, string lights).
- Later commits: M8-05 light the house by care (windows per completion, lantern, smoke, garden levels by care level, string lights, weather materials, first snow, birds, fireflies); M8-06 drag-the-sun ritual + morning wake (`sunDrag 0..1`, windows light past 0.85, `close` haptic, camera dolly 6% + orbit 8° over 1.6 s, sky returns over 20 s, `seenTips` `closed-<iso>` / `woke-<iso>`, assistive "Close the day" button); M8-07 swipe actions + closed-day polish; M8-03b path-traced idle tier (`three-gpu-pathtracer`, 720×480 ≤ 4 s on A15+, still cache, crossfade); M9 widget stills on device, widgets/StandBy, recap video (`MediaRecorder` mp4 1080×1350); M10 companion, Dynamic Island, sounds; era inference from asset install dates.
- Quality pipeline: Blender-baked parts, Cycles references as the SSIM gate and the wallpaper source, premium raster tier, path-traced idle tier, widgets and recap from the best available image.
- Assets still to generate with ChatGPT (standalone, style block "clean stylized material study…"): foliage billboards, cloud/smoke/star/sun-bloom/firefly sprites, cat and dog sprite sheets, bird sheet, payoff ×9, milestone ×6, empty states ×2. Material tiles are no longer needed: the kit bakes them from the procedural node groups.
- Acceptance for the program: 60 fps in motion on iPhone 12-class, idle ≤ 10 fps and ≤ 2% CPU, ≤ 3% battery per idle hour, headline contrast ≥ 4.5:1 everywhere, a wallpaper-grade evening capture, five real homes recognised by their owners.
