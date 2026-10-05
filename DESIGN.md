---
name: Cuidala
description: A calm, native-feeling iPhone home-care app. Warm paper, borderless tonal cards, one slate-blue tint taken from the house roof.
colors:
  canvas: "#f4f1ec"
  card: "#fffdf9"
  ink: "#1b1f24"
  ink-muted: "#5d6670"
  tint: "#2f5d8a"
  tint-on: "#ffffff"
  done: "#277046"
  done-soft: "#e3f1e8"
  soon: "#8c5a00"
  soon-soft: "#f8eccd"
  overdue: "#b5352a"
  overdue-soft: "#fbe6e2"
  secondary: "#e8e6e1"
  dark-canvas: "#101418"
  dark-card: "#1a2028"
  dark-ink: "#eef1f4"
  dark-ink-muted: "#9aa4af"
  dark-tint: "#8fb6e0"
  dark-tint-on: "#0d1722"
  dark-done: "#72c58f"
  dark-soon: "#e6b450"
  dark-overdue: "#f27d68"
typography:
  display:
    fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif"
    fontSize: "1.647rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.022em"
  title:
    fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif"
    fontSize: "1.176rem"
    fontWeight: 600
    lineHeight: 1.25
  card:
    fontFamily: "-apple-system, SF Pro Text, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "-apple-system, SF Pro Text, system-ui, sans-serif"
    fontSize: "0.941rem"
    lineHeight: 1.4
  caption:
    fontFamily: "-apple-system, SF Pro Text, system-ui, sans-serif"
    fontSize: "0.8rem"
    lineHeight: 1.35
  hero:
    fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.022em"
  hero-serif:
    fontFamily: "ui-serif, New York, Georgia, serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.05
  numerals:
    fontFamily: "ui-rounded, SF Pro Rounded, system-ui, sans-serif"
    fontVariantNumeric: "tabular-nums"
rounded:
  control: "8px"
  input: "12px"
  container: "20px"
  card: "16px"
  pill: "9999px"
spacing:
  gutter: "20px"
  row-min-height: "56px"
  tap-target: "44px"
components:
  button-primary:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.tint-on}"
    rounded: "{rounded.pill}"
    height: "44px"
  card-group:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.container}"
  field:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.input}"
    height: "44px"
---

# Design System: Cuidala

## Overview

A home-care app should lower worry, so the interface stays quiet: a neutral warm
canvas, tonal grouped lists, and a single slate-blue tint for anything you can
act on. It is an iPhone app first. Where the platform has an answer (system
picker, tab bar, large title, Dynamic Type, Dark Mode, haptics), use it rather
than inventing one. The illustrated house is the one place the app is allowed to
be expressive; everything around it is plain.

Product truth lives in `PRODUCT.md`. The plain-language rule in `AGENTS.md`
governs every user-facing string.

## Colors

- **Tint (`tint`, `dark-tint`)** is the only accent: buttons, links, the active
  tab, focus rings. Never decoration.
- **Status** is separate from the tint: `done` green, `soon` amber, `overdue`
  red. Each has a soft background for badges. Do not use the tint for status.
- **Neutral**: `canvas` behind, `card` on top, `secondary` for controls resting
  on a card (segmented track, quiet buttons). `ink-muted` is the lowest-strength
  text; do not fade text further with opacity.
- Illustration colours (lantern and hearth glows, sun, moon, ember particles in
  the Today scene) are exempt: they belong to the art, not the interface, and
  are not tokens. Everything else is a token.
- Light and Dark are both first-class. Every colour is a token in
  `src/app/globals.css` (`:root` and `.dark`); never write a raw hex in a
  component. Text and status colours are checked at 4.5:1 on their surfaces.
  Increase Contrast strengthens borders and muted text.

## Typography

System fonts only: SF Pro (the `-apple-system` stack), New York (`ui-serif`)
for the one serif hero line, and SF Pro Rounded (`ui-rounded`) for changing
numbers. None are bundled webfonts.

San Francisco via the system stack, so text follows Dynamic Type. Five named
styles (`ui-display`, `ui-title`, `ui-card`, `ui-body`, `ui-caption`) are the
whole scale; use them, not ad-hoc sizes. Numbers that change use `num`
(tabular). Type over artwork (the Today greeting) and the collapsed title bar
grow with Dynamic Type only up to a cap.

## Layout

20px gutter, one column, portrait iPhone. Lists are inset grouped rows with a
56px minimum height. Every tappable control is at least 44pt. Rows that hold a
name and a status must wrap rather than truncate, because large text is
expected. Safe areas are respected on all edges; fixed and sticky elements
offset by the safe-area inset rather than pinning to `top: 0`.

## Elevation & Depth

Flat. Depth comes from a tonal card sitting on the canvas, with no stroke and
no shadow. Hairlines only separate rows inside a group, and outline fields
only where a field is the thing being edited. Blur is used only for the tab bar and the collapsed title bar, and
both fall back to solid under Reduce Transparency.

## Shapes

Containers 20px, inputs 12px, small controls 8px, chips and primary buttons are
pills. One stroke weight for icons (1.75).

## Components

- **Grouped list**: `ui-group` with `ui-group-row` children; the default
  container for anything repeated.
- **Primary button**: filled tint, pill, one per screen.
- **Quiet button**: outlined or `secondary` pill, for the second action.
- **Picker**: a real `<select>` (`ui/select.tsx`), so iOS shows its own picker.
- **Page header**: large title that collapses into a blurred bar on scroll
  (`page-header.tsx`).
- **Status chips and rows**: status colour on text only, soft background for
  badges; "All caught up" is muted, not green.

## Do's and Don'ts

- Do lead each screen with what is left to do, then the rest.
- Do wrap text for large type; check Dark and an accessibility text size.
- Do use `min-h-11` on anything tappable.
- Don't add a second accent colour or tint a card background. The old terracotta lives only in the illustration (door, fence); the UI tint is slate blue.
- Don't nest cards, or add a card around a single line of text.
- Don't use model words in copy (see `AGENTS.md`, plain-language rule).
- Don't fix sizes in `px` for text, except where it sits over artwork or in a
  fixed-height bar, and then cap it with `min()` / `clamp()`.
