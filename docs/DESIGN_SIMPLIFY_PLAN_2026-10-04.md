# Simplify pass, 2026-10-04 (Impeccable review)

Goal: fewer boxes, one clear thing per screen, quieter colour. Copy follows
the plain-language rule in AGENTS.md; no new strings are invented here.

## Applying now
1. **Today, "This week" card** (`today/quest-card.tsx`): drop the filled card and
   the extra body paragraph. Keep the goal name, its count, days left and the
   progress track, as one compact block. The green "done" state stays.
2. **Restock rows** (`gauge.tsx`, `restock-view.tsx`): a full, calm supply shows
   just its caption, not a grey bar. The bar returns when stock is low or on the
   way. "Walk house" becomes a real bordered button.
3. **Home money card** (`forecast-card.tsx`): a quiet one-line row. No tinted
   background, no gauge, no "Open forecast" text link; a chevron says it opens.
4. **Home rooms** (`home-map-view.tsx`): "All caught up" is quiet grey text, so
   only rooms that need attention carry colour.
5. **First screen** (`onboarding.tsx`): "Use a sample home instead" becomes a
   secondary button.
6. **Detector finding**: em-dashes in `global-error.tsx`.

## Not doing in this pass (needs a device check)
- Shorter house art on Today (`today/portrait-scene.tsx`, 856 lines).
- Reordering Home rooms by urgency (changes the user's own room order).
- Tab bar: labels already exist; the browser preview clipped them.
- A full type-scale and colour-token consolidation in `globals.css`.
