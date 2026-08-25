# Cuidala

Home maintenance for iPhone: rooms, chores, the filters and batteries you need to reorder, a maintenance budget forecast, and seasonal / weather-driven checklists.

**Local-first.** There are no accounts and no Cuidala servers. Everything lives on the device, encrypted at rest (AES-256-GCM) with a key held in the iOS Keychain (`kSecAttrAccessibleAfterFirstUnlock`). That key migrates with encrypted iCloud and Finder backups and Quick Start. Face ID / Touch ID / passcode is required before the home is shown and fails closed. That lock is an app-level UI gate, not a second encryption layer on the Keychain item (see `docs/RESIDUAL_RISKS.md`). Forecasts come from Apple WeatherKit on device. ZIP stays on the phone for climate zone.

The UI is a Next.js app exported to static files and packaged by Capacitor into a native iOS shell. No remote code is loaded.

**No account. No cloud. Yours.** One home, one phone, for v1.

## Develop

```bash
npm install
npm run dev          # web shell at http://localhost:3456 (dev only; see "Web shell" below)
npm test             # unit tests (node:test)
npm run lint
npm run typecheck
npm run build        # static export to out/ — this is what ships
```

## Build the iOS app

Requires macOS with Xcode 16+ and **Node 22+** (Capacitor 8). The native project is committed at `ios/App/App.xcodeproj`. Plugins are Swift packages, so CocoaPods is not required.

```bash
nvm install 22 && nvm use 22      # or any Node 22+
npm install
npm run cap:sync                  # static export to out/ + copy into the iOS app
npm run cap:ios                   # open in Xcode; set Team
```

In Xcode:
- Signing & Capabilities: your team; bundle id `com.cuidala.app`.
- Enable the **WeatherKit** capability on the App ID (`com.cuidala.app`) in the Apple Developer portal, then pull the updated provisioning profile. The repo ships `com.apple.developer.weatherkit` in `App.entitlements`.
- Always run **signed** (Xcode’s default “Sign to Run Locally” is fine on the simulator). Building with code signing stripped breaks Keychain writes and the app shows the load-failure screen.
- Add capability **Push Notifications** is *not* needed (local notifications only).
- Deployment target iOS 16.4 or later (`dvh` layout units). Required device capability is **arm64**. iPhone-only, portrait-only for v1 (iPad is deferred).
- Archive → Distribute → App Store Connect.

## App Store Connect notes

- **Price:** free for v1 (validate demand). Cuidala Pro is listed in Settings as coming soon (Home Report, more than 3 warranties, Budget beyond 30 days, seasonal playbook packs; one-time about $14.99–$19.99). No StoreKit in this binary.
- **Devices:** iPhone only for v1 (`TARGETED_DEVICE_FAMILY = 1`). Portrait only. iPad is planned for a later release.
- **Storefront:** United States only for v1.
- **App Privacy:** Data Not Collected. WeatherKit is Apple-collected. Matches `PrivacyInfo.xcprivacy`.
- **Privacy policy URL:** host `out/privacy/` (e.g. on Vercel) and use that URL; the same policy is reachable in-app at Settings → Privacy policy. Have a support URL ready before submission.
- **Listing copy:** lead with “No account. No cloud. Yours.” State one home, one phone.
- **Reviewer notes:** This is a Capacitor/WKWebView app with native iOS capabilities, not a thin website wrapper:
  - Face ID / Touch ID / device passcode lock (LocalAuthentication via native plugin); cancel stays locked.
  - Keychain-held AES-256-GCM vault; the key migrates with encrypted iCloud backup. Encrypted portable backup in Settings is extra.
  - Local notifications (no push, no APNs), including a repeating weekly digest.
  - Retailer pages open in SFSafariViewController, not the app WebView. Paste a product link in Restock. There is no iOS Share Extension.
  - Apple WeatherKit (native) for forecasts, with required Apple Weather attribution.
  - Optional location during setup (system permission sheet shows Cuidala). ZIP can be typed instead for climate.
  - Files picker for encrypted backup restore.
  - No sign-in. On first launch tap **Use a sample home instead** to reach the task list immediately, with Restock already seeded.
  - Order opens the retailer in Safari; no in-app purchase.
  - iPhone only; portrait only.
- **Export compliance:** `ITSAppUsesNonExemptEncryption = false`. Encryption is Apple-provided WebCrypto inside WebKit (AES-GCM, PBKDF2) plus the iOS Keychain. No custom crypto library is shipped.
- **Age rating:** 4+ listing; Additional terms require 18+.
- **EULA:** Apple Standard EULA in App Store Connect, plus in-app Additional terms.

## Web shell

`npm run dev` and a hosted copy of `out/` exist for development and for the privacy-policy URL. On the web there is no Keychain: the encryption key is kept in `localStorage`, notifications are the browser API, the app lock is unavailable, and WeatherKit is iOS-only. It is not a supported end-user surface.

## Security posture

`docs/CONTROL_MATRIX.md` lists each control, where it lives, and how it is verified. `docs/RESIDUAL_RISKS.md` lists what is knowingly left open. Both must stay accurate; update them in the same PR as the code they describe.
