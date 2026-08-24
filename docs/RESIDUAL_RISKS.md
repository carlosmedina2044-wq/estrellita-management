# Residual risks

| Risk | Why it is accepted | Compensating control |
|---|---|---|
| Unlocked, stolen iPhone with the app already open | Any local app shares this risk | Lock-after timer (immediate / 2 min / 15 min) re-locks on background; Face ID prompt on relaunch. |
| Device passcode holder can disable Face ID and open the app | iOS trust model: passcode is root | Documented in-app copy; no weaker fallback exists. |
| Data lost with the device | No server copy by design | Terms advise device backups. iCloud device backup includes app data (ciphertext) but not the Keychain item unless encrypted backup is on; a restored backup may need "Erase and start over". Roadmap: CloudKit sync. |
| `script-src 'unsafe-inline'` in CSP | Next.js static export emits per-build inline bootstrap scripts | No third-party scripts, no HTML from user input, `connect-src` pinned, no server. Revisit if Next supports hashed inline scripts in export mode. |
| Web shell stores the key in `localStorage` | Dev-only surface | README states it is unsupported for end users. |
| Weather providers see a ~1 km coordinate | Needed for forecasts | No identifier is sent; users may skip location entirely. |
| Retailer sites opened by the user are third parties | Inherent to deep-linking | SFSafariViewController isolation; app never sees the session. |
| Manual verification items in the control matrix | No device CI yet | Run the checklist in `docs/INCIDENT_RESPONSE.md` §"Pre-release device checks" before each TestFlight build. |
