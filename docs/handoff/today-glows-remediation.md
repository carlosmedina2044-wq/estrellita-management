# Cuidala Today: remediation handoff for "A well-kept home glows"

This document fixes the run that produced commits `6e26f90` (M7-09) through `b39fcce` (M8-04) on `v1.1-today-momentum`. It is written for an autonomous coding agent (Cursor on auto) and is used **together with** `docs/handoff/today-glows-handoff.md` (the v2 spec). The v2 spec still defines every layout number, API, string, and Blender setting. This document defines what was wrong, what is reset, the new hard rules, and the order of work.

## 0. What went wrong (read this first)

Findings from a review of the committed work on 2026-09-14:

| # | Finding | Evidence |
|---|---|---|
| 1 | All four stages were committed in one run; no stop-point review happened. | Commits `6e26f90`, `409d939`, `0d5945e`, `fd7b02a`, `b39fcce` span about twenty minutes. |
| 2 | No screenshot was captured for any task; no SSIM table was produced. | `.verify-screenshots/M7-09/` and `docs/handoff/M7-09/` are empty; reports say the browser was unreachable and "Playwright install was blocked". |
| 3 | The kit is a box kit. No reference tier, no booleans, no relief. | `tools/blender/cuidala_kit/parts.py` is 185 lines; only `_box` and simple prisms. |
| 4 | The "bake" writes solid-colour images. | `bake.py` uses `bpy.data.images.new(...).generated_color`; every atlas is 59,58x bytes. |
| 5 | Geometry is built mirrored. `_box` in `parts.py` spans Blender y ∈ [−d, 0] instead of [0, +d], so every exported part extends toward +Z (toward the camera) and openings at z = 0.02 sit inside the wall box. `layout.py`'s conversion `(x, −z, y)` and `assemble.ts` are correct; only the part builders are wrong. | glTF accessor bounds: `wall_plaster_8` z 0.00..5.60; `door_unit` z 0.00..0.20 at the same face. Renders show blank walls. |
| 6 | Reference renders were cut: 128 samples, look None, camera moved to (16, 9, 22), bloom skipped, fog showcase is an 8 KB blank frame. | `docs/handoff/M8-02.md`; `tools/blender/reference/showcase/farmhouse-dawn-fog-autumn.webp`. |
| 7 | The runtime scene draws nothing. Families load, 15 parts are placed, camera is finite, no console errors, canvas stays empty at every phase. | Verified in a 390×844 browser on the dev server with `?scene=cottage,golden` and `?scene=cottage,night`. |
| 8 | Headline reads "Nothing due. is next." | `home-scene-3d.tsx` passes `day: ""` to `t()`. |
| 9 | Hero heights exceed budget by the agent's own estimate (open ~280–318 px vs 260; closed ~430 px vs 400). | `docs/handoff/M7-09.md`. |
| 10 | Picker cards are CSS tints, not live 3D. | `docs/handoff/M8-04.md`. |
| 11 | `three` is used without types (`src/types/three.d.ts` shim). | `docs/handoff/M8-03.md`. |
| 12 | An uncommitted edit to `src/lib/momentum.ts` was left in the working tree. | `git status`. |

The pattern behind all of it: when a tool or asset was unavailable, the agent substituted a cheaper version of the task and continued, instead of stopping. The rules in §2 make substitution impossible.

## 1. Reset (the human does this before the run)

```bash
git branch backup/v1.1-first-pass v1.1-today-momentum
git stash push -m "momentum historyFloor(now) from first pass" -- src/lib/momentum.ts
git reset --hard 409d939
```

`409d939` is M8-01 (`Add the scene engine`). It is kept: pure logic, tests pass, and the WeatherKit plugin fields are correct. M7-09 (`6e26f90`) is kept too; its defects are fixed in R1 below. Everything from M8-02 on is redone.

Preconditions the human installs so the agent cannot report them as blocked:

```bash
npm i -D playwright@1.63.0 sharp@0.35.4 @types/three@0.186.0
```

```bash
npx playwright install chromium
```

```bash
git add package.json package-lock.json && git commit -m "Add verification tooling (R0)."
```

Confirm `/Applications/Blender.app/Contents/MacOS/Blender --version` prints `Blender 5.2.1 LTS`. Then start the run with the opener line from §5.

After the reset, the first-pass reports (`M8-02.md`, `M8-03.md`, `M8-04.md`) and all first-pass scene code exist only on `backup/v1.1-first-pass`. `docs/handoff/today-glows-handoff.md` and this file are untracked and survive the reset; commit both in R1.

Amendment to v2 §0 rule 8: `@types/three@0.186.0` is an allowed devDependency (installed above). `src/types/three.d.ts` must not exist.

