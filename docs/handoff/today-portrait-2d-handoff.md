# Cuidala Today: the 2D home portrait — execution handoff (v3)

This document replaces the 3D scene plan (`today-glows-handoff.md` §4–§6 and `today-glows-remediation.md` R2–R4). It keeps the sky engine, the closing ritual, the strings, and the process rules from those documents, and swaps the house from a live WebGL kit to **layered 2D portraits rendered in Blender** from professionally made models, animated in the app with Motion, Rive, and icon families. It is written for an autonomous coding agent (Cursor on auto).

Every decision is made. Do not re-ask. "Judgment call" marks the only places where the agent chooses; record each in the commit body and the stop-point report.

## Why the pivot

Two full attempts at a code-built 3D kit produced box houses (see `today-glows-remediation.md` §0 and the R3 review). The agent is good at assembly, lighting, rendering setup, compositing, and app wiring, and not able to model a house from primitives. The one asset in the app that already meets the bar is `public/illustrations/house.webp`: a warm, soft, clay-like 2D still. This plan produces every archetype at that bar by giving Blender real models to render and giving the app flat layers to composite.

## Tool fit (read before assigning work)

| Tool | Role in this plan | Limits |
|---|---|---|
| Blender 5.2.1 | Renders layered stills from a downloaded CC0 model kit. Owns lighting, camera, palettes, day/night variants, seasons, alpha layers. | Never models geometry from code. |
| Kenney City Kit (Suburban) 2.0, CC0 | 21 suburban house models (`building-type-a` … `-u`: one and two storeys, garages, dormers, solar panels, porches), fences, paths, driveways, planter, two trees. One shared `colormap` material per model with three shipped colour variations. glTF. | Already unpacked at `tools/blender/vendor/kenney-city-kit-suburban/` (gitignored). No apartments, townhouse rows, cabins, or Spanish tile: those home types get the nearest suburban portrait. |
| Motion (`motion`, installed) | Parallax, phase crossfades, window fades, ceremony choreography, icon weight crossfades. | — |
| Rive (`@rive-app/canvas-lite@2.42.1`) | Authored living elements: chimney smoke, birds, companion, fireflies, the sun-drag ritual state machine. | `.riv` files are authored by a human in the Rive editor or licensed from the Rive marketplace. The agent wires the runtime; it cannot author Rive files. Until files exist, the existing Lottie moments stay. |
| Lucide (`lucide-react`, installed) | All control and navigation icons. | Static SVG; animate with Motion. |
| Phosphor (`@phosphor-icons/react@2.1.10`) | Status glyphs inside the scene region only: phase, weather, care level. Duotone and fill weights crossfaded with Motion. | Do not mix families on one surface. |
| SF Symbols | Native surfaces only: the WidgetKit widget and lock-screen widget in `ios/App/CuidalaWidget/`, with symbol effects. | Cannot render inside WKWebView. Never attempt it in `src/`. |

## 0. Rules

All rules from `today-glows-handoff.md` §0 and `today-glows-remediation.md` §2 apply (stop points, gates, staged paths, proof before commit, blocked means stop, one stage per run, strings via `t()` with locale parity). Additions:

1. Allowed new dependencies: `@rive-app/canvas-lite@2.42.1`, `@phosphor-icons/react@2.1.10`. The agent installs them and removes `three` and `@types/three` in P0, in the same commit that deletes the 3D code, so the tree never has a dangling import. Playwright and sharp are already devDependencies.
2. Asset budget: `public/portraits/` ≤ 6 MB. `public/illustrations/` unchanged.
3. Every rendered still passes the halo check already in `scripts/prepare-illustrations.mjs` (`warnHalo`): mean alpha along the 2 px border ≤ 8.
4. The human reviews stills at true size against `public/illustrations/house.webp`. That comparison is the quality gate; there is no SSIM gate in this plan.
5. Opener lines are in §8. Reports go to `docs/handoff/P<n>.md` with screenshots under `docs/handoff/P<n>/`.

## 1. Human preconditions

- Run the two git commands in §2 (backup branch, reset to `fa4e77b`).
- Done on 2026-09-14: the kit is unpacked at `tools/blender/vendor/kenney-city-kit-suburban/` (`Models/GLB format/*.glb`, `Models/Textures/variation-{a,b,c}.png`), `.gitignore` excludes the folder, and `tools/blender/vendor/README.md` records the source and licence. Commit those two files in P0.
- Optional, for P3: author or license Rive files for `smoke`, `birds`, `companion-cat`, `companion-dog`, `fireflies`, `sun-drag`, and place them in `public/rive/`. If absent at P3, the agent keeps Lottie and reports it.

