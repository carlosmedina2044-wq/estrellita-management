# Residual risks

| Risk | Why it is accepted | Compensating control |
|---|---|---|
| Unlocked, stolen iPhone with the app already open | Any local app shares this risk | Lock-after timer (immediate / 2 min / 15 min) re-locks on background using timestamps on `appStateChange`; Face ID prompt on relaunch; privacy blur in the app switcher. |
| Device passcode holder can disable Face ID and open the app | iOS trust model: passcode is root | Documented in-app copy; no weaker fallback exists. |
| **App lock is presentation-layer, not cryptographic.** Face ID / Touch ID / passcode must succeed before the household UI is shown (`FaceLock` flips React state). The Keychain item that holds the AES key is *not* wrapped in `kSecAccessControlBiometryCurrentSet`, so the app process can read the key without user presence. Jailbreak / WebView inspection of a running app can therefore reach the vault. | Plugin and iOS version constraints for v1; stock iOS still requires device unlock | Fail-closed UI gate; lock-after timer; residual documented here and in Settings. Roadmap: biometric Keychain access control so decryption itself requires Face ID. |
| Data lost with the device | No server copy by design. The Keychain item uses AfterFirstUnlock and migrates through encrypted iCloud/Finder backups and Quick Start. | In-app encrypted export/import (“Back up my home”) is extra protection. Roadmap: CloudKit sync. |
| Forgotten backup passphrase | Passphrase is never stored | File is useless without it; copy in Settings and Additional terms. |
| `script-src 'unsafe-inline'` in CSP | Next.js static export emits per-build inline bootstrap scripts | No third-party scripts, no HTML from user input, `connect-src 'self'`, no server. Revisit if Next supports hashed inline scripts in export mode. |
| Web shell stores the key in `localStorage` | Dev-only surface | README states it is unsupported for end users. |
| Apple WeatherKit sees a location | Needed for forecasts | Native WeatherKit; Apple-collected; ZIP stays on device for climate. Users may skip location and type a ZIP, or skip both. |
| Retailer sites opened by the user are third parties | Inherent to deep-linking | SFSafariViewController isolation; app never sees the session. |
| **Notification content (item names) can show on the lock screen (S7).** Local notifications include chore/item titles. | Needed so the nudge is useful without opening the app | Users can disable notifications in iOS Settings. No push, no server. |
| Manual verification items in the control matrix | No device CI yet | Run the checklist in `docs/INCIDENT_RESPONSE.md` §"Pre-release device checks" before each TestFlight build. |
