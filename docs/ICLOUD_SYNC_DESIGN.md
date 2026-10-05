# Design: "Keep my other iPhone in step" (iCloud, opt-in)

Status: design only, nothing built. Written 2026-10-05 from a read-only review
of the code and Apple's CloudKit documentation. Items marked HUMAN need a person
with an Apple Developer account and two real iPhones.

## Verdict

**Build narrower, behind a flag, as 1.1 or later.** CloudKit private database,
iOS 17+, foreground sync, end-to-end encrypted fields, per-entity merge. It keeps
"no account, no Cuidala server, nothing collected by us". It does **not** keep
three existing claims:

- "One home, one phone for 1.0" (changed by design).
- "Data stays on the iPhone" (no longer literally true when switched on).
- "Face ID-bound at rest everywhere" (the cloud copy is protected by the iCloud
  account and iCloud Keychain, not Face ID).

If 1.0 must hold the strict "only on this iPhone" sentence, do not build it for
1.0. The honest rewrite is "stays on your iPhones and, if you choose, in your
own iCloud, scrambled so only your iPhones can read it".

## What exists today (verified)

- `Household` (version 8) is one JSON document in memory. `persist()` in
  `src/lib/storage/vault.ts` encrypts it with AES-256-GCM and writes one envelope.
- The AES key is random, 32 bytes, in the Keychain via `plugins/cuidala-device-key`,
  with biometric or passcode access control, `ThisDeviceOnly`, never synchronizable.
- Because the key is Face ID-bound, **only the unlocked web layer can read or
  write the household.** Sync can only run in the foreground while unlocked.
- The backup file is a separate portable format (PBKDF2 600k, AES-GCM).
- No entity has a modification stamp or tombstone. Deletions are hard removals.
  Only `MaintenanceFund.updatedAt` exists. `completions` and `purchases` grow
  without bound.

## Key sharing: use CloudKit encrypted fields

| Option | Verdict |
|---|---|
| (a) Our own sync key in a synchronizable Keychain item | Rejected: synchronizable items cannot carry the biometric ACL, so same trust as (c) with more code to maintain |
| (b) Share the existing vault key | Rejected: would destroy `ThisDeviceOnly` and the biometric ACL |
| (c) `CKRecord.encryptedValues` | **Recommended.** Encrypted client-side with keys held in the user's iCloud Keychain; no key code of ours |
| (d) Advanced Data Protection | Adds protection for plain metadata only; claim nothing beyond "encrypted fields" |