## 2. Hard rules for this run (in addition to v2 §0)

1. **Blocked means stop.** If a screenshot, render, bake, or measurement required by a task cannot be produced, write the stop-point report with the exact command and error and end the run. Never substitute: no estimated heights, no solid-colour "bakes", no CSS stand-ins for 3D, no reduced sample counts, no moved cameras. A judgment call changes a detail; it never removes a deliverable.
2. **Proof before commit.** Every commit that touches UI includes the listed screenshots under `docs/handoff/<task>/` (WebP, ≤ 8). Every Blender commit includes the contact sheet and renders. A commit without its proof is a failed gate.
3. **One stage per run.** The opener line names the stage. When the stop point is reached, end the run even if the next stage looks easy.
4. **Write new reports as `docs/handoff/<task>-r2.md`.** The first-pass reports live on the backup branch; do not restore them.
5. **Coordinate convention is tested, not described.** See R2 §3.2.
6. **A bake is a bake.** Any atlas written without `bpy.ops.object.bake` from a high-poly source is a failed gate. `check_kit.py` verifies it (R2 §3.4).
7. **Sample counts, camera, and resolution in v2 §4.3 are minimums, not suggestions.** The only allowed overrides are `--samples` for local smoke checks, never for committed frames.

## 3. Work items

### R1 — `Fix the Today hero budget and headline (M7-09-r2).`

- Measure the hero with Playwright at 390×844, `deviceScaleFactor: 2`, using the existing `/dev/hero/?state=…` fixture. Record `getBoundingClientRect().height` for open-many, open-one, closed-settled, clear, momentum-off in light and dark, plus es-open and pt-BR-closed.
- Bring open ≤ 260 px and closed ≤ 400 px. Allowed levers, in this order: card padding 16 → 12; reward illustration 120 → 88; orbit 116 → 104; `ui-hero-serif` 2.125rem → 2rem. Stop at the first lever that fits. Record which.
- Headline day name: `today-hero.tsx` already computes `dayLabel = arc.nextUp ? formatWeekdayDate(arc.nextUp) : ""`. Extract that into a shared helper (`src/lib/today-copy.ts`) and use it in `home-scene-3d.tsx` instead of `day: ""`. Both clear-pool strings (`today.heroClear1`, `today.heroClear2`) contain `{day}`, so add a third, `today.heroClear3` = `All clear. Nothing on the horizon.` | `Todo en orden. Nada en el horizonte.` | `Tudo em dia. Nada no horizonte.`, and make `heroCopyKey` return it whenever `nextUp` is null. Never render a headline with an empty slot or an em dash placeholder.
- Apply the stashed `historyFloor(household, now)` change only if a test covers it; otherwise drop the stash.
- Screenshots per v2 §2.6. STOP. Report `docs/handoff/M7-09-r2.md`.

### R2 — `Build the kit in Blender and add HomeSpec (M8-02-r2).`

Everything in v2 §4 applies. The following are corrections and additions.

#### 3.1 Reuse from the first pass
`src/lib/scene/archetypes.ts`, `swatches.ts`, `assemble.ts`, `HomeSpec`, the migrate clause, `layout.py`, and the parity test may be restored from `backup/v1.1-first-pass` with `git checkout backup/v1.1-first-pass -- <path>` where they match the v2 spec. Re-read each restored file. `assemble.ts` and `layout.py` already follow the convention below; the fix is in `parts.py`, which must be rewritten rather than restored.

#### 3.2 Coordinate convention (the fix for finding 5)
- Runtime space: x right, y up, **−z is into the house, +z is toward the camera**. Every part's origin is front-bottom-centre. A wall of depth d spans z ∈ [−d, 0]. Face-mounted parts (windows, doors, garage doors, dormer, bay, shutters) span z ∈ [−0.12, +t] where t is their outward thickness. The camera sits at +z.
- Blender build space: Z up, **front toward −Y, body toward +Y**. So the wall spans y ∈ [0, +d]. With `export_yup=True` Blender +Y becomes glTF −Z, which is into the house. The first pass built y ∈ [−d, 0] and got the mirror image.
- Placement conversion in `layout.py`: runtime (x, y, z) → Blender (x, −z, y). Only this helper converts.
- **Test (Blender side, in `check_kit.py`):** re-import every GLB and check the local bounding box in runtime space against this table. Any part outside its row fails the run.

