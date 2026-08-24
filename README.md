# Estrellita

iOS App Store household app. The product UI is a Next.js App Router client; Capacitor wraps it for Sign in with Apple, Face ID, and Keychain. Duties stay encrypted on device (AES-256-GCM) before sync. Restock tracks runway and opens any retailer in the browser — the app does not place orders or store payment info.

## Run the web shell

```bash
npm install
npm run dev
```

[http://localhost:3456](http://localhost:3456)

```bash
npm test
npm run build
```

## iOS / App Store

```bash
npx cap add ios   # once, requires Xcode
# Merge ios/App/App/Info-usage.plist.fragment into Info.plist
npx cap sync ios
npx cap open ios
```

Configure `APPLE_BUNDLE_ID`, `APPLE_SERVICE_ID`, and replace `TEAMID` in `public/.well-known/apple-app-site-association`. Privacy manifest: `ios/App/App/PrivacyInfo.xcprivacy`.

Sign in with Apple is the primary button. Passkeys and email magic links are secondary. There is no password field on signup. Face ID locks the app after launch / background per Settings.

## Environment

Server-only: `BLOB_READ_WRITE_TOKEN`, `APPLE_BUNDLE_ID`, `APPLE_SERVICE_ID`, `RESEND_API_KEY`, `AUTH_FROM_EMAIL`, `MIN_SUPPORTED_APP_VERSION`. Never commit `.env*`.

## Specs implemented

- Sign-up / under-3-minute room setup (no appraisal or floor-plan upload). Reviewers: tap **Use a sample home** on the first screen.
- Restock: knows what is running out and when to order it, one tap to any retailer. The app does not process purchases or store retailer credentials.
- Budget forecast + seasonal/weather playbooks
- Security verification artifacts in `docs/` — statuses are honest; most controls are **NOT VERIFIED** until evidence is committed

## App Store reviewer notes

Onboarding does not require any documents. Tap “Use a sample home” on the first screen to load a pre-built home and reach the task list immediately. The Restock tab’s Order / Find it buttons open the retailer’s own site in an in-app browser; the app does not process purchases or store payment information.