Apple can read: record types, random record names, zone name, sizes, times,
device count, that the app uses CloudKit. Apple cannot read (HUMAN: verify in
the CloudKit Dashboard and Apple's documentation): every field value. Use UUID
record names; never put titles in names or in unencrypted fields. The vault key
and Face ID gate stay exactly as they are; each device re-encrypts locally.

New residual risk, stated plainly: someone with the Apple Account and a trusted
device passcode could read the cloud copy.

## Data model and merge

One CKRecord per entity in a custom zone `CuidalaHome`. Record types: Duty,
Completion, Purchase, Asset, Room, Floor, Consumable, SupplyAutomation,
HouseNote, HaulItem, Visit; singletons HomeProfile, Fund, Prefs. Each has one
encrypted `payload` plus encrypted `updatedAt` and `deleted`.

Additive schema (Household version 8 to 9 in `migrate.ts`):
- `updatedAt?` on every synced entity (hybrid logical clock).
- `tombstones?: { type, id, deletedAt }[]`, pruned after 90 days.
- `sync?: { enabled, zoneId, deviceId, lastSyncAt, stateSerialization }`.
- Stamp centrally in `updateHousehold` by diffing previous and next; do not touch
  call sites. Backfill missing stamps from `createdAt` / `completedAt` / `addedAt`.

Pure function `mergeHousehold(local, remote) -> Household` in
`src/lib/sync/merge.ts`:
- Entities: union by id; higher `updatedAt` wins, ties by deviceId; a tombstone
  beats an entity only if its `deletedAt` is later than the entity's `updatedAt`.
- Append-only (`completions`, `purchases`, `visits`, `milestones`, `checkIns`,
  `seenTips`, `weatherFires`): set union. Two completions from two phones are both
  kept; "done" derives from the latest.
- Supply counters: last writer wins per entity (known limit, accepted); recompute
  derived fields (`nextOrderDate`, `state`) after merge instead of trusting remote.
- `momentum.bestRun`: max. `care`: recomputed, not synced. `teaching`: OR of
  booleans, earliest start.
- Orphans (missing parent room): reattach to the whole-home room, never delete.
- **Never synced (per device):** `lockSettings`, `restockDigest`, `morningBrief`,
  `eveningNudge`, `mode`, `activeVisitId`, `weatherStatus`, widget state, vault
  and key metadata, `sync` itself. `onboarded` merges as OR.

First enable on a device that already has data: show both counts, then
**Combine both (recommended)**, **Use my other iPhone's home (replace this one)**,
or **Don't turn on**. Replace takes the existing pre-restore snapshot and offers
undo. Never silently merge two different homes.

## CloudKit mechanics

- Container `iCloud.com.cuidala.app`, private database. Entitlements in
  `App.entitlements`: container identifiers, `icloud-services` = CloudKit,
  `aps-environment`. HUMAN: create the container, add the capability to the App
  ID, and **deploy the schema to Production before TestFlight**.
- `CKSyncEngine` needs iOS 17. Show the setting only on iOS 17+ with a footnote
  "needs iOS 17"; do not change the deployment target.
- New Swift plugin `plugins/cuidala-sync` is a thin transport only (engine, state
  serialization, account events, push registration). JS owns the household and
  the merge. API: `status()`, `enable()`, `pushChanges()`, `pullChanges()`,
  `eraseZone()`, event `remoteChange`.
- Loop (`src/lib/sync/engine.ts`) runs only while unlocked: on unlock or
  foreground pull, merge, apply (flagged so it does not re-stamp), then push; on
  local change debounce 3 to 5 seconds then push; on lock flush first. Silent
  pushes only set a "changes pending" flag. **No background merge**; copy says
  "changes show up the next time you open Cuidala".
- Accounts: not signed in, iCloud off for the app, or quota full show a plain
  message and keep working locally. **Apple ID switch:** stop, keep local data,
  clear state, ask before uploading to the new account. Zone deleted elsewhere:
  offer "Turn sync off and keep this home" or "Re-upload".
- Conflicts (`serverRecordChanged`) resolve through `mergeHousehold`.

## Product, privacy, docs

- Settings, "Your data" group, "Keep my other iPhone in step", off by default;
  hidden on iOS < 17 and in cleaner mode.
- Consent copy (plain language): "Turn this on to see the same home on your other
  iPhone. Your home is copied to your own iCloud, scrambled so only your iPhones
  can read it. Cuidala never receives it and has no server. Apple stores it but
  can't read what's in it. Anyone who can sign in to your Apple Account and knows
  an iPhone passcode could read it there, so keep your Apple Account safe. Changes
  show up the next time you open Cuidala, not in the background. You can turn this
  off any time, and you can delete the iCloud copy." Buttons: Turn on, Not now.
  Needs Spanish and Portuguese (HUMAN review).
- App Store Connect privacy: expected to stay **Data Not Collected** (data in the
  user's own iCloud, unreadable by us). HUMAN: confirm against Apple's current
  wording. `PrivacyInfo.xcprivacy` unchanged.
- Update `PRODUCT.md` ("one home per iPhone by default; optionally the same
  person's other iPhones through their own iCloud"; "stays on your iPhones and,
  optionally, in your own iCloud, encrypted"), `docs/RESIDUAL_RISKS.md` (new
  rows: iCloud account compromise; cloud copy not Face ID-bound; merge can
  duplicate or resurrect; no background sync; erase propagation),
  `docs/CONTROL_MATRIX.md`, `docs/INCIDENT_RESPONSE.md`.
- **Backup restore with sync on:** treat as a local edit of everything; confirm
  "This will also replace your home on your other iPhone."
- **Erase everything with sync on:** a second confirm, "Also delete the copy in
  your iCloud?" Order: stop engine, erase zone, then local clean-up. The other
  phone sees a deleted zone and prompts; it never auto-wipes.
- **Kill switch:** in-app Turn off (keep local data, optionally delete the zone),
  a "Delete my iCloud copy" button that works with sync off, and a build-time
  `SYNC_ENABLED` constant. There is no remote kill (no server): say so.

## Phases and estimate

| Phase | Scope | Time |
|---|---|---|
| P0 spike | plugin skeleton, entitlements, one record round trip on two devices, confirm encrypted fields and silent-push behaviour | 3 to 4 days |
| P1 schema and merge | types, `migrate.ts` v9, central stamping, `merge.ts` + tests; no UI | 1 week |
| P2 engine and plugin | `engine.ts`, fake cloud transport, plugin API, vault lifecycle hooks | 1 to 1.5 weeks |
| P3 UI and copy | Settings, consent, combine-or-replace, status line, errors, three locales | 1 week |
| P4 docs and hardening | docs, schema deploy, TestFlight | 3 to 4 days |

About 4 to 6 weeks of focused work plus 1 to 2 weeks of device testing. The merge
and the device matrix are the long poles, not the CloudKit calls.

## Tests

- Unit tests for every merge rule; property tests for convergence (random
  operations on two replicas, any delivery order, duplicates: commutative,
  associative, idempotent, and "no completion is ever lost").
- A fake cloud transport with change tokens and injectable `serverRecordChanged`,
  `quotaExceeded`, `zoneNotFound`, account switch, offline queue.
- HUMAN device matrix: two iPhones on one Apple Account (iOS 17, 18, 26); airplane
  mode while editing both; simultaneous edits; delete on A while editing on B;
  erase with and without the cloud copy; sign out; switch Apple ID; storage full;
  ADP on and off; iCloud Keychain off; app locked during a push; kill mid-sync;
  second device with existing data (combine and replace); restore with sync on;
  cleaner mode; a TestFlight build against the Production schema.

## Risks, ranked

1. Silent data loss or duplication from a merge bug.
2. Erase and restore surprising the person on the other device.
3. Privacy-claim drift: copy saying "only on your iPhone" while a cloud copy exists.
4. Production-schema or entitlement mistakes that show only on TestFlight.
5. Encrypted-field key availability if iCloud Keychain is off or the account is
   recovered (unverified).
6. Foreground-only sync feeling broken.
7. Supply counter conflicts (accepted).
8. iOS 16 users excluded.
