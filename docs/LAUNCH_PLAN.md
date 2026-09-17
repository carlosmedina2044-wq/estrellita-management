# Cuidala 1.0 launch plan

Implementation plan for the pre-submission review dated 2026-09-13 (branch `pre-submission-hardening`, base commit `e59ccb4`). Written to be executed task by task by an AI coding agent (Cursor) or a developer. Every task is self-contained: context, files, the change, and how to verify. Work through the phases in order; inside a phase, tasks marked **[parallel]** can run at the same time.

Ground rules for whoever executes this:

- Read `AGENTS.md`, `README.md`, `docs/CONTROL_MATRIX.md` and `docs/RESIDUAL_RISKS.md` first. When a task changes a control, update those two docs in the same commit.
- Keep the gate green after every task: `npm run typecheck && npm run lint -- --max-warnings 0 && npm test && npm run build`.
- Use Node 22 (`nvm use 22`) for anything that touches `npx cap`.
- Never add a network call, a server, remote code, analytics, or a third-party SDK. Everything stays on device.
- Every user-facing string goes through `t()` (React) or `tActive()` (non-React) and gets a key in all three catalogs (`src/i18n/messages/{en,es,pt-BR}.json`). The i18n test asserts key parity.
- Do not change the visual system in Phases 1 to 3. Phase 4 is the redesign and must land as its own set of commits after the functional fixes are green.
- One commit per task, message in the imperative, referencing the task id (for example `P1-03 Register es and pt-BR localizations`).

---

## Phase 0 · Environment (human, 30 minutes)

- **P0-01** Run `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` so simulator tooling works.
- **P0-02** Add `.nvmrc` containing `22` and `"engines": { "node": ">=22" }` to `package.json`. Verify: `npx cap sync ios` succeeds without the Node version error.
- **P0-03** Add `.claude/launch.json` to `.gitignore` only if you do not want the web-shell preview config committed (it is harmless either way).

---

## Phase 1 · Ship gate (blockers and highs)

### P1-01 Privacy manifest: declare File Timestamp access

- **Why:** `@capacitor/filesystem` is statically linked and its library reads file creation/modification dates. Apple's scan flags the symbol (ITMS-91053) unless the app manifest declares it.
- **Files:** `ios/App/App/PrivacyInfo.xcprivacy`
- **Change:** add a second entry to `NSPrivacyAccessedAPITypes`:
  ```xml
  <dict>
    <key>NSPrivacyAccessedAPIType</key>
    <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
    <key>NSPrivacyAccessedAPITypeReasons</key>
    <array><string>C617.1</string></array>
  </dict>
  ```
- **Verify:** `plutil -lint ios/App/App/PrivacyInfo.xcprivacy`; Xcode → Product → Archive → Generate Privacy Report shows both categories. Update the "Privacy manifest matches data flows" row in `docs/CONTROL_MATRIX.md`.

### P1-02 Privacy copy: ZIP and location are sent to Apple

- **Why:** `CuidalaWeatherKitPlugin.swift` geocodes the ZIP with `CLGeocoder` and reverse-geocodes coordinates. Purpose strings and privacy copy currently say ZIP "stays on this iPhone" (Guideline 5.1.1).
- **Files:** `ios/App/App/Info.plist`, `ios/App/App/Info-usage.plist.fragment`, `ios/App/App/es.lproj/InfoPlist.strings`, `ios/App/App/pt-BR.lproj/InfoPlist.strings`, `src/i18n/messages/*.json` keys `legal.privacy.weatherBody`, `legal.privacy.labelBody`, `zip.addBody`, `docs/CONTROL_MATRIX.md`, `README.md` (App Privacy note).
- **Change:** `NSLocationWhenInUseUsageDescription` (en): "Cuidala uses your location during setup to pick seasonal tasks and fetch a local forecast. Your ZIP or location is sent to Apple to look up coordinates and weather. Cuidala has no server." Translate the same sentence for es and pt-BR. In the three catalogs, reword the privacy passages so they say the ZIP or coordinates are sent to Apple (WeatherKit and geocoding) and that Cuidala itself never receives them. Keep "Data Not Collected" as the App Store label.
- **Verify:** `grep -rn "stays on this iPhone\|stay on this iPhone" src ios` returns only the household/chores claims, none about ZIP or location. `npm test` (i18n parity).

