# Control matrix

VERIFIED means there is a test, a build check, or a committed configuration you can point at. NOT VERIFIED means the control exists in code but has no automated proof yet.

| Control | Reference | Implementation | Verification | Status |
|---|---|---|---|---|
| Household encrypted at rest (AES-256-GCM, random 96-bit IV, AAD) | MASVS-STORAGE-1 | `src/lib/crypto.ts`, `src/lib/storage/` | `src/lib/crypto.test.ts` round-trip, tamper, wrong-key, fresh-IV | VERIFIED |
| Key is random, device-scoped, never derived from a PIN | MASVS-CRYPTO-1 | `src/lib/native/device-key.ts` (Keychain via capacitor-secure-storage-plugin, `kSecAttrAccessibleAfterFirstUnlock`) | Unit test rejects non-32-byte keys; missing-vs-other Keychain errors in `device-key.test.ts` | VERIFIED (key length + missing-item), NOT VERIFIED (Keychain attributes on device) |
| Vault is read before any key mint; never overwrite a vault with a fresh key | S1 | `hydrateHousehold` loads vault first; `persist` refuses to `createDeviceKey` while a vault exists | `vault.test.ts` key-mismatch / unavailable / first-launch mint | VERIFIED |
| App lock is a UI gate; vault key is not biometric-bound | MASVS-AUTH-2 | `face-lock.tsx` + `device-key.ts` | Documented in `RESIDUAL_RISKS.md`; Settings copy | VERIFIED (docs), NOT VERIFIED (device) |
| Lock-after uses timestamps on `appStateChange`, not JS timers | S3 | `app-shell.tsx`; suspended during cleaner visits | Manual on device | NOT VERIFIED (manual) |
| Privacy screen in app switcher | S4 | `SceneDelegate.sceneWillResignActive` blur overlay | Manual | NOT VERIFIED (manual) |
| Data never deleted on read failure | Data integrity | `hydrateHousehold` reports `corrupt`/`unavailable`/`key-mismatch`, never removes | `src/lib/storage/vault.test.ts` persist-retry; LoadFailed UI requires AlertDialog erase | VERIFIED (persist retry), NOT VERIFIED (corrupt path UI) |
| Turning app lock off requires `verifyDeviceOwner` | S5 | Settings toggle | Manual | NOT VERIFIED (manual) |
| Restore from file confirms replacement counts | S5 | `BackupPanel` AlertDialog | Manual | NOT VERIFIED (manual) |
| Persist failure surfaces a toast once | S6 | `PERSIST_FAILED_EVENT` in `vault.ts` | Code path | NOT VERIFIED (manual) |
| New-phone restore without Keychain key is distinguishable | Data integrity | Envelope parses, decrypt fails or key missing → `key-mismatch` | Code path; LoadFailed offers backup import | NOT VERIFIED (manual) |
| Encrypted portable backup (PBKDF2-HMAC-SHA256 600k + AES-GCM, NFC passphrase) | MASVS-CRYPTO-2 | `src/lib/backup.ts`; native share writes a temp file via `@capacitor/filesystem` | `src/lib/backup.test.ts` round-trip, 210k legacy, NFC, wrong passphrase | VERIFIED |
| Legacy pre-release data migrated, PIN/account fields dropped | — | `parseStored`/`migrateHousehold` | `src/lib/storage.test.ts` | VERIFIED |
| Completion history capped at 24 months | Q8 | `rollOldCompletions` in `migrateHousehold` | Code path | VERIFIED (code) |
| No personal or address-specific data in the bundle | Privacy | `src/lib/house.ts` generic; personal room map removed | `storage.test.ts` asserts generic fallback | VERIFIED |
| App lock (Face ID / Touch ID / passcode) fails closed | MASVS-AUTH-2 | `src/components/face-lock.tsx`, `src/lib/native/biometrics.ts` | Manual on device; plugin ≥ 8.3.6 (GHSA-vx5f-vmr6-32wf fixed) | NOT VERIFIED (manual) |
| Cleaner mode exit requires owner verification when available | — | `app-shell.tsx` `onEndVisit` | Manual | NOT VERIFIED (manual) |
| No accounts, no first-party server, no remote code | App Store 2.5.2 / 4.2 | `next.config.ts` `output: "export"`; `capacitor.config.ts` no `server.url` | CI greps `out/` for remote origins | VERIFIED |
| No third-party weather network from WKWebView | MASVS-NETWORK-1 | WeatherKit native plugin; CSP `connect-src 'self'`; Open-Meteo hosts removed | CSP in `layout.tsx`; `Info.plist` has no Open-Meteo domains | VERIFIED |
| Location rounded to two decimals before storage | Data minimisation | `roundCoord` in `climate.ts` | `climate.test.ts` | VERIFIED |
| External links restricted to known retailers over HTTPS when arriving from outside the app | Open-redirect / phishing | `retailer.ts` `isKnownRetailerUrl`, `extractSharedUrl` | `retailer.test.ts` (lookalike hosts, http, unknown host) | VERIFIED |
| Retailer pages open in SFSafariViewController, not the app WebView | MASVS-PLATFORM-2 | `native/open-url.ts` via `@capacitor/browser` | Manual | NOT VERIFIED (manual) |
| Local notifications only; no push, no token | Privacy | `@capacitor/local-notifications`; no APNs entitlement | Config inspection | VERIFIED |
| Weekly digest is repeating | Product | `schedule.on` + `repeats: true` | `notifications.test.ts` | VERIFIED |
| Erase-all deletes data, key, and pending notifications | App Store 5.1.1(v) | `eraseHousehold` | Manual | NOT VERIFIED (manual) |
| Privacy policy and additional terms reachable in-app | App Store 5.1.1(i) | `/privacy`, `/terms`, `/how-it-works`, Settings links | Build output contains routes | VERIFIED |
| Privacy manifest matches data flows | Apple privacy manifest | `PrivacyInfo.xcprivacy` — tracking false; collected types empty (WeatherKit is Apple-collected); UserDefaults CA92.1 | Reviewed against this matrix and `privacy/page.tsx` | VERIFIED |
| Face ID and location usage strings present in shipped Info.plist | App Store 5.1.1 | `ios/App/App/Info.plist` | File inspection | VERIFIED |
| Export compliance | App Store | `ITSAppUsesNonExemptEncryption=false`. Encryption is WebCrypto (AES-GCM, PBKDF2) provided by Apple inside WebKit, plus iOS Keychain. No custom crypto library is shipped. | Info.plist + this row | VERIFIED (config) |
| Input limits and control-char stripping | ASVS V5 | `sanitize.ts`, `migrateHousehold` | `storage.test.ts` | VERIFIED |
| Dependency audit, secret scan, OSV, Semgrep | Supply chain | `.github/workflows/security.yml` | CI: `npm audit --omit=dev --audit-level=moderate`. OSV pinned to `osv-scanner-action@v2.5.1`. Known exception: `@capacitor/cli → xcode → uuid` (`GHSA-w5hq-g745-h8pq`) in `osv-scanner.toml`; not in the shipped bundle. | VERIFIED |
| Forecast, playbooks, restock math, onboarding, backups | Product | `src/lib/**` | Unit tests including weather-fire idempotence, restock invariants, climate ZIP-3 table, WeatherKit provider mock | VERIFIED |
| Typical costs labeled and reviewed | Q3 | `src/lib/costs/sources.json` ("national typical, 2026"); quote-only for gas/electrical/roof/structural/pest | Review this file annually | VERIFIED (file) |
| Portrait-only iPhone | Product | `Info.plist` `UISupportedInterfaceOrientations` portrait; `TARGETED_DEVICE_FAMILY = 1` | File inspection | VERIFIED |
| UserDefaults vault (not Filesystem) | Q8 deferred | `@capacitor/preferences` | Documented as 1.1; skip Filesystem move this pass | ACCEPTED for v1 |

## Not implemented (by design for v1)

Accounts, cross-device sync, household invites, server-side anything, in-app purchase / StoreKit (v1 is free; Cuidala Pro is listed as coming soon in Settings, copy only), iPad, and a share extension. One home, one phone. See `docs/RESIDUAL_RISKS.md` for what that leaves open.

## 1.1 follow-ups

Move the encrypted vault from UserDefaults to Filesystem. Expand playbooks toward 100 tasks. StoreKit for Cuidala Pro.