| part class | min.z | max.z | note |
|---|---|---|---|
| `wall_*` | ≤ −4.0 (narrow), ≤ −5.5 (standard), ≤ −7.6 (wide) | ≤ 0.02 | body is entirely behind the front face |
| `roof_*`, `gable_end_*` | ≤ −4.0 | 0.40 … 0.50 | eave overhang 0.45 toward the camera only |
| `window_*`, `door_unit`, `garage_door_*`, `shutter_pair`, `lobby_door` | −0.14 … −0.10 | 0.02 … 0.30 | reveal behind the face, frame/step in front |
| `dormer`, `bay_window`, `balcony` | ≤ −0.5 (dormer), −0.05 … 0 (bay, balcony) | dormer ≤ 0.9; bay 1.3; balcony 1.4 | the only wall-mounted parts allowed to project |
| `porch_stoop`, `porch_small`, `porch_full_*`, `porch_wrap` | −0.05 … 0 | stoop 1.2; small 2.4; full 2.4; wrap 2.4 | porches sit in front of the wall |
| `gutter`, `downspout`, `skirting`, `courtyard_wall`, `fence_*`, `path_segment`, `bed`, `neighbour_slab`, `facade_module` | ≤ −0.05 | ≤ 0.02 | body behind the origin plane |
| `chimney`, `solar_panel`, `planter`, `tree_*` | ≥ −2.5 | ≤ 2.5; chimney and planter within ±0.5; solar within ±0.9 | centred on their origin; placed by `assemble.ts` at explicit z |

The table is the contract for `assemble.ts` too: it places porches, path, beds, fence, and trees at positive z, and everything else at z ≤ 0.02.
- **Test (node side, `assemble.test.ts`):** every window and door placement has z within 0.05 of the wall front (0); every chimney placement has y ≥ the wall eave; the cottage render list contains door, 3 windows, porch, dormer, chimney, 2 trees, fence.
- **Visual proof:** `tools/blender/preview/kit.webp` must show windows and a door mounted on the front of a wall module, viewed from the camera side, in the first row.

#### 3.3 Reference tier is mandatory (the fix for finding 3)
`parts.py` builders take `tier: Literal["kit", "reference"]`. At `reference` tier:
- Openings are cut into the wall with boolean modifiers; reveals are real geometry 0.12 m deep.
- Roof surfaces carry real relief: shingles as an array of overlapping strips (0.3 m rows), tiles as an array of half-cylinders, standing-seam metal as ribs every 0.4 m.
- Siding laps, brick courses, and log rows are geometry (array modifier), not bump.
- Bevel 0.02 m / 3 segments on every hard edge; subdivision level 1 on trunks and leaf clusters; leaf clusters displaced by noise.
- Interior cards behind every window (v2 §4.1).
At `kit` tier the same builders emit the low-poly shell. `check_kit.py` fails if any reference-tier part has fewer than 4× the triangles of its kit-tier twin (proves the detail exists).

#### 3.4 Real bakes (the fix for finding 4)
- `bake.py` uses `bpy.ops.object.bake` with `use_selected_to_active=True`, `cage_extrusion=0.03`, `max_ray_distance=0.05`, from the reference-tier twin to the kit-tier part. Headless bake requirements: `scene.render.engine = 'CYCLES'`; the reference twin overlaps the kit part at the same origin and is hidden after the bake; every kit material has an `ShaderNodeTexImage` node pointing at the family atlas and set as `nodes.active` before each bake; select the twin, make the kit part active; save the atlas with `image.save()` after each pass. Types: `DIFFUSE` (colour only, direct/indirect off) for albedo, `NORMAL` (tangent, OpenGL +Y), `AO`, and an `EMIT` pass of Geometry ▸ Pointiness for curvature. Roughness comes from the family table.
- `check_kit.py` opens every atlas and fails if the unique colour count is below 256 or if any normal atlas is uniform.
- Atlas budget per v2 §4.2 (≤ 8 MB total).

#### 3.5 Renders (the fix for finding 6)
- Camera at (9, 6.5, 11) runtime space, look-at (0, 1.6, 0), 35 mm, `shift_y` from the bbox rule. If a 1.5-storey roof does not fit, **adjust `shift_y` and lens (down to 32 mm), never the position.** Record the values.
- Samples: adaptive, min 128, max 1024. Committed frames never use fewer.
- Compositor: enumerate `bpy.types.CompositorNodeGlare.bl_rna.properties` and its `inputs` on this build, then use whichever exposes bloom (in 5.x the mode may be a socket or a property; record what you find). Bloom is required.
- AgX view transform. If no "Base Contrast" look is listed, use `None` and tune per-phase exposure so the sunward wall's brightest pixel is ≤ 235/255 and the lit windows at dusk read ≥ 200/255 in the green channel. Measure inside Blender: `numpy.array(bpy.data.images.load(path).pixels)` reshaped to (h, w, 4), sampled in a rectangle the script derives from projecting the wall bbox through the camera. Record the measured values in the report.
- Add to `.gitignore`: `__pycache__/`, `tools/blender/preview/png/`, `tools/blender/reference/showcase/png/`.
- Fog showcase: world Principled Volume density 0.02 with `volume_max_steps` 64; the frame must show the house. An 8 KB output is a failed frame.
- Ground: the 40 m disc's edge must not be visible in any frame (raise the camera pitch via `shift_y`, or enlarge the disc to 80 m).
- Quality checklist v2 §4.3 is applied per frame and the results tabulated in the report.