### P1-03 Register Spanish and Portuguese localizations in the Xcode project

- **Why:** `es.lproj` and `pt-BR.lproj` exist on disk but are not in `project.pbxproj` (known regions are `en`, `Base`), so the built app ships only `Base.lproj`: English permission alerts for es/pt-BR users and an English-only Languages row on the store.
- **Files:** `ios/App/App.xcodeproj/project.pbxproj`, `ios/App/App/Info.plist`
- **Change:** in Xcode, Project → Info → Localizations → add Spanish and Portuguese (Brazil); add `InfoPlist.strings` as a localized resource (variant group) so both `.lproj/InfoPlist.strings` files are in Copy Bundle Resources. Add to `Info.plist`:
  ```xml
  <key>CFBundleLocalizations</key>
  <array><string>en</string><string>es</string><string>pt-BR</string></array>
  ```
- **Verify:** build for simulator, then `ls <DerivedData>/.../App.app/*.lproj` shows `Base`, `es`, `pt-BR`. On a simulator set to Spanish, the location permission alert is in Spanish.

### P1-04 Fix the lint errors so CI is green

- **Files:** `src/components/app-shell.tsx:162` (setState in effect), `:226` (missing `t` dep), `:450` (`Date.now()` in render), `src/i18n/locale-provider.tsx:43` (unused `ready`).
- **Change:**
  - Line 162: the `detectLockMethod()` effect calls `setLocked(false)` synchronously inside the effect body. Move that call into the `.then` callback (it is already async) or derive `locked` from `lockMethod === "none" && !pendingUnlock` with `useMemo`.
  - Line 226: read `t` through a ref (`const tRef = useRef(t); tRef.current = t;`) inside the persist-failed effect so the toast follows language changes, and remove the eslint suppression on the weather effect the same way.
  - Line 450: compute `showLockKeepPrivate` with a `useMemo` keyed on `household.teaching?.startedAt` and a `now` state that is refreshed by the visibility/resume handler added in P1-11.
  - `locale-provider.tsx`: delete the `ready` state or expose it on the context if a consumer needs it.
- **Verify:** `npm run lint -- --max-warnings 0` exits 0.

### P1-05 Vault: flush queued writes before locking

- **Why:** `lockHouseholdSession()` nulls `key` and `memory` without awaiting the persist chain. A queued write then runs with no key and either prompts Face ID over the lock screen or fails while the phone is locked, losing the edit.
- **Files:** `src/lib/storage/vault.ts` (`lockHouseholdSession` around line 228, `write`/`persist` around 135-207), `src/components/app-shell.tsx` (lock call sites), `src/lib/storage/vault.test.ts`
- **Change:** make `lockHouseholdSession` async: `await flushHousehold()` (drain `persistChain`) before clearing state; and in `persist`, if `key === null` and the session is locked, reject with a typed `SessionLockedError` instead of resolving a device key. Capture `key` into the closure at `write()` time so a write queued while unlocked still uses the key it had. Update callers to `void lockHouseholdSession()`.
- **Verify:** add tests: (a) write, then lock immediately, then unlock: the write is persisted; (b) lock with an empty chain does not touch the key store; (c) `persist` while locked never calls `loadDeviceKey`.

### P1-06 Vault: quarantine must never destroy the only key

- **Why:** quarantine mints a new key under the same Keychain account, deleting the old item; a transient "unavailable" load plus a restore can leave the quarantined copy undecryptable. The quarantine slot is also single.
- **Files:** `src/lib/storage/vault.ts` (`quarantineUnreadableVault`, `needsRestoreKey`, `createDeviceKey` call sites), `src/lib/native/device-key.ts`, `plugins/cuidala-device-key/ios/Sources/CuidalaDeviceKeyPlugin/CuidalaDeviceKeyPlugin.swift`, `src/lib/crypto.ts` (envelope), `vault.test.ts`
- **Change:**
  1. Add `keyId` to the vault envelope (`v: 3`), a short random id generated when a key is minted. Store keys under account `cuidala-device-key-<keyId>`; keep reading `cuidala-device-key-v2` for existing installs and treat it as `keyId: "v2"`.
  2. `quarantineUnreadableVault` writes to `QUARANTINED_VAULT_KEY.<timestamp>` and never deletes any Keychain item.
  3. `needsRestoreKey()` returns true only for `key-mismatch` and `not_found`, never for `unavailable`/`interaction_not_allowed`.
  4. Native `set` takes an `account` param; `remove` for erase-all deletes every `cuidala-device-key-*` account.
