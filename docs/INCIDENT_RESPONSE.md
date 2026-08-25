# Incident response and release checks

## What an incident can be

With no servers or accounts, the realistic incidents are: a dependency vulnerability in the shipped bundle, a bug that corrupts or exposes on-device data, or a retailer-link abuse vector. There is no user database to breach and no credentials to rotate.

## Response

1. Confirm scope: which app versions include the affected code (`git log`, App Store Connect build list).
2. Fix on `main`; CI must be green (typecheck, lint, tests, build, audit, secret scan, OSV, Semgrep).
3. Ship a new build via TestFlight → App Store with an expedited review request if user data is at risk.
4. Record the incident, affected versions, and fix in this file's changelog below.

## Pre-release device checks (manual, every TestFlight build)

- [ ] Fresh install: Onboarding → Set up my home → climate payoff shows the derived zone (if ZIP) → Walk your house → Today list in under 5 minutes.
- [ ] Fresh install: Use a sample home → Today list immediately; Restock has starter consumables. First-three card on Today.
- [ ] Geolocation: Allow location during onboarding. The system sheet must show **Cuidala**, not localhost.
- [ ] App lock: background the app for > lock-after, return, verify prompt; cancel prompt → still locked. Confirm this is a UI gate (household is not shown) — Keychain is not biometric-bound. Lock screen and Settings toggle name the method this phone actually has (Face ID, Touch ID, or passcode).
- [ ] Lock timer is timestamp-based: background for the lock-after interval with the screen off (JS timers suspend in WKWebView). Return → locked.
- [ ] App switcher shows a blur privacy screen, not the household.
- [ ] Settings → Require Face ID / Touch ID / passcode → Off → Face ID / passcode sheet first; cancel leaves lock on.
- [ ] Settings → Back up my home → share sheet / Files. Restore from that file → confirm “replace N chores, M items” → home returns.
- [ ] LoadFailed (unsigned build or missing key) → Erase and start over uses the same confirm dialog as Settings.
- [ ] Hand phone to cleaner → lock timer does not fire during the visit → Hand phone back → owner verification required (label matches the device method).
- [ ] Touch ID device (SE): Settings toggle reads "Require Touch ID"; lock screen and cleaner handback say Touch ID.
- [ ] Passcode-only device (biometrics unenrolled): Settings toggle reads "Require passcode to open"; unlock is the system passcode sheet.
- [ ] Add a consumable → Allow notifications → confirm a pending reminder exists. Weekly digest is repeating (`repeats: true`), not a single fire.
- [ ] Restock → Order → SFSafariViewController opens (not the app WebView); Done returns to the app. Paste a link still works on the item sheet.
- [ ] Settings → Erase all data → relaunch → onboarding; no residual data.
- [ ] Airplane mode: app opens, Today works, weather shows a graceful error.
- [ ] Seasonal shows Apple Weather attribution when a forecast is present. No poor-air or dust-advisory in Watching for.
- [ ] How Cuidala works, Additional terms, Privacy policy, Report a problem, and Cuidala Pro coming soon open from Settings.
- [ ] Confirm built Info.plist includes Face ID and location usage strings; PrivacyInfo.xcprivacy is Data Not Collected (no coarse-location collected type); portrait-only; WeatherKit entitlement present.
- [ ] Confirm the binary is iPhone-only (no iPad destination). Always run a signed build — unsigned Keychain writes fail and show the load-failure screen.
- [ ] PBKDF2 timing: create a backup with a 4-word passphrase; the device stays responsive (spinner, not a freeze).
- [ ] Cold start: kill the app, reopen, vault loads without minting a new key.

## Week-one watch

After the first TestFlight, watch for: lock-timer misses, WeatherKit entitlement / capability mistakes, Keychain unsigned-build confusion, restore confirm skipped, digest not repeating, and geolocation showing localhost.

## Guideline 4.2 appeal (draft)

Cuidala is a local-first iPhone app, not a website wrapper. The shipped binary includes Face ID / Touch ID / passcode lock via LocalAuthentication, a Keychain-held AES-256-GCM vault, repeating local notifications, SFSafariViewController for retailer pages, Files-based encrypted backup and restore, native Apple WeatherKit forecasts, and optional coarse location for climate setup. There is no account, no Cuidala server, and no remote code. First launch can use a sample home and reach Today and Restock immediately.

## Changelog

- 2026-08-24 — Product/security pass: WeatherKit, S1 key-read ordering, repeating digest, portrait-only, timestamp lock, privacy screen, Keychain migration copy.
- 2026-08-24 — Simulator pre-TestFlight run: unsigned builds break Keychain (load-failure screen); iPad deferred (phone-column layout / 4.2 risk); floor raised to iOS 16.4 for `dvh`. iPhone-only; v1 free.
- 2026-08 — Review follow-up: lint gate, encrypted export/import, Face ID residual-risk wording, restock walk-through.
