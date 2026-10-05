# One lens for the whole house: camera and Apple Intelligence plan

Follow-up to `SCAN_A_LABEL_PLAN.md`. Scan a label proved the loop: the camera
reads something, the decoder turns it into facts, and those facts land in what
already exists. This plan generalises that loop so **one button reads anything
in the house** and every answer saves typing somewhere the app already has.

Verified against Apple's docs on 2026-10-04 (via Sosumi). This Mac has the
iOS 26.5 SDK only; anything marked iOS 27 needs Xcode 27 first.

## The idea: "Show Cuidala"

One camera entry, everywhere (Today, Home, Restock, Budget, room sheets, and
the Action button / Control Center via App Intents). You point it at
something; Cuidala works out *what kind of thing* it is and offers the one
action that fits:

| You point at | Cuidala says | Lands in (already built) |
|---|---|---|
| An appliance sticker | "Rheem water heater · made 2014 · 12 years old" | `HomeAsset`, forecast, Budget (shipped) |
| A receipt | "Home Depot · $64. Furnace filter $18 and dish soap $9 are on your list. Mark them bought?" | `Purchase`, Restock `markArrived`, `lastPaidPrice`, Budget history |
| A product box or barcode | "Dishwasher pods, 60 count. Track it?" (first time) / "Restocked." (after) | `SupplyAutomation` (`sku`, `sizeSpec`, `qtyPerOrder`) |
| A furnace filter frame | "16x25x1 MERV 8. Save as your filter size?" | `Consumable.sizeSpec`, Restock item |
| A warranty card or appliance receipt | "Warranty until June 2028" | `HomeAsset.warrantyUntil`, `src/lib/warranty.ts` |
| A breaker panel directory | "14 breakers saved. Search 'kitchen' any time." | New: house notes (see phase 4) |

Why this is the wow: other home apps make you *type your house in*. Cuidala
*reads it*, privately, and every read instantly changes the forecast, the
list, or the house picture.

## Three tiers, so nobody is left out

**Tier 1, every iPhone with a camera (iOS 16.4+, ships now).**
- Live text and barcodes with VisionKit `DataScannerViewController`, already
  wrapped in `plugins/cuidala-scan`. Add `.barcode()` recognition beside
  `.text()`.
- "Use a photo I already took", via PHPicker plus Vision text recognition on the
  image. It needs no camera, so it works in the simulator. People often already
  have photos of their water heater sticker.
- Routing is rule-based in TypeScript: MODEL/SERIAL means a label; TOTAL, tax
  and price lines mean a receipt; an `NxNxN` pattern means a filter; a lone UPC
  or EAN means a product. These rules are pure and unit tested, like
  `src/lib/scan/`.
- Barcodes and privacy: no product database and no server. The **first** scan
  of a box asks "What is this?" with the OCR'd box text prefilled. The barcode
  is stored in `SupplyAutomation.sku`. Every later scan of that box is
  instant. The phone learns your house, and nothing leaves it.

**Tier 2, Apple Intelligence phones on iOS 26 (Foundation Models, text;
ships now with the 26.5 SDK).** Gate on `SystemLanguageModel.default.availability`.
- **Cleaner reads.** Pass messy OCR text to a `LanguageModelSession` with
  `@Generable` output (`LabelReading`, `Receipt { store, date, lines:[{name, price}], total }`).
  The model fills gaps the regex misses, such as odd label layouts or
  abbreviated receipt lines ("DW PODS 60CT"). The deterministic decoder still
  owns dates and money. The model only proposes; the confirm card decides.
- **Receipt to list matching.** A tool-calling session gets a `SuppliesTool`
  that returns the household's tracked supply names, so the model maps
  "DW PODS 60CT" to "Dishwasher detergent" without the whole household being
  sent into a prompt.
- **"Tell Cuidala".** A one-line box: "change the furnace filter every 3
  months", "the plumber fixed the kitchen sink for $180". It turns into a
  chore, a purchase or a completion via `@Generable` actions, and you confirm
  before anything is saved.