- **Verify:** tests: restore from the LoadFailed screen after a transient unavailable keeps the original key and the original vault decrypts on next launch; two quarantines produce two slots; erase removes all key accounts. Update `docs/CONTROL_MATRIX.md` rows for S1 and quarantine.

### P1-07 Room delete: respect the reassignment guard

- **Files:** `src/components/home-editor.tsx:110-119`
- **Change:** `return;` after `toast.error(t("home.reassignJobs"))`. Move the delete-confirmation card so it renders directly under the room row that is being deleted (or use an `AlertDialog`), not at the bottom of the page.
- **Verify:** unit test in `src/lib/home-model.test.ts` is not enough (the bug is in the component); add a component-level test if a DOM test runner exists, otherwise a manual check: delete a room that has chores with no reassignment target → toast, room and chores still present.

### P1-08 Today "Order first" flow must be completable

- **Why:** Today unmounts the hidden `RestockOrderButton` when the picker reports closed; the picker closes before it reports "opened", so the confirm step never renders.
- **Files:** `src/components/today-view.tsx:574-585`, `src/components/restock-order-flow.tsx`, `src/components/retailer-picker-sheet.tsx:60-68`
- **Change:** keep `orderItemId` until the flow reaches `finishOrdered` or an explicit cancel: change the button's callbacks to `onFlowFinished()`/`onFlowCancelled()` and only clear `orderItemId` from those. In the picker, call `onOpened?.(retailer)` before `onOpenChange(false)`.
- **Verify:** manual on device: Today → "Order first" chip → pick Amazon → return from Safari → "Did you finish ordering?" appears → Yes → item shows "on the way" in Restock. Also "I already ordered it" marks it ordered.

### P1-09 Day-one overdue seeding

- **Why:** starters are seeded with `monthDay: 1`/`weekday: 6` and `nextDueDate` anchors to the calendar period with no creation floor, so a fresh home shows a dozen "Overdue" chores.
- **Files:** `src/lib/duties.ts:49-55` (`nextDueDate`, `isOverdue`), `src/lib/onboarding/generate.ts:385`, `src/lib/duties.test.ts`
- **Change:** in `nextDueDate`, when a duty has no completion history, the first due date is the first occurrence on or after `max(createdAt, today)`. Ensure `createdAt` is set on every generated duty (it is `startedAt` for onboarding). Keep existing behaviour for duties with history.
- **Verify:** test: a monthly `monthDay: 1` duty created on Sep 13 is due Oct 1, not overdue; a weekly `weekday: 6` duty created on a Sunday is due the coming Saturday. Fresh sample home on any date shows 0 overdue.

### P1-10 Dark mode: selected pills and chips

- **Files:** `src/components/today-view.tsx:345,359,389`, `src/app/globals.css` (add `--brand-cream-foreground`)
- **Change:** add tokens `--brand-cream-foreground: #1d1d1f` (light) and `#231812` (dark, on `.dark`). Replace `bg-brand-cream text-foreground` with `bg-brand-cream text-[color:var(--brand-cream-foreground)]` (or a `text-brand-cream-foreground` utility via `@theme`), and `bg-brand-cream text-primary` with the same foreground token.
- **Verify:** simulator in dark mode: "Today" label readable on the selected pill; contrast ≥ 4.5:1 (compute with the brand cream `#f4e6c8` and `#231812` = 12.6:1).

### P1-11 Today's clock must not freeze

- **Files:** `src/components/today-view.tsx:97`, `src/components/app-shell.tsx`
- **Change:** replace `useMemo(() => new Date(), [])` with a `useNow()` hook that stores the current date string, updates on `visibilitychange` (visible), on the Capacitor `resume` event, and on a 60 s interval keyed to the date string so it only re-renders when the day changes.
- **Verify:** test the hook's date-change detection; manual: change the simulator date while the app is backgrounded → header updates on resume.

