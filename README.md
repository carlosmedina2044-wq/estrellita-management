# Cuidala

Home maintenance for iPhone: rooms, chores, the filters and batteries you need to reorder, a maintenance budget forecast, and seasonal / weather-driven checklists.

**Local-first.** There are no accounts and no Cuidala servers. Everything lives on the device, encrypted at rest (AES-256-GCM) with a key held in the iOS Keychain. Face ID / Touch ID / passcode lock is enforced by the system prompt and fails closed. The only network calls are to two public weather endpoints, sent a coordinate rounded to ~1 km with no identifier.

The UI is a Next.js app exported to static files and packaged by Capacitor into a native iOS shell. No remote code is loaded.

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
- Add capability **Push Notifications** is *not* needed (local notifications only).
- Deployment target iOS 15.0 or later.
- Archive → Distribute → App Store Connect.

## App Store Connect notes

- **App Privacy:** Data Not Collected except *Coarse Location → App Functionality, not linked to identity*. Matches `PrivacyInfo.xcprivacy`.
- **Privacy policy URL:** host `out/privacy/` (e.g. on Vercel) and use that URL; the same policy is reachable in-app at Settings → Privacy policy.
- **Reviewer notes:** No sign-in. On first launch tap **Use a sample home instead** to reach the task list immediately. Restock's Order / Find it buttons open the retailer in an in-app Safari view; the app does not process purchases or store payment information.
- **Export compliance:** the app uses only Apple-provided encryption (`ITSAppUsesNonExemptEncryption = false`).
- **Age rating:** 4+.

## Web shell

`npm run dev` and a hosted copy of `out/` exist for development and for the privacy-policy URL. On the web there is no Keychain: the encryption key is kept in `localStorage`, notifications are the browser API, and Face ID lock is unavailable. It is not a supported end-user surface.

## Security posture

`docs/CONTROL_MATRIX.md` lists each control, where it lives, and how it is verified. `docs/RESIDUAL_RISKS.md` lists what is knowingly left open. Both must stay accurate; update them in the same PR as the code they describe.
