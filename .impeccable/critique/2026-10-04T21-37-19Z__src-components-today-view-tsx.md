---
target: "Cuidala iPhone app: Today, Home, Restock, Settings"
total_score: 22
max_score: 36
na_heuristics: 9
p0_count: 0
p1_count: 3
target_identity: "file:/Users/medina/estrellita-management/src/components/today-view.tsx"
target_fingerprint: "sha256:cb4875dc1dc4e733c79128990b8c4fc22a11872dd33ca9ab051f7a131edaca3a"
target_path: /Users/medina/estrellita-management/src/components/today-view.tsx
timestamp: 2026-10-04T21-37-19Z
slug: src-components-today-view-tsx
---
# Critique: Cuidala iPhone app (Today, Home, Restock, Settings)
Method: dual-agent (design review + detector). Score 22/36 (heuristic 9 n/a). Acceptable.

Priority issues
- [P1] Today stacks status cards above the chores (distill, layout)
- [P1] Ring and status line repeat one number (clarify)
- [P1] Home opens on a red alarm and has no house (colorize, shape)
- [P2] Seasonal rows truncate and look alike (adapt, polish)
- [P2] Ambiguous or hidden controls: House look chevron, Quick add under tab bar (polish)

Detector: 20 findings (12 colour, 4 font-size, 2 font, 2 radius), mostly illustration colours and system font stacks.