#### 3.6 STOP. Report `docs/handoff/M8-02-r2.md` per v2 §4.6.

### R3 — `Add the 3D home scene (M8-03-r2).`

Everything in v2 §5 applies. Additions for finding 7:

- **Bisect before building.** Step one is a dev-only red `BoxGeometry` cube at the origin with `MeshBasicMaterial`, no lights, no kit. Capture it at 390×844. If the cube is not visible, the fault is in the renderer, canvas sizing, effect lifecycle, or loop, and the kit is irrelevant; fix that first. Only then load the kit.
- **First deliverable is a screenshot of a visible house.** An intermediate commit `Render the kit in the Today scene (M8-03a).` is allowed for this checkpoint; the rest of the stage lands as `Add the 3D home scene (M8-03-r2).`. Before wiring TodaySheet, scroll, ambient vars, or weather, get the cottage at `?scene=cottage,day` rendering in a 390×844 Playwright capture and commit that screenshot with the engine. If the house does not appear, stop and report with the following diagnostics, which the engine must expose in dev builds on `window.__cuidalaScene`: `house.children.length`, `renderer.info.render.calls` and `.triangles` after a paint, `camera.projectionMatrix` NaN check, the loop's frame counter, `document.visibilityState`, and `renderer.getContext().isContextLost()`.
- Known hazards to rule out, in order: React StrictMode double-mounting the effect (create the engine in a ref-guarded initializer and dispose only on real unmount); the idle loop dying after `document.hidden` for 60 s and never restarting (restart on `visibilitychange`); `renderer.render` producing zero draw calls because materials were replaced with transparent clones; `preserveDrawingBuffer` not needed for display, but `toDataURL` for the fallback still requires a same-frame capture.
- Use `@types/three`; delete `src/types/three.d.ts`. No loose `any` in the engine.
- Playwright capture uses `chromium.launch({ args: ["--use-angle=metal", "--ignore-gpu-blocklist"] })`; if WebGL still fails, launch headed. Record which.
- SSIM table is mandatory (v2 §5.2). STOP. Report `docs/handoff/M8-03-r2.md`.

### R4 — `Infer the home portrait and add the picker (M8-04-r2).`

Everything in v2 §6 applies. Addition for finding 10: the picker cards are live 3D through one renderer with `setScissor`/`setViewport`, as specified. If battery is the concern, render each card once on selection change (no loop) and cache the frame as an image. STOP. Report `docs/handoff/M8-04-r2.md`.

## 4. Acceptance for this remediation

- R1: measured heights within budget in both themes; headline correct with and without a next-up day; all sixteen captures (eight states × light/dark) in `.verify-screenshots/M7-09-r2/`, the eight most informative committed under `docs/handoff/M7-09-r2/`.
- R2: `check_kit.py` passes including the z-convention, bake-uniqueness, and tier-ratio checks; contact sheet shows mounted openings; 80 grid frames at ≥ 128 adaptive samples with bloom; 6 showcase frames each ≥ 150 KB; exposure and look values recorded.
- R3: committed screenshot of a visible cottage; SSIM ≥ 0.85 on all 80 pairs; dev diagnostics object present; no type shims.
- R4: picker screenshots show live 3D cards.

## 5. Opener lines

| Run | Opener line |
|---|---|
| 1 | `Execute R1 only from docs/handoff/today-glows-remediation.md with docs/handoff/today-glows-handoff.md as the spec. Stop at the R1 stop point.` |
| 2 | `Execute R2 only from docs/handoff/today-glows-remediation.md with docs/handoff/today-glows-handoff.md as the spec. Stop at the R2 stop point.` |
| 3 | `Execute R3 only from docs/handoff/today-glows-remediation.md with docs/handoff/today-glows-handoff.md as the spec. Stop at the R3 stop point.` |
| 4 | `Execute R4 only from docs/handoff/today-glows-remediation.md with docs/handoff/today-glows-handoff.md as the spec. Stop at the R4 stop point.` |
