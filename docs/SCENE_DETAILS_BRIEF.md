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

Note for the art pass: several kits' `door` anchors in the manifest sit a
little off the painted door, which the lantern and string lights already
inherit. The wreath will look misplaced on those until the anchors are
corrected.

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