- **App Intents and Siri.** "What's left today?", "Mark the dishes done",
  "Scan a label". These are reachable from Siri, Spotlight, the Action button
  and Shortcuts. They are cheap to add and they make the app feel native to
  Apple Intelligence.
- **Visual Intelligence (iOS 26).** Ship an `IntentValueQuery` over
  `SemanticContentDescriptor`. When someone uses the system visual intelligence
  camera on their water heater, the system labels ("water heater",
  "refrigerator") match their saved appliances, and Cuidala's card appears in
  the system results: "Rheem water heater · 12 years old · Open". This is the
  most "how did it do that" moment, and Apple features it. Native work: an
  `AppEntity` per appliance, kept in sync from the web layer through the
  existing widget snapshot pattern (`plugins/cuidala-widget`), because the vault
  is Face ID bound.

**Tier 3, iOS 27 on Apple Intelligence phones (needs Xcode 27: image
prompts).** Foundation Models now accepts images (`Attachment`, iOS 27+) with
Vision's `OCRTool` and `BarcodeReaderTool` as tools.
- **No sticker needed.** Photograph the appliance itself, and a `@Generable`
  enum classifies it into our `AssetType` with greedy sampling. That covers the
  case where the plate is behind the unit.
- **A quick check-up.** "Any signs of trouble?" on a photo of the water heater
  base or under the sink. The output is a fixed list, such as rust or water
  marks, never a diagnosis, followed by one plain line and a suggested chore
  ("Look for a slow leak at the base. Add a monthly check?"). This needs a
  careful wording review and stays opt-in.
- **Shelf restock.** Photograph the cleaning cupboard, and the model counts
  tracked items so Restock levels update in one go (`supply-checkin-sheet.tsx`
  already takes levels).
- Private Cloud Compute stays **off**, because it contradicts "nothing leaves
  the phone". Revisit only with an explicit opt-in.

## Already built, so it costs nothing

- `src/lib/scan/` (parse, serial dates, appraise) and `add-from-label.ts`: the
  pattern every new reader copies.
- `scan-label-sheet.tsx`: the confirm-card shell (intro, typed fallback, denied
  state, reveal, haptics). Generalise it into one reader sheet with
  per-kind cards.
- `SupplyAutomation.sku` and `sizeSpec`, `Consumable.sizeSpec`, and
  `HomeAsset.warrantyUntil`: the fields exist, so barcode memory, filter size
  and warranty need no data migration.
- `Purchase`, `applyReceivedPrice` and `applyCompletionCost` (`src/lib/costs.ts`):
  receipts write through these.
- `restock-order-state.ts` "arrived": receipts mark orders arrived.
- `restock-walk-picker.tsx`: becomes "walk and scan" (scan each box as you
  go).
- `use-house-answer.ts` and the delivery layer: the house reacts to a receipt
  (a box lands on the porch and is taken in) and to a label scan (that room's
  window warms).
- The widget snapshot pattern: how the web layer feeds native App Intents and
  Visual Intelligence without unlocking the vault.

## Phases

1. **One lens, Tier 1 (about 1 week).**
   - Add barcode recognition to the plugin.
   - Add a photo-picker plus Vision OCR path.
   - Build a `src/lib/scan/route.ts` classifier.
   - Turn the reader sheet into one sheet with label, receipt, product and
     filter cards.
   - Add a receipt parser (store, date, total, lines) plus deterministic
     matching to tracked supplies.
   - Add barcode memory through `sku`.
   - Done when: the typed and photo paths work in the simulator, unit tests
     cover routing, receipts and barcode memory, and the camera paths are
     tested on a real iPhone.
