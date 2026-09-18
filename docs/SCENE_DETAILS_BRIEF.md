# Scene details: asset brief (E4-02)

Seven small looping moments for the living house on Today. Each is a Lottie
file, 512 by 512, transparent, in warm neutral greys and the brand cream so
one file works on the classic, terracotta and slate palettes. The engine and
the anchors already exist (`src/lib/scene/details.ts`, rendered by
`src/components/today/scene-details.tsx` as CSS/SVG placeholders); dropping
the art in means adding the file under `public/illustrations/lottie/<name>/`,
registering it in `src/lib/illustrations.ts`, and replacing the matching
`case` in `scene-details.tsx` with an `IllustratedMoment`.

| Moment | Shows when | Loop | Anchor | Size cap |
| --- | --- | --- | --- | --- |
| Chimney smoke | Closed day, winter or night | 4 s | `chimney` | 20 KB |
| Door lantern | Dusk or night, anything done | 3 s | `door` | 12 KB |
| String lights | Dusk or night, care level loved | 3 s | porch line above the door | 16 KB |
| Porch cat | Closed day, cared-for or above; asleep at night | 5 s (2 states) | porch, right of the door | 20 KB |
| Laundry line | Day, laundry room fresh, no rain or snow | 4 s | left of the house, mid-height | 16 KB |
| Gutter leaves | Autumn, gutter clearing overdue | 6 s | roof edge, upper right | 16 KB |
| Sprinkler arc | Summer day, irrigation done in the last 3 days | 3 s | left ground | 16 KB |

Rules: at most two details at once, best first (lantern, smoke, companion,
string lights, leaves, laundry, sprinkler). The negative state is leaves
alone. Nothing rusts, cracks or turns red. Every moment must have a static
poster for Reduce Motion, and the illustration budget test allows 500 KB plus
120 KB for these seven files.
