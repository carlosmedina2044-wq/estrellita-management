# Today momentum redesign (M7-00…M7-08)

Branch: `v1.1-today-momentum` (from `v1.1-lock-screen-widget`).

## Bundle / assets

- New runtime deps: `motion@12.43.0`, `lottie-web@5.13.0`.
- `public/illustrations` ≈ **528 KB** on disk (`du`); phase-0 script budget enforced at ≤ 500 KB file-size sum in tests (q70 / reduced widths).
- Web production build (`next build`) succeeded after each phase; bundle delta not measured per-phase beyond green builds.

## Device / simulator

- App scheme **simulator builds succeeded** via XcodeBuildMCP (`iPhone 17`) for phases 1–8.
- **Not verified on device**: no ceremony/payoff/widget UI screenshots or lock-screen gauge review in this run.
- Cap sync: Node 22 + `npx cap sync ios` from phase 1 onward.

## Judgment calls

- Illustration encode quality/widths reduced to stay under the 500 KB test budget.
- Halo warnings on sheet cells logged by prepare script (non-failing).
- Transparent Lottie posters (not opaque pack posters).
- Duty-row `layoutId` kept (no clip fallback).
- Care-level ↔ momentum cycle avoided via local helpers in `care-level.ts`.
- `CUTAWAY_ROOMS` polygons hand-tuned once against the crop.
- Ceremony / week-wrapped ledger lines use **month** wording (`ledger.month*`).
- Rectangular widget keeps title/done/empty fallback when `careLabel` is empty; adds `runLabel` when `runLength > 0`.
- Seasonal thumbs: by playbook `triggerMonth` (fires use current month).

## Skills applied

- xcodebuildmcp (iOS builds)
- swiftui-specialist (widget SwiftUI)
- Sosumi (Gauge / accessoryCircularCapacity)

## Remaining

- Visual QA on simulator/device for ceremony, notice cards, cutaway lift, and lock-screen Gauge.
- Optional: tighter cutaway polygons after viewing house-cutaway on cream/dark.
- es/pt-BR copy is handoff draft quality (accepted).