2. **Apple Intelligence, Tier 2, iOS 26 (about 1 week).**
   - Write a `cuidala-intelligence` plugin: availability, `structureLabel`,
     `structureReceipt` with a supplies tool, and `tellCuidala`. All return JSON
     that the TypeScript side validates.
   - Fall back silently to Tier 1 when the model is unavailable.
   - Add App Intents: today's list, mark done, open scanner.
   - Done when: messy receipts match at least as well as the rules alone on a
     fixture set, nothing saves without confirming, and it works with Apple
     Intelligence off.
3. **Visual Intelligence (about 3 days).**
   - An appliance `AppEntity` plus snapshot sync, an `IntentValueQuery`, and an
     `OpenIntent` that deep-links to the room sheet.
   - Done when: the system camera on a real device shows the Cuidala card for a
     saved appliance.
4. **House notes (about 3 days).**
   - Breaker panel, paint colours and shut-off valve locations, read once and
     kept as searchable notes per room.
   - This becomes the "if I'm away" handbook for a house-sitter, built on the
     existing cleaner hand-off.
5. **Tier 3, iOS 27 (after installing Xcode 27; about 1 week).**
   - No-sticker appliance ID, check-up, and shelf restock, all opt-in, with a
     plain-language review.

## Guardrails

- **The model proposes, deterministic code decides.** Dates, money and serial
  rules stay in tested TypeScript. The model only fills names and matches, and
  every result goes through a confirm card.
- **No images are stored or sent.** Text and structured results only, the same
  promise as the camera permission string.
- **Plain language** (AGENTS.md). "Bought", "made", "years old", "on your
  list". Never "OCR", "AI", "model" or "detected".
- **Wrong is worse than unknown.** Every reader has an honest "I couldn't read
  that" path that still saves what it did get.
- **Three locales** for every string. The on-device model supports en, es and
  pt; check `supportsLocale` and fall back to Tier 1 otherwise.

## Open decisions for the owner

1. Install Xcode 27 now (unlocks Tier 3 and the newest model), or ship Tiers
   1 and 2 on the 26.5 SDK first? Recommended: ship 1 and 2 first.
2. Is the check-up feature in scope for 1.0? It is the most impressive and
   the most sensitive. Recommended: after 1.0.
3. House notes: is the breaker-panel and handbook direction wanted?

## Asking for Apple Intelligence (added 2026-10-05)

An app cannot turn Apple Intelligence on, and there is no per-app permission
prompt for it. The person turns it on once in the iPhone's own Settings
(Apple Intelligence & Siri); after that every app can use the on-device model.
So our job is to *invite* at the right moment, *say what they get and what stays
private*, and *send them to the right place*. Cuidala must work fully without it.

States from `aiAvailable()` and what we do:

| State | What we show |
|---|---|
| `deviceNotEligible` or `unsupportedLocale` | Nothing, ever. No nag, no "upgrade" copy. |
| `notEnabled` | The invitation card (below). |
| `modelNotReady` | "Smart reading is still getting ready on your iPhone. It will switch on by itself." No action. |
| `available` | Quietly use it. A small "Read with Apple Intelligence" badge on the confirm card, nothing to enable. |

When to show the invitation (value first, never at launch):
1. After the first scan or receipt where the plain reader needed help
   ("I couldn't read the month"). The card sits under the result.
2. A "Smart reading" row in Settings with the live state and the same card.
3. Once more after 30 days if dismissed once; never after a second dismissal.
   Dismissals persist through `seenTips`.

The card: headline "Read messier stickers and receipts", three one-line
benefits with a real example each ("DW PODS 60CT becomes Dishwasher detergent",
"Say 'change the furnace filter every 3 months' and it's a chore"), a privacy
line with a lock glyph ("Runs on this iPhone. Your photos and house details are
never sent anywhere, not even to us."), and two actions: "Open Settings" and
"Not now". The steps are spelled out under it ("Settings, Apple Intelligence &
Siri, turn it on"), because Apple does not allow deep-linking to that pane;
"Open Settings" opens the app's own page via the existing `app-settings:` route.
When the app returns to the foreground we re-check availability and, if it is
now on, celebrate quietly ("Smart reading is on") and continue what they were
doing.
