# Control matrix

VERIFIED means there is a test, a build check, or a committed configuration you can point at. NOT VERIFIED means the control exists in code but has no automated proof yet.

| Control | Reference | Implementation | Verification | Status |
|---|---|---|---|---|
| Household encrypted at rest (AES-256-GCM, random 96-bit IV, AAD) | MASVS-STORAGE-1 | `src/lib/crypto.ts`, `src/lib/storage/` | `src/lib/crypto.test.ts` round-trip, tamper, wrong-key, fresh-IV | VERIFIED |
| Key is random, device-scoped, never derived from a PIN | MASVS-CRYPTO-1 | `src/lib/native/device-key.ts` (Keychain via capacitor-secure-storage-plugin) | Unit test rejects non-32-byte keys; Keychain path manual on device | VERIFIED (key length), NOT VERIFIED (Keychain attributes on device) |
| App lock is a UI gate; vault key is not biometric-bound | MASVS-AUTH-2 | `face-lock.tsx` + `device-key.ts` | Documented in `RESIDUAL_RISKS.md`; Settings copy | VERIFIED (docs), NOT VERIFIED (device) |
| Data never deleted on read failure | Data integrity | `hydrateHousehold` reports `corrupt`/`unavailable`/`key-mismatch`, never removes | `src/lib/storage/vault.test.ts` persist-retry; LoadFailed UI requires explicit erase | VERIFIED (persist retry), NOT VERIFIED (corrupt path UI) |
| New-phone restore without Keychain key is distinguishable | Data integrity | Envelope parses, decrypt fails → `key-mismatch` | Code path; LoadFailed offers backup import | NOT VERIFIED (manual) |
| Encrypted portable backup (PBKDF2 + AES-GCM) | MASVS-CRYPTO-2 | `src/lib/backup.ts` | `src/lib/backup.test.ts` round-trip, wrong passphrase | VERIFIED |
| Legacy pre-release data migrated, PIN/account fields dropped | — | `parseStored`/`migrateHousehold` | `src/lib/storage.test.ts` | VERIFIED |
| No personal or address-specific data in the bundle | Privacy | `src/lib/house.ts` generic; personal room map removed | `storage.test.ts` asserts generic fallback | VERIFIED |
| App lock (Face ID / Touch ID / passcode) fails closed | MASVS-AUTH-2 | `src/components/face-lock.tsx`, `src/lib/native/biometrics.ts` | Manual on device; plugin ≥ 8.3.6 (GHSA-vx5f-vmr6-32wf fixed) | NOT VERIFIED (manual) |
| Cleaner mode exit requires owner verification when available | — | `app-shell.tsx` `onEndVisit` | Manual | NOT VERIFIED (manual) |
| No accounts, no first-party server, no remote code | App Store 2.5.2 / 4.2 | `next.config.ts` `output: "export"`; `capacitor.config.ts` no `server.url` | CI greps `out/` for remote origins | VERIFIED |
| Network limited to Open-Meteo forecast + geocoding | MASVS-NETWORK-1 | CSP `connect-src`, `WKAppBoundDomains`, ATS default | CSP present in `out/index.html` (build); `Info.plist` merged with usage fragment | VERIFIED |
| Location rounded to two decimals before any request | Data minimisation | `roundCoord` in `climate.ts`; `weather/client.ts` | `onboarding/generate.test.ts` skip-location; rounding unit-tested in `climate.test.ts` | VERIFIED |
| External links restricted to known retailers over HTTPS when arriving from outside the app | Open-redirect / phishing | `retailer.ts` `isKnownRetailerUrl`, `extractSharedUrl` | `retailer.test.ts` (lookalike hosts, http, unknown host) | VERIFIED |
| Retailer pages open in SFSafariViewController, not the app WebView | MASVS-PLATFORM-2 | `native/open-url.ts` via `@capacitor/browser` | Manual | NOT VERIFIED (manual) |
| Local notifications only; no push, no token | Privacy | `@capacitor/local-notifications`; no APNs entitlement | Config inspection | VERIFIED |
| Erase-all deletes data, key, and pending notifications | App Store 5.1.1(v) | `eraseHousehold` | Manual | NOT VERIFIED (manual) |
| Privacy policy and terms reachable in-app | App Store 5.1.1(i) | `/privacy`, `/terms`, Settings links | Build output contains both routes | VERIFIED |
| Privacy manifest matches data flows | Apple privacy manifest | `ios/App/App/PrivacyInfo.xcprivacy` — tracking false; coarse location, not linked, app functionality only; UserDefaults CA92.1 | Reviewed against this matrix and `privacy/page.tsx` (no analytics, no account, Open-Meteo only) | VERIFIED |
| Face ID and location usage strings present in shipped Info.plist | App Store 5.1.1 | `ios/App/App/Info.plist` contains `NSFaceIDUsageDescription` and `NSLocationWhenInUseUsageDescription` matching `Info-usage.plist.fragment` | File inspection | VERIFIED |
| Input limits and control-char stripping | ASVS V5 | `sanitize.ts`, `migrateHousehold` | `storage.test.ts` | VERIFIED |
| Dependency audit, secret scan, OSV, Semgrep | Supply chain | `.github/workflows/security.yml` | CI runs on every PR; `npm audit` clean at moderate | VERIFIED |
| Forecast, playbooks, restock math, onboarding, backups | Product | `src/lib/**` | Unit tests including weather-fire idempotence and restock walk | VERIFIED |

## Not implemented (by design for v1)

Accounts, cross-device sync, household invites, server-side anything, in-app purchase / StoreKit (paid up front in App Store Connect; no paywall in the binary). See `docs/RESIDUAL_RISKS.md` for what that leaves open.
