# Scan a label: plan

Point the iPhone at an appliance's sticker. Cuidala reads it on the device,
works out how old the appliance is and what it needs, and wires the answer into
everything that already exists: the repair forecast, the chores, Restock and the
house. No account, no server, no photo is ever stored or sent.

## The five-second moment

> Rheem water heater · made March 2014
> It's 12 years old. Most last about 12. Put aside $95 a month for the next one.
> [Add it]

One scan finds money and risk the person did not know about. That is the wow.

## Why this, and why us

- Centriq-style label scanning exists, but it is cloud based and account bound.
  "Your house's details never leave your phone" is a story a server-dependent
  competitor cannot easily tell (PRODUCT.md, positioning).
- Manufacture dates are encoded in serial numbers. Decoding them for the common
  brands feels like magic, and it makes the repair forecast real instead of a
  guess.
- It multiplies features we already built instead of sitting beside them:

| Existing piece | What the scan gives it |
|---|---|
| Repair forecast (`src/lib/forecast`) | A real install date and life, so Budget is accurate |
| Chores (`src/lib/catalog.ts`, playbooks) | The right chores for that appliance appear |
| Restock (`src/lib/restock.ts`) | Exact filter size and part number |
| The house scene | The appliance shows in the room and in the status line |

## Parts

1. **Native scanner**, plugin `plugins/cuidala-scan` (Swift, VisionKit
   `DataScannerViewController`, text recognition). Returns recognised strings
   only, never an image. Needs `NSCameraUsageDescription`. Reports
   `supported: false` on devices without a scanner, so the app falls back.
2. **Decoder**, pure TypeScript in `src/lib/scan/`, fully unit tested:
   - `parse`: pull brand, model, serial, type hints and filter sizes from raw
     recognised text.
   - `serial-dates`: per-brand serial to manufacture date, each returning a
     confidence. Wrong is worse than unknown, so only exact, documented formats
     return a date. Everything else returns "unknown".
   - `appraise`: given type and date, compute age, expected life from
     `ASSET_CATALOG`, years left, replacement cost range, and the monthly
     set-aside, using the same math the forecast uses.
3. **Scan sheet**, `src/components/scan-label-sheet.tsx`: live scan, then a
   confirm card. It never saves silently. Edit stays one tap away. Under it, a
   plain "Type what the label says" path that also works in the simulator and on
   phones without a scanner.
4. **Wiring**: saving creates the `HomeAsset` (install date, expected life,
   replacement estimate), the catalog chores for that type, and the filter in
   Restock; the forecast and the house pick it up with no extra code.
5. **Entry points**: "Scan a label" in Add appliance (Settings, floors and
   rooms), in each room sheet, and a one-time prompt after setup: "Got two
   minutes? Scan your water heater and furnace."

## Honest limits

- First version decodes about ten brand families (water heaters, furnaces and AC,
  big appliances). Anything else says "I couldn't read the date. When was it
  installed?" and still captures brand and model.
- Serial formats change across eras; every decoder lists the years it is valid
  for and refuses outside them.
- The simulator camera cannot scan. Real-device testing is required, and the
  typed path covers everything else.

## Later, same engine

"Ask your house": type "remind me to change the furnace filter every 3 months"
and get chores back, using the on-device model on phones that have one.

## Plain language

All copy follows AGENTS.md. Say "made", "years old", "lasts about", "put aside".
Never "asset", "lifecycle", "decode".
