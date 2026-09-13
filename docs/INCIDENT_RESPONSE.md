# Incident response and release checks

## What an incident can be

With no servers or accounts, the realistic incidents are: a dependency vulnerability in the shipped bundle, a bug that corrupts or exposes on-device data, or a retailer-link abuse vector. There is no user database to breach and no credentials to rotate.

## Response

1. Confirm scope: which app versions include the affected code (`git log`, App Store Connect build list).
2. Fix on `main`; CI must be green (typecheck, lint, tests, build, audit, secret scan, OSV, Semgrep).
3. Ship a new build via TestFlight → App Store with an expedited review request if user data is at risk.
4. Record the incident, affected versions, and fix in this file's changelog below.

## Pre-release device checks (manual, every TestFlight build)

- [ ] Fresh install: Onboarding → Set up my home → rooms → ZIP (optional) → Walk your house → Today in under a few minutes (home type + tenure on one screen; no climate payoff step).
- [ ] Fresh install: Use a sample home → every tab (Today / Home / Restock); Today list visible without scrolling; notifications prompt once; forecast within 10 s on Wi-Fi.
- [ ] Geolocation: Allow location during onboarding. The system sheet must show **Cuidala**, not localhost.
- [ ] App lock: Unlock UI visible first; ACL Keychain prompt (not a separate boolean gate) after a short delay or on Unlock tap; cancel → still locked, vault not quarantined. Passcode helper text present.
- [ ] Lock clears in-memory key: after background lock, household UI is blank until unlock; second unlock prompts again.
- [ ] Upgrade migrate once: unbound v1 Keychain item is rewritten as ACL-bound v2 and legacy deleted.
- [ ] VoiceOver / Accessibility Inspector (honest): confirm WebView names where possible; do **not** claim Assistive Access Nutrition Labels until proven.
- [ ] Lock timer is timestamp-based: background for the lock-after interval with the screen off (JS timers suspend in WKWebView). Return → locked.
- [ ] Immediate lock (1.3), Face ID / Touch ID / passcode hardware:
  - [ ] Unlock stays unlocked: after a successful unlock, a Face ID / notification / location sheet does not re-lock.
  - [ ] Settings → Require Face ID → Off: the owner prompt does not re-lock when it resigns active.
  - [ ] Restock notification or location permission alert: returning from the system sheet stays unlocked.
  - [ ] Swipe Home with lock-after Immediate: returning to the app shows FaceLock.
  - [ ] Lock after 2 min: background under 2 min stays unlocked; at/after 2 min with the screen off returns locked.
  - [ ] Cleaner visit: lock timer never fires; Hand phone back still requires owner verification.