### P1-12 Each tab owns its scroll

- **Files:** `src/app/globals.css` (`.app-frame`, `.app-shell-main`, `.app-keep-alive`), `src/components/app-shell.tsx` (`selectRootTab`)
- **Change:** `.app-frame { height: 100dvh; }` so `.app-keep-alive` panes become the scrollers; remove `overscroll-behavior-y: contain` from `body` and keep it on the panes; tapping the active tab again scrolls its pane to top (`pane.scrollTo({ top: 0, behavior: scrollBehavior() })`).
- **Verify:** scroll Today halfway, tap Home: Home is at its own last position (top on first visit); return to Today: position retained. Pull at the top bounces.

### P1-13 Destructive actions: confirm, undo, haptic

- **Files:** `src/components/duty-form.tsx:542-552`, `src/components/consumable-form.tsx:362-372`, `src/hooks/use-household.ts:357-371`, `src/lib/native/haptics.ts`, `src/components/home-view.tsx` (erase)
- **Change:** on Delete: close the sheet, remove the item from the list, fire `hapticDestructive()`, and show a 6 s toast "Deleted <name>" with an Undo action that restores the item and its completions (keep the removed duty in a ref until the toast expires). Erase-all keeps the AlertDialog and adds `hapticDestructive()`.
- **Verify:** delete a chore → Undo → chore and its history return. Add `deleteDuty` / `restoreDuty` round-trip test in `use-household` or the model layer.

### P1-14 Route the remaining hard-coded English through i18n

- **Files:** `src/components/restock-view.tsx:307,351`, `src/components/ui/sheet.tsx:120`, `src/components/home-map-view.tsx:63,85-97`, `src/components/home-view.tsx:365`, `src/components/day-calendar.tsx:9`, `src/components/consumable-form.tsx:324,337,349,371`, `src/components/duty-form.tsx:372`, `src/components/retailer-picker-sheet.tsx:74,87,102,191,210`, `src/components/house-map-sheet.tsx:138,253,261,275`, `src/components/restock-walk-picker.tsx:191,202`, `src/components/saved-retailer-field.tsx:80`, `src/components/budget-view.tsx:132`, `src/components/apple-weather-attribution.tsx:26-35`, `src/app/error.tsx:28`, `src/app/not-found.tsx:16`, `src/hooks/use-household.ts:327,457,481,584`
- **Change:** replace each literal with `t("…")`/`tActive("…")`, adding keys to all three catalogs. Weekday abbreviations come from `Intl.DateTimeFormat(locale, { weekday: "short" })`, not literals. Add an ESLint rule to stop regressions: `react/jsx-no-literals` with `noStrings: true, ignoreProps: true` scoped to `src/components/**` and `src/app/**`, allowing punctuation-only strings.
- **Verify:** `npm run lint` passes with the new rule; simulator in Spanish: Restock, sheets, room tiles and error page show no English.

### P1-15 Keychain: passcode-less devices and delete-first writes

- **Files:** `plugins/cuidala-device-key/ios/Sources/CuidalaDeviceKeyPlugin/CuidalaDeviceKeyPlugin.swift:196-249`, `src/lib/native/biometrics.ts`, `src/lib/native/device-key.ts`, `src/components/app-shell.tsx` (LoadFailed/onboarding), `docs/RESIDUAL_RISKS.md`
- **Change:** before minting or migrating, check `LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error:)`; if false, reject with code `passcode_required`. Map `errSecNotAvailable` (-25291) to the same code. In `writeBound`, add under a temporary account first, then delete the old item and rename (or add-then-delete with distinct accounts per P1-06). In the UI, map `passcode_required` to a full-screen explanation: "Set a passcode in iOS Settings to protect your home" with an Open Settings button (`App.openUrl` to `app-settings:`). Document in RESIDUAL_RISKS that removing the passcode deletes the key.
- **Verify:** simulator with passcode disabled (Features → Toggle Enrolled State off is biometrics; for passcode use a device): the explanation screen appears instead of a "save failed" toast.

---

## Phase 2 · Should-fix before 1.0 (mediums)

