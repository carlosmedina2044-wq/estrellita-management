# Scene details: asset brief (E4-02)

> **Status 2026-10-04.** Smoke, leaves and sprinkler are now rendered loops
> (`tools/blender/fx/`, sprite strips in `public/fx/`, played by `SpriteLoop`
> in `scene-details.tsx`). The planter, window box, bench and wreath are 3D
> renders in `public/props/`. The porch light, string lights, cat and laundry
> line are still CSS/SVG. The houses themselves are now a Blender diorama
> (lawn slab, clay trees and bushes, stone path; `tools/blender/portraits/
> diorama.py`) with a new `ground` layer replacing `shadow`. The Lottie plan
> below is superseded for the seven moments above.

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
| Porch light | Dusk or night, anything done | fade-up, then flicker | wall beside the door head | 12 KB |
| String lights | Dusk or night, care level loved | 3 s | porch line above the door | 16 KB |
| Porch cat | Closed day, cared-for or above; asleep at night | 5 s (2 states) | porch, right of the door | 20 KB |
| Laundry line | Day, laundry room fresh, no rain or snow | 4 s | left of the house, mid-height | 16 KB |
| Gutter leaves | Autumn, gutter clearing overdue | 6 s | roof edge, upper right | 16 KB |
| Sprinkler arc | Summer day, irrigation done in the last 3 days | 3 s | left ground | 16 KB |

Rules: at most two details at once, best first (lantern, smoke, companion,
string lights, leaves, laundry, sprinkler). The porch light is the one that
has to read as light rather than as an object: the fitting is drawn about the
size of the door handle it hangs beside, and the wash falling down the wall
does the work. It comes on once and then only flickers — the version that
breathed 15% wider every three seconds read as a sticker. The negative state is leaves
alone. Nothing rusts, cracks or turns red. Every moment must have a static
poster for Reduce Motion, and the illustration budget test allows 500 KB plus
120 KB for these seven files.

## Care decorations (E5-02)

Four static pieces, one per care level above `settling-in`, cumulative: a
house at Loved shows all four. Unlike the details above, these do not come and
go — they are what the ladder pays out, and they stand all day, which is the
only reason a Settling-in house and a Loved house look different at noon.
Losing a level takes its piece back off the house.

| Piece | Earned at | Anchor | Size cap |
| --- | --- | --- | --- |
| Planter | Kept | ground, clearest point along the front | 10 KB |
| Window box | Well kept | on a front sill, clear of the porch | 10 KB |
| Bench | Cared for | on the lawn past the right corner | 12 KB |
| Door wreath | Loved | door face, below the lantern | 8 KB |

Anchors are computed per kit, not fixed: the door sits anywhere from a third
to two thirds across, so the ground positions are found by scanning the front
for the point furthest from everything already standing there. The first pass
used constants and put the wreath under the porch lantern on all 21 kits and
the planter on the sprinkler on 12. `care-decor.test.ts` measures every pair
on every kit and fails on a regression. The one standing exception is the
window box: it is pinned to a real sill, so on the six single-storey kits
whose only low window sits over the porch it lands near whatever is there.

The `door` anchor is now measured out of the renders rather than taken from
Blender's door-face centroid, which averaged in the back door and the hidden
edges and landed on the roof on every kit — see
`scripts/derive-door-anchors.mjs` and the fix in
`tools/blender/portraits/render.py`. It carries the door's size as well as its
centre, so anything on the porch is placed off the door's own height. Three
kits (`p`, `r`, `s`) hide their entrance from the camera and fall back to
`doorAnchor()` in `src/lib/scene/portrait.ts`.

Static PNG or SVG, not Lottie: nothing here animates, so nothing here competes
with the living details. Same warm neutral palette as the details so one file
works on classic, terracotta and slate. The model and the anchors already
exist (`src/lib/scene/care-decor.ts`, rendered by
`src/components/today/care-decor-layer.tsx` as CSS/SVG placeholders); dropping
the art in means replacing a `case` there.

Preview any combination on the dev page:
`/dev/portrait?care=loved` for the earned set, or `?decor=planter,wreath` to
force specific pieces.

## The day's visitor (E5-06)

Five short loops, one of which may turn up on a day that was closed — roughly
one closed day in four, fixed for the day so it cannot be rerolled by
reopening the app, and never on a day that was not closed.

| Visitor | Comes when | Loop | Anchor | Size cap |
| --- | --- | --- | --- | --- |
| Birds | Daylight, not winter, dry | 6 s, crosses frame | upper right | 20 KB |
| Butterfly | Daylight, spring or summer, dry | 5 s | mid left | 16 KB |
| Rainbow | Daylight during rain | 8 s, slow fade | above the roof | 16 KB |
| Moth | Dusk or night | 4 s | near the porch light | 12 KB |
| Deer | Dawn or dusk, autumn or winter | 8 s | lower left, on the grass | 24 KB |

This is the one thing on the screen nobody is promised. Everything else the
house does is a rule you can learn, which is what makes it legible and also
what makes it predictable. Keep these gentle and never startling: no sudden
entrances, nothing that reads as an alert, nothing the user has to dismiss.

Preview with `/dev/portrait?closed=1&visitor=deer`, or `?visitor=none` to
suppress it.