- [ ] App switcher shows a blur privacy screen, not the household.
- [ ] Settings → Require Face ID / Touch ID / passcode → Off → Face ID / passcode sheet first; cancel leaves lock on.
- [ ] Settings → Back up my home → share sheet / Files. Restore from that file → confirm “replace N chores, M items” with the passphrase in the dialog → home returns.
- [ ] Create backup → AirDrop → delete the app → reinstall → LoadFailed is **not** shown → Restore → survives force-quit.
- [ ] Simulate key-mismatch (or a phone without the Keychain item) → Restore from file → home persists after force-quit (1.1).
- [ ] LoadFailed (unsigned build or missing key) → Erase and start over uses the same confirm dialog as Settings.
- [ ] Hand phone to cleaner → lock timer does not fire during the visit → Hand phone back → owner verification required (label matches the device method).
- [ ] Touch ID device (SE): Settings toggle reads "Require Touch ID"; lock screen and cleaner handback say Touch ID.
- [ ] Passcode-only device (biometrics unenrolled): Settings toggle reads "Require passcode to open"; unlock is the system passcode sheet.
- [ ] Add a consumable → Allow notifications → confirm a pending reminder exists. Weekly digest is repeating (`repeats: true`), not a single fire.
- [ ] Restock: Order only when due; Coming up shows Order early; Stocked has no Order. Walk house is a full-screen cover with Cancel. Confirm is Yes, ordered / Cancel. SFSafariViewController opens (not the app WebView).
- [ ] Settings → Erase everything → Face ID when available → onboarding on relaunch; no residual data.
- [ ] Airplane mode: app opens, Today works, weather shows a graceful error.
- [ ] Tab bar shows Today / Home / Restock and stays visible on Settings / Budget / Seasonal; source-aware Back from Settings opened on Today returns to Today; tabs keep their scroll.
- [ ] Home room tile opens a room-detail sheet (no nested map); forecast card opens Budget.
- [ ] Settings gear, sheet close, calendar days, restock chips, and primary CTAs are at least 44pt.
- [ ] Today shows a dismissible ZIP banner when ZIP is missing (not four competing prompts); Seasonal ZIP card uses the same ZipSheet.
- [ ] Today shows This season when a playbook is open; Apple Weather attribution once on Today when forecast is loaded.
- [ ] Onboarding walk pre-selects recommended items; no sizes asked; Costco chip present.
- [ ] Settings → How Cuidala works / Privacy / Terms open in-app sheets; climate is a select; digest hour More… opens a time sheet; names persist on blur; Hide item names on the lock screen switch works; digest Switch requests notification permission before enabling.
- [ ] Palette: cream surfaces with darker brand `#9A5A35` for readable primary text/CTAs.
- [ ] Sheets: darker dim, X close on the title line, interactive drag-to-dismiss (velocity or >50% height); Reduce Motion is tap-to-close only; keyboard still lifts form sheets.
- [ ] Push screens (Settings / Budget / Seasonal): slide-from-right travel; left-edge swipe back follows the finger and pops past 35% / velocity (120 Hz preferred).
- [ ] System Dark Mode on every screen (Today / Home / Restock / Settings / sheets); selected cream pills readable (`--brand-cream-foreground`).
- [ ] Largest Dynamic Type on Today / Home / Restock (layout holds; captions may clip — see RESIDUAL_RISKS).
- [ ] Spanish (or Mexican Spanish) system language end to end: three tabs, sheets, lock screen, error pages show no English chrome.
- [ ] Airplane mode: app opens, Today works, weather shows a graceful error.
- [ ] Fresh sample home: zero overdue on day one; Restock shows the gauge; Seasonal reachable from Today.
- [ ] `cuidala.app` /privacy and /terms load; `support@` and `privacy@` deliver.
- [ ] Before App Store submission (human): Privacy + Support URLs live; archive a Release build; ASC checklist (Data Not Collected, exempt encryption, Free US, 3-tab 6.9"/6.7" screenshots, Reviewer Notes, age questionnaire → 4+). See `docs/APP_STORE_SUBMISSION.md`.
- [ ] Release build: `CAPACITOR_DEBUG` empty; Safari Develop does not list the app; Capacitor `loggingBehavior` is `none`.
- [ ] Confirm built Info.plist includes Face ID and location usage strings; PrivacyInfo.xcprivacy is Data Not Collected (no coarse-location collected type) + File Timestamp C617.1; portrait-only; WeatherKit entitlement present; `es.lproj` and `pt-BR.lproj` in the bundle.
- [ ] Confirm the binary is iPhone-only (no iPad destination). Always run a signed build — unsigned Keychain writes fail and show the load-failure screen.
- [ ] PBKDF2 timing: create a backup with a 4-word passphrase; the device stays responsive (spinner, not a freeze).
- [ ] Cold start: kill the app, reopen, vault loads without minting a new key.
- [ ] Passcode-less device (or Features → passcode off): passcode-required explanation with Open Settings, not a bare save-failed toast.

## Week-one watch

After the first TestFlight, watch for: lock-timer misses, WeatherKit entitlement / capability mistakes, Keychain unsigned-build confusion, restore confirm skipped, digest not repeating, and geolocation showing localhost.

## Guideline 4.2 appeal (draft)

Cuidala is a local-first iPhone app, not a website wrapper. The shipped binary includes Face ID / Touch ID / passcode lock via LocalAuthentication, a Keychain-held AES-256-GCM vault, repeating local notifications, SFSafariViewController for retailer pages, Files-based encrypted backup and restore, native Apple WeatherKit forecasts, and optional coarse location for climate setup. There is no account, no Cuidala server, and no remote code. First launch can use a sample home and reach Today and Restock immediately.

## Changelog

- 2026-09-13 — Pre-submission Phases 0–5 (agent): Node 22 pin; PrivacyInfo File Timestamp; honest ZIP/location → Apple copy; es/pt-BR Xcode localizations; vault lock-flush + keyId quarantine (no Keychain destroy) + restore snapshot/undo; day-one duty creation floor; room-delete guard; restock order confirm path; i18n chrome + smoke tests; Capgo biometric removed (`canEvaluate`); retailer https upgrade; interactive sheets + edge-swipe; splash screen; visual system redesign (tokens, grouped lists, terracotta App Icon). Control matrix / residual risks refreshed. Device checklist + ASC upload remain human.
- 2026-09-12 — Pre-submission hardening: vault restore persist, backup bounds, pause/resume lock, erase verify, migrate caps, unique notification IDs, 12-char seal floor, private notification titles, UX keep-alive tabs.
- 2026-09 — Lighter cream palette, Switch controls, sheet grabber / fade push, Restock walk in header.
- 2026-08-24 — Product/security pass: WeatherKit, S1 key-read ordering, repeating digest, portrait-only, timestamp lock, privacy screen, Keychain migration copy.
- 2026-08-24 — Simulator pre-TestFlight run: unsigned builds break Keychain (load-failure screen); iPad deferred (phone-column layout / 4.2 risk); floor raised to iOS 16.4 for `dvh`. iPhone-only; v1 free.
- 2026-08 — Review follow-up: lint gate, encrypted export/import, Face ID residual-risk wording, restock walk-through.