## 2. P0 — `Retire the 3D scene (P0).`

The three 3D commits (`03bbb6a`, `a4555bd`, `2cfb618`) added about 11 MB of kit files, atlases, and reference renders. The branch has never been pushed, so they are dropped from history rather than deleted forward.

**Human step, before run 1:**
```bash
git branch backup/v1.1-3d-pass v1.1-today-momentum
```
```bash
git reset --hard fa4e77b
```
`fa4e77b` is `Fix the Today hero budget and headline (M7-09-r2).` It contains the working hero, the handoff documents, and the M8-01 engine. After the reset the untracked `.gitignore` change, `tools/blender/vendor/`, and this document are still in the working tree.

**Agent work in P0 (one commit):**
- Salvage from `backup/v1.1-3d-pass` with `git checkout backup/v1.1-3d-pass -- <path>` and then edit:
  - `src/components/today-view.tsx`: keep the TodaySheet structure, the scroll listener with the blur layer and compact bar, the `today-night` class, and the ambient background mix; remove the `HomeScene` import and render the M7-09-r2 hero in its place with `sceneMode = false` until P2. Re-read the whole file after the checkout; do not keep anything that references `home-scene`, `resolve.ts`, or `homeSpec`.
  - `src/app/globals.css`: keep the 20 added lines (ambient inset highlight, `.today-night` tokens, `.today-sheet`).
  - `src/components/app-shell.tsx`: keep the one-line change if it is scene-independent; otherwise drop it.
  - `src/i18n/messages/{en,es,pt-BR}.json`: keep the `scene.*`, `today.compactTitle`, and `today.compactClosed` keys.
  - `tools/blender/cuidala_kit/{__init__,world,render,camera}.py`: keep for reuse in P1. Nothing else from `tools/blender/`.
- Do not salvage: `home-scene.tsx`, `home-scene-3d.tsx`, `src/lib/scene/three/`, `assemble.ts`, `archetypes.ts`, `swatches.ts`, `resolve.ts`, `homespec.ts`, `kit-manifest.json`, the `HomeSpec` edits to `types.ts` and `migrate.ts` (P1 writes the v2 shape fresh), `public/scene/`, `src/app/dev/scene/`, `scripts/capture-scene*.mjs`, `scripts/export-*.mjs`, `tools/scene-diff.mjs`, `tools/blender/{kit,check_kit,reference,preview}.py`, `tools/blender/cuidala_kit/{parts,bake,export,layout,materials}.py`, `tools/blender/reference/`, `tools/blender/preview/`, `docs/handoff/M8-02-r2*`, `docs/handoff/M8-03-r2*`.
- Run `npm i @rive-app/canvas-lite@2.42.1 @phosphor-icons/react@2.1.10` (the `three` packages are already absent at `fa4e77b`; confirm with `grep three package.json`).
- Commit `.gitignore` and `tools/blender/vendor/README.md`.
- Gates green. Then `. ~/.nvm/nvm.sh && nvm use 22 && npx cap sync ios` so the iOS bundle no longer carries `public/scene/`, and confirm `ios/App/App/public/scene` does not exist. Today shows the M7-09-r2 hero card; take one 390×844 screenshot of it as proof and commit it under `docs/handoff/P0/`.
- Commit as `Retire the 3D scene (P0).` No stop.

## 3. P1 — `Render the home portraits in Blender (P1).`

### 3.1 HomeSpec v2
Replace `HomeSpec` in `src/lib/types.ts`:
```ts
export type KitType = "a"|"b"|"c"|"d"|"e"|"f"|"g"|"h"|"i"|"j"|"k"|"l"|"m"|"n"|"o"|"p"|"q"|"r"|"s"|"t"|"u";
export type PaletteId = "classic" | "terracotta" | "slate";
export type HomeSpec = {
  version: 2; kitType: KitType; palette: PaletteId;
  windows: Array<{ id: string; roomId: string | null }>;   // ids come from the portrait manifest
  seed: number;
};
```
Migrate: the parse clause accepts version 2 only; anything else is dropped. Delete `src/lib/scene/archetypes.ts` and `swatches.ts`; the 16-archetype vocabulary is retired. `src/lib/scene/palettes.ts` exports the three palette ids with display keys and, for the ambient UI, one representative wall and roof hex per palette (sampled from the generated colormaps in §3.3).