- **P2-01 Restore snapshot.** `src/lib/storage/vault.ts:527-568`: before `persist(household)` in `importHouseholdBackup`, copy the current envelope to `cuidala-vault-snapshot.<timestamp>`; add Settings → "Undo last restore" for one session. Test: restore then undo returns the previous home.
- **P2-02 Localized Keychain fallback title.** `CuidalaDeviceKeyPlugin.swift:127,151`: accept `fallbackTitle` in `get`; `src/lib/native/device-key.ts` passes `deviceOwnerFallbackTitle()`.
- **P2-03 Apple Weather attribution strings.** `src/components/apple-weather-attribution.tsx`: localize alt text, fallback wordmark and "Other data sources"; raise the mark to `h-5`.
- **P2-04 Onboarding.** `src/components/onboarding.tsx`: add Back on the location step; only reset walk picks when the room set changed (compare room ids); after a denied location permission show "We'll use your ZIP instead" inline; add an optional first-name field on the finish screen (`ownerName`).
- **P2-05 Trusted retailer.** `src/components/restock-order-flow.tsx:44,160-163`: remove the auto-`finishOrdered` on return; keep a one-tap confirm with "I ordered" as the primary button.
- **P2-06 Form labels.** `src/components/duty-form.tsx:563-570`, `consumable-form.tsx:383-390`, `home-editor.tsx`, `home-view.tsx`: `Field` generates an id with `useId()` and sets `htmlFor`/`id`.
- **P2-07 44 pt targets.** Add `min-h-11 inline-flex items-center` to every link-style button listed in the report (onboarding, seasonal, order flow, budget hero/timeline, walk picker, cleaner visit); retailer picker rows to `h-11`.
- **P2-08 Home editor debounce.** `src/components/home-editor.tsx:135-161`: debounce `onChange` 300 ms (reuse the pattern from `home-view.tsx:146-151`) or commit on blur.
- **P2-09 Sheets.** `src/components/ui/sheet.tsx`: replace the text Close with an X icon button (`aria-label={t("common.close")}`) on the title line; make every sheet with an input `size="form"` (Receive, ZIP, Order-confirm, Fund, Change-date); stop opening a sheet from inside a sheet: DutyForm's order flow becomes an internal step, HouseMapSheet closes before opening DutyForm.
- **P2-10 Native shell.** Remove `UISceneStoryboardFile`/`UIMainStoryboardFile` from `Info.plist` (keep `LaunchScreen`) and delete `Main.storyboard`; `CuidalaBridgeViewController.preferredStatusBarStyle` returns `.default` (or switches on `traitCollection.userInterfaceStyle` with `setNeedsStatusBarAppearanceUpdate` in `traitCollectionDidChange`). Also set `window.backgroundColor` from the trait collection so dark-mode overscroll is not cream.
- **P2-11 Debug hygiene.** `capacitor.config.ts`: `loggingBehavior: "none"`; `src/lib/native/device-key.ts`: `raw.fill(0)` after `importRawKey`.
- **P2-12 Copy consistency.** One destructive verb (Erase) across `home-view.tsx:573`, `app-shell.tsx:745` and the success toast; Help mails `support@`; "jobs" → "chores" in Seasonal/Home copy; rename `consumable.*`/`supply.*` user-facing strings to "item".
- **P2-13 Weather trigger visibility.** Today shows a section header "Added for this week's weather" above trigger-created chores; read `t` through a ref in the shell effects.
- **P2-14 Drop the redundant biometric SDK.** Add `canEvaluate` to `CuidalaDeviceKeyPlugin` (returns `{ available, biometryType, deviceIsSecure }`), switch `src/lib/native/biometrics.ts` to it, remove `@capgo/capacitor-native-biometric` from `package.json` and `ios/App/CapApp-SPM/Package.swift` (via `npx cap sync`).
- **P2-15 Theming leftovers.** `global-error.tsx` gets an inline `prefers-color-scheme` block; `manifest.ts` colors to `#faf6ef`/`#1f1a16`; `.ui-bevel/.ui-inset/.ui-group` and the tab bar borders use `var(--border)`.
- **P2-16 Retailer https.** `src/lib/native/open-url.ts`: upgrade `http:` to `https:` before opening; `CuidalaWeatherKitPlugin.swift`: cap `postalCode` at 10 characters and attribution image responses at 512 KB.
- **P2-17 README reviewer notes.** Delete the Cuidala Pro sentence from the App Store Connect notes section.

