# Incident response and release checks

## What an incident can be

With no servers or accounts, the realistic incidents are: a dependency vulnerability in the shipped bundle, a bug that corrupts or exposes on-device data, or a retailer-link abuse vector. There is no user database to breach and no credentials to rotate.

## Response

1. Confirm scope: which app versions include the affected code (`git log`, App Store Connect build list).
2. Fix on `main`; CI must be green (typecheck, lint, tests, build, audit, secret scan, OSV, Semgrep).
3. Ship a new build via TestFlight → App Store with an expedited review request if user data is at risk.
4. Record the incident, affected versions, and fix in this file's changelog below.

## Pre-release device checks (manual, every TestFlight build)

- [ ] Fresh install: Onboarding → Set up my home → climate payoff (if ZIP) → Walk your house → Today list in under 5 minutes.
- [ ] Fresh install: Use a sample home → Today list immediately; Restock has starter consumables.
- [ ] Face ID lock: background the app for > lock-after, return, verify prompt; cancel prompt → still locked. Confirm this is a UI gate (household is not shown) — Keychain is not biometric-bound.
- [ ] Settings → Require Face ID → Off → no prompt on relaunch.
- [ ] Settings → Back up my home → create file → Erase all data → Restore from that file → home returns.
- [ ] Hand phone to cleaner → Hand phone back → Face ID required.
- [ ] Add a consumable → Allow notifications → confirm a pending reminder exists in the schedule (Settings shows "Allowed").
- [ ] Restock → Order → SFSafariViewController opens (not the app WebView); Done returns to the app.
- [ ] Share a retailer link from Safari to Cuidala → "Save this product" sheet; share a non-retailer link → nothing happens.
- [ ] Settings → Erase all data → relaunch → onboarding; no residual data.
- [ ] Airplane mode: app opens, Today works, weather shows a graceful error.
- [ ] Privacy policy and Terms open from Settings.
- [ ] Confirm built Info.plist includes Face ID and location usage strings; PrivacyInfo.xcprivacy still Data Not Collected + coarse location.
- [ ] Confirm the binary is iPhone-only (no iPad destination). Always run a signed build — unsigned Keychain writes fail and show the load-failure screen.

## Changelog

- 2026-08-24 — Simulator pre-TestFlight run: unsigned builds break Keychain (load-failure screen); iPad deferred (phone-column layout / 4.2 risk); floor raised to iOS 16.4 for `dvh`. iPhone-only; v1 free.
- 2026-08 — Review follow-up: lint gate, Open-Meteo geocoding, encrypted export/import, Face ID residual-risk wording, restock walk-through.