### 3.2 Kit mapping (`tools/blender/portraits/kit.json`)
One entry per kit type `a`–`u`, written by the agent after inspecting each model in Blender and the preview images:
- `features`: `storeys` (1|2), `garage` (0|1|2 doors), `dormers` (count), `solar` (bool), `porch` (bool), `footprint` ("compact"|"standard"|"wide"), `roof` ("gable"|"hip"|"flat"|"mixed").
- `props`: which fence, path, driveway, planter, and tree models to place around it and where (metres), using the kit's own pieces. Trees: `tree-large` and `tree-small` only; place 1–2 by `footprint`.
- `windows`: filled in by the render script (§3.5), not by hand.
Nearest-neighbour distance for the picker = weighted feature difference (storeys 3, garage 2, footprint 2, roof 1, dormers 1, solar 1, porch 1). Home types without a kit match (apartment, condo, townhouse, other) map to the nearest suburban type by the inference rules in §5; the entry card copy already says "a portrait, not a floor plan".

### 3.3 Camera, look, materials
- One camera for all types: three-quarter front like `house.webp` (azimuth 22° left of frontal, elevation 16°), 50 mm, perspective, framed so the house fills 78% of the frame width with 6% ground below the footprint; `film_transparent = True`.
- Lighting: sun 35° elevation from camera-left, warm `#fff1dc`, strength 3.0, angle 3°; sky world at strength 0.6 from the day stops in `sky.ts`; AO on (distance 1.0); a large soft area fill from camera-right at 0.4.
- Every model uses one `colormap` material with a palette texture. Keep that structure. For the clay look, set the Principled roughness to 0.7 and add a 4% noise bump; do not split the mesh by hand.
- Palettes are colormap swaps. `scripts/portrait-palettes.mjs` (sharp) derives three colormaps from the shipped variations: `classic` from `variation-a.png`, `terracotta` from `variation-b.png`, `slate` from `variation-c.png`, each desaturated 15% and warmed slightly toward the app's cream (`#faf6ef`) so they sit with the brand (values: judgment call; keep window glass and foliage cells untouched). Output to `tools/blender/portraits/colormaps/<palette>.png` (committed, tiny).
- Windows: in Blender, classify each face by sampling the colormap at its UV centre; faces whose sampled colour is the glass colour get a separate emission material with a `Lit` driver. Cluster the glass faces by mesh connectivity into individual windows, sort them left to right then top to bottom, and give each an id (`w0`, `w1`, …). Record the glass colour and the window count per model in the manifest. The same UV-sampling step separates foliage faces (leaf green) so seasons can retint them, and door faces (door colour) for the sparkle anchor.

### 3.4 Layers per kit type
Render with view layers and holdouts so every layer is pixel-registered:
| layer | file | content |
|---|---|---|
| day | `<type>-<palette>-day.webp` | full house and props, windows unlit, trees excluded, no ground shadow |
| night | `<type>-<palette>-night.webp` | same, night sky world (stops from `sky.ts` night), sun off, moon key 0.3 |
| lit | `<type>-lit.webp` | window and lantern emission only, everything else holdout; the app adds this additively with a CSS blur duplicate for bloom |
| shadow | `<type>-shadow.webp` | ground contact shadow via shadow catcher, house holdout |
| foliage | `<type>-<season>.webp` (4) | trees only, leaf faces retinted per season (spring `#7fae4f`, summer `#4f8a3b`, autumn `#c8742e`, winter bare: leaf faces hidden) |
| snow | `<type>-snow.webp` | white cap on faces with world normal z > 0.7 (roofs, sills, ground), house holdout |

Counts: 21 × 3 × 2 bases (126) + 21 lit + 21 shadow + 84 foliage + 21 snow = 273 files. Ship 2x only (780 px wide, WebP q82). Target ≤ 6 MB; if over, lower q to 76 before dropping anything. Add 3x variants later only if the budget allows. Record final sizes.

### 3.5 Manifest and script
`tools/blender/portraits/render.py` (headless, args `--type <id>|all`, `--palette`, `--layer`, `--only-missing 1`) writes `src/lib/scene/portrait-manifest.json`: per kit type the frame size, the features from `kit.json`, the house bounding box in frame px, the window rectangles (`id`, `x`, `y`, `w`, `h` in frame px, from projecting each window cluster through the camera; used by the per-window clip paths in P2 and by `assignRooms`), the door centre (sparkle anchor), the chimney top when the model has one (Rive smoke anchor; `null` otherwise, and the smoke moment is skipped for that type), and the file list. `scripts/prepare-portraits.mjs` converts PNGs to WebP, runs the halo check, and writes sizes.

Contact sheet `tools/blender/portraits/contact.webp`: all 21 types in the `terracotta` palette, day + lit + foliage summer + shadow composited, at 260 px wide each, 4 per row, with `house.webp` in the first cell for comparison. A second sheet shows type `a` in all three palettes at day and night.

