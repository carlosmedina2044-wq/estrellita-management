# Residual risks

| Risk | Why it is accepted | Compensating control |
|---|---|---|
| Unlocked, stolen iPhone with the app already open | Any local app shares this risk | Lock-after timer (immediate / 2 min / 15 min) re-locks on background; Face ID prompt on relaunch. |
| Device passcode holder can disable Face ID and open the app | iOS trust model: passcode is root | Documented in-app copy; no weaker fallback exists. |
| **App lock is presentation-layer, not cryptographic.** Face ID / Touch ID / passcode must succeed before the household UI is shown (`FaceLock` flips React state). The Keychain item that holds the AES key is *not* wrapped in `kSecAccessControlBiometryCurrentSet`, so the app process can read the key without user presence. Jailbreak / WebView inspection of a running app can therefore reach the vault. | Plugin and iOS version constraints for v1; stock iOS still requires device unlock | Fail-closed UI gate; lock-after timer; residual documented here and in Settings. Roadmap: biometric Keychain access control so decryption itself requires Face ID. |
| Data lost with the device or after restoring to a new iPhone | No server copy by design. iCloud device backup includes app data (ciphertext) but not the Keychain item unless encrypted backup is on. | In-app encrypted export/import (“Back up my home”) sealed with a user passphrase; setup and Settings warn that a phone upgrade without that file shows “Erase and start over”. Roadmap: CloudKit sync. |
| Forgotten backup passphrase | Passphrase is never stored | File is useless without it; copy in Settings and Terms. |
| `script-src 'unsafe-inline'` in CSP | Next.js static export emits per-build inline bootstrap scripts | No third-party scripts, no HTML from user input, `connect-src` pinned to Open-Meteo only, no server. Revisit if Next supports hashed inline scripts in export mode. |
| Web shell stores the key in `localStorage` | Dev-only surface | README states it is unsupported for end users. |
| Weather provider sees a ~1 km coordinate or a ZIP | Needed for forecasts and geocoding | One vendor (Open-Meteo); no identifier is sent; users may skip location entirely. |
| Retailer sites opened by the user are third parties | Inherent to deep-linking | SFSafariViewController isolation; app never sees the session. |
| Manual verification items in the control matrix | No device CI yet | Run the checklist in `docs/INCIDENT_RESPONSE.md` §"Pre-release device checks" before each TestFlight build. |