---

## Phase 3 · Feel (interaction and motion)

Do these after Phases 1 and 2 are green; each is independent unless noted.

- **P3-01 Interactive bottom sheets.** `src/components/ui/sheet.tsx`: track `translateY` on `pointermove` (rubber-band above 0 with `y * 0.3`), dismiss when velocity > 0.6 px/ms or drag > 50% of sheet height, otherwise spring back (`transition: transform 320ms cubic-bezier(0.32,0.72,0,1)`). Keep the input and scrolled-content guards. Reduced Motion: keep the tap-to-close only.
- **P3-02 Enter/exit travel.** Sheet: `translateY(100%)` → `0`, 400 ms, same curve, overlay fades separately; remove `fade-in-0` from the content. Push (Settings, Budget, Seasonal): 350 ms slide from the right with the parent translating −30% and dimming 10%; reverse on pop. Reduced Motion: 150 ms crossfade (current behaviour).
- **P3-03 Edge-swipe back.** In `app-shell.tsx` pushed container: pointer down within 24 px of the left edge starts an interactive pop that follows the finger; release past 35% width or with velocity pops; otherwise springs back. Depends on P3-02.
- **P3-04 Completion moment.** `duty-row.tsx` + `today-view.tsx`: on complete, draw the check (SVG stroke-dashoffset, 200 ms), hold 300 ms with strikethrough, then animate the row height to 0 over 220 ms before removing it from the list; fire `hapticComplete()` at the check, not the toast. Undo reverses.
- **P3-05 Pressed states.** Add `active:bg-foreground/6` (rows) and `active:scale-[0.98] transition-transform duration-75` (cards, tiles, pills) to every tappable non-button element; buttons keep their nudge.
- **P3-06 Haptics.** Remove `hapticTab()` from `selectRootTab`; keep complete/undo/ordered/destructive.
- **P3-07 Launch.** Add `@capacitor/splash-screen` with `launchAutoHide: false`, `backgroundColor: "#faf6ef"` (and a dark variant via the launch storyboard's system background); call `SplashScreen.hide({ fadeOutDuration: 150 })` after the first household render; delete the `brand-enter` animation.
- **P3-08 Keyboard.** Covered by P2-09; additionally, `duty-form.tsx` focuses the title only when creating, not editing.
- **P3-09 Details.** `font-variant-numeric: tabular-nums` on counts, gauges and money; forecast card shimmer while loading; long-press context menu on chore rows (Complete, Snooze a week, Edit, Delete) using a small custom menu (no native `contextmenu` in WKWebView).

---

## Phase 4 · Visual system (the before/after boards)

Reference: the design canvas "Cuidala Before and After" (Today, Home, Restock pairs plus the system board). Land these as a sequence so each commit is reviewable.

- **P4-01 Tokens.** `src/app/globals.css`: add `--signal: #e0662b` (dark `#f08a4b`), `--signal-soft`, `--brand-cream-foreground`; define radius roles `--r-control: 8px`, `--r-input: 12px`, `--r-container: 20px`; one gutter `--gutter: 20px`; status tokens `--overdue`, `--soon`, `--done` with `-soft` tints. Map Tailwind utilities via `@theme`.
- **P4-02 Identity.** Recolor `public/brand/cuidala-mark.webp`, the wordmark marks and `ios/App/App/Assets.xcassets/AppIcon.appiconset/*` so the mark is terracotta `#9a5a35` on cream, with the orange reserved for the inner house stroke (one accent for action, one for signal). Export an Icon Composer `.icon` for iOS 26 variants if available.
- **P4-03 Grouped lists.** Replace card-per-row layouts with grouped lists: `home-map-view.tsx` room rows (56 pt, glyph, name, trailing status text in status color, chevron, hairline separators); `restock-view.tsx` item rows (title, meta, 160 px gauge, trailing capsule or date); `today-view.tsx` rows (status stroke on the circle, colored meta line, full-width title, no inline badge). Cards remain only for the forecast/budget summary.
- **P4-04 Today header.** Greeting with first name at 17/600; one display sentence at 34/700 (`"{n} things need you today."`, `"All clear. Next up {day}."`, pluralized and localized); date and weather on the secondary line; climate label moves to Settings; ZIP nudge becomes an inline row in the forecast slot.
- **P4-05 Tab bar.** Remove the selection pill; selected = filled icon + label in `--primary`, unselected = outline in muted; bar background `rgba(ground, 0.86)` with `backdrop-filter: blur(20px)`; badge in `--signal`.
- **P4-06 Sheets and buttons.** Sheet header on one line (grabber, title, X). Order sheet: "Last time: {store} · {when}" as the first highlighted row, store rows with chevrons, paste-a-link field, "I already ordered it" as a text button at the bottom. One filled button per screen: Seasonal cards get a compact tinted Add and Skip in an overflow; Restock Order is a trailing capsule; Settings rooms use swipe-to-delete or an edit mode.
- **P4-07 Room glyphs and the gauge.** Add `src/components/icons/room-glyphs.tsx` with the seven stroke glyphs from the system board (kitchen, living, bedroom, bath, laundry, outdoors, systems) at 24 px / 2 px stroke; use them in `room-type-icon.tsx`. Promote `supply-gauge.tsx` to a shared `Gauge` (solid = have, hatched = on the way, empty = need) and use it in the Home forecast card and Budget runway.
- **P4-08 Onboarding welcome.** Hero built from real components (a chore row, a restock row, the gauge) above the two buttons; hide the progress bar on step zero; replace the native checkbox with the tinted circle-check used in the walk picker.
- **P4-09 Numbers.** `.num` utility: `font-family: ui-rounded, system-ui; font-variant-numeric: tabular-nums;` applied to counts, money and dates in rows and pills.

---

## Phase 5 · Verification and submission

- **P5-01 Tests to add** (guards for the fixes): `vault.test.ts` (lock flush, persist-while-locked rejection, quarantine keeps key, multiple quarantine slots, restore snapshot/undo); `duties.test.ts` (creation floor for monthly/weekly); `restock` order-flow state machine test (pick → opened → confirm → ordered) extracted into `src/lib/restock-order-state.ts`; `home-model.test.ts` (deleteRoom with work and no target is a no-op at the model level, add a guard there too); `i18n.test.ts` (no English fallbacks hit for es/pt-BR in a smoke render of key strings).
- **P5-02 Device checklist.** Run every line of `docs/INCIDENT_RESPONSE.md` "Pre-release device checks" on a real iPhone with Face ID and on an SE-class device, plus: Spanish system language end to end, dark mode on every screen, largest Dynamic Type on Today/Home/Restock, airplane mode, and the new interactive sheet and edge-swipe gestures at 120 Hz.
- **P5-03 Archive.** Xcode 26: Product → Archive (Release) → Validate App (checks SDK signatures for Capacitor/Cordova xcframeworks) → Distribute → TestFlight. `CURRENT_PROJECT_VERSION` +1 per upload.
- **P5-04 App Store Connect.** Privacy: Data Not Collected. Age rating questionnaire (2026 form) → 4+. Localized metadata for en-US, es-MX, pt-BR: name, subtitle, description, keywords, what's new, 6.9" and 6.7" screenshots that show the redesigned Today (no overdue on day one), Restock gauge, and Seasonal. Support URL and Privacy Policy URL live; `support@` and `privacy@` answering. Reviewer notes from the README minus the Pro sentence, plus "tap Use a sample home instead".
- **P5-05 Docs.** Update `docs/CONTROL_MATRIX.md`, `docs/RESIDUAL_RISKS.md` and the changelog in `docs/INCIDENT_RESPONSE.md` with every control touched above.

### Definition of done

- `npm run typecheck && npm run lint -- --max-warnings 0 && npm test && npm run build` green; CI green on `main`.
- Simulator build has `es.lproj` and `pt-BR.lproj`; Privacy Report lists UserDefaults and File Timestamp.
- Fresh install shows zero overdue; dark mode has no unreadable control; Spanish system language shows no English in the three tabs, sheets, or error pages.
- Lock, restore, quarantine and delete paths have tests.
- The device checklist is signed off on two devices.