### 3.6 STOP. Report `docs/handoff/P1.md` with the contact sheet, three full-size composites (types `a`, `k`, `u`, terracotta, day with lit and foliage), the mapping notes, sizes, and judgment calls. The human compares against `house.webp`. **Fallback decision at this stop:** if the renders do not reach the bar after one revision pass, the human generates the stills with the image pipeline that produced the v1.0 asset pack using the same layer list, and P2 proceeds on those files unchanged.

## 4. P2 — `Compose the portrait on Today (P2).`

### 4.1 Layout
The scene region and TodaySheet follow `today-glows-handoff.md` §5.1 exactly (height, sky gradient, scrim, text overlay, compact bar, scroll parallax, ambient vars, `.today-night`). The WebGL canvas is replaced by `<PortraitScene>`:

```
<section role="img" aria-label=…>           // scene region, CSS sky from sceneCssVars
  <SkyDisc/>                                 // sun or moon: CSS radial gradient positioned by sunPosition; stars at night (CSS, 120 dots, opacity by phase)
  <Clouds/>                                  // 0–3 CSS blobs by cloudCover, slow drift
  <PortraitStack>                            // absolutely positioned, house width = 62% of region width, bottom at 92%
    shadow · night base · day base · lit · lit-blur · foliage · snow
  </PortraitStack>
  <RiveLayer/>                               // smoke at chimney anchor, birds, companion, fireflies (P3)
  <Weather/>                                 // existing particle-layer for rain and snow, intensity from sceneWeather
  <StatusGlyphs/>                            // Phosphor duotone: phase, weather; care level
</section>
```

### 4.2 Phase blending (pure CSS + Motion, driven by `skyPhase`)
- `dayOpacity` = 1 for day, 0 for night, interpolated by `t` across dawn, golden, and dusk; the night base sits under the day base and shows through.
- Grade overlay on the stack: `mix-blend-mode: multiply` layer with colour `--sky-mid` at opacity 0 (day) → 0.35 (dusk) → 0.5 (night); golden adds a `soft-light` warm layer `#ffb872` at 0.25.
- `lit` opacity = `windowsLit / windowCount` mapped through the window rectangles: each window gets its own clip-path rectangle from the manifest so windows light one by one as rooms complete; the blurred duplicate (`filter: blur(6px)`) follows at 0.6.
- Seasons swap the foliage layer with a 600 ms crossfade; `snow` fades in with `weather === "snow"` and stays for the day.
- Parallax: sky 0, stack 0.4 of scroll; gyro ±4° maps to ±6 px on the stack and ±10 px on foliage (Motion springs); reduced motion disables both.
- Update cadence: `useNow()` is day-granular, so add a minute ticker inside the scene only, paused when hidden.

### 4.3 Ceremony and care
`houseLight` from M8-01 drives `lit`, lantern, and smoke. The closing ceremony keeps the M7-09-r2 timeline; the scene adds: all windows to full over 500 ms, lantern on, `sparkle-burst` Lottie at the door anchor, and the run strip stagger. Plain variant (momentum off or cleaner): the M7-09-r2 hero card, unchanged.

### 4.4 Screenshots
Type `a` at all five phases, type `k` golden in each palette, type `u` night, type `d` rain, type `h` snow, type `p` winter, scrolled compact bar, light and dark, es and pt-BR headlines, reduced motion. Simulator capture via XcodeBuildMCP after `nvm use 22 && npx cap sync ios` is **required** in this stage (the previous 3D scene failed only on device). STOP. Report `docs/handoff/P2.md`.

## 5. P3 — `Add the portrait picker, Rive moments, and widget stills (P3).`

- Inference: `inferHomeSpec(household)` scores every kit type from `portrait-manifest.json` features: `storeys` 2 when bedrooms ≥ 3 or `hasAttic`, else 1; `garage` from `hasGarage`; `solar` from `hasSolar`; `porch` when a `patio` room exists; `footprint` from room count (≤ 5 compact, ≤ 9 standard, else wide); apartment, condo, townhouse, and other → `storeys` 2, `garage` 0. Best score wins; ties broken by the `householdName` seed. Palette by climate zone: hot-arid and humid-subtropical → `terracotta`, cold and marine → `slate`, mixed → `classic`, then the seed may swap to a neighbour 30% of the time. `assignRooms` maps rooms to manifest window ids in household order. Tests over a fixture grid (5 zones × 5 home types × attribute toggles × 4 seeds).
- Strings: none of the `portrait.*` keys or `settings.portrait` exist yet (the first pass never reached M8-04). Add them from `today-glows-handoff.md` §7 in this commit, en/es/pt-BR, minus the `portrait.option.material.*`, `portrait.option.porch.*`, `portrait.walls/roof/door`, `portrait.surprise`, and `portrait.reset` keys, which this plan does not use.
- Entry card and picker per `today-glows-handoff.md` §6, reduced to two rounds: round 1 shape (inferred type + its two nearest by the §3.2 distance), round 2 palette. Cards are `<PortraitStack>` at 335 × 180 in the day state. Dials are removed. Card labels are composed from feature strings joined with ` · `: `portrait.feature.storeys1` = `Single storey` | `Una planta` | `Térrea`; `portrait.feature.storeys2` = `Two storeys` | `Dos plantas` | `Dois andares`; `portrait.feature.garage` = `Garage` | `Garaje` | `Garagem`; `portrait.feature.dormers` = `Dormers` | `Buhardillas` | `Águas-furtadas`; `portrait.feature.solar` = `Solar` | `Solar` | `Solar`; `portrait.feature.porch` = `Porch` | `Porche` | `Varanda`; `portrait.feature.wide` = `Wide` | `Amplia` | `Ampla`; `portrait.feature.compact` = `Compact` | `Compacta` | `Compacta`. Palette names: `portrait.palette.classic` = `Classic` | `Clásica` | `Clássica`; `portrait.palette.terracotta` = `Terracotta` | `Terracota` | `Terracota`; `portrait.palette.slate` = `Slate` | `Pizarra` | `Ardósia`. The `portrait.archetype.*` keys are not added.
- Rive: `src/components/rive-moment.tsx` mirrors `illustrated-moment.tsx` (lazy load, reduced-motion poster, `hidden` pause) using `@rive-app/canvas-lite`; state machine inputs `closed`, `phase`, `season`. Wire `smoke`, `birds`, `companion`, `fireflies` where files exist in `public/rive/`; otherwise keep Lottie and report which are missing.
- Widget stills: the existing `cuidala-widget` plugin only writes a JSON snapshot (`updateSnapshot`, `clearSnapshot`). Add a method `updatePortrait({ pngBase64: string })` to `plugins/cuidala-widget/` (TS definitions, web stub, Swift implementation writing `portrait.png` into the App Group container next to the snapshot). On `homeSpec` change and once per phase change while the app is foregrounded, composite the current stack (day or night base, lit, foliage, shadow) to a 2x PNG with an offscreen canvas and call it. `CuidalaWidget.swift` reads the file and shows it with SF Symbols for phase and weather, using `.symbolEffect(.pulse)` on the lantern glyph when the day is closed. `nvm use 22 && npx cap sync ios` and a simulator screenshot of the widget are required.
- Screenshots: entry card, both rounds, three resulting scenes, widget preview. STOP. Report `docs/handoff/P3.md`. End of this handoff.

## 6. Acceptance
- P0: history tip is `fa4e77b` plus one P0 commit; no `three` in `package.json`; no `public/scene/` in the tree or the iOS bundle; TodaySheet, compact bar, and ambient CSS present but inactive; hero screenshot committed; gates green.
- P1: 21 kit types rendered in 3 palettes with all layers (273 files); halo check clean; `public/portraits/` ≤ 6 MB; both contact sheets approved by the human against `house.webp`.
- P2: phases blend without a visible seam between day and night bases; windows light per room; parallax and reduced-motion verified; simulator screenshot shows the composed portrait on device.
- P3: picker screenshots; widget still on the simulator home screen; Rive moments wired where files exist.

## 7. What is reused unchanged
`src/lib/scene/{sun,sky,weather,season,light,css}.ts` and tests; `MomentumSettings.nightFollowsSky`; the WeatherKit condition and cloud-cover fields; the M7-09-r2 hero and ceremony; `IllustratedMoment`; `particle-layer.tsx`; `RoomTypeIcon`; the `scene.*`, `settings.nightFollowsSky*`, and `today.compact*` strings already in the catalogs (`portrait.*` and `settings.portrait` are added in P3).

## 8. Opener lines
| Run | Opener line |
|---|---|
| 1 | `Execute P0 and P1 from docs/handoff/today-portrait-2d-handoff.md. Stop at the P1 stop point.` |
| 2 | `Execute P2 from docs/handoff/today-portrait-2d-handoff.md. Stop at the P2 stop point.` |
| 3 | `Execute P3 from docs/handoff/today-portrait-2d-handoff.md. Stop at the P3 stop point.` |
