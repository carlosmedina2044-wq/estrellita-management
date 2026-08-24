# Residual risks

| Risk | Compensating control |
|---|---|
| Unlocked, stolen iPhone | Face ID lock on launch / background; Keychain `WhenUnlockedThisDeviceOnly` target (native plugin). Still loses data if Face ID is disabled by the thief with the device passcode. |
| Weather or model-provider outage | Open-Meteo failures return 503 and do not create tasks; Seasonal shows last error. |
| No independent pen test | Release gate blocks public launch until a third party tests iOS + API. |
| No managed KMS | Device-held vault secret + AES-GCM. Stolen Blob store is ciphertext. |
| TEAMID / Apple credentials not filled | Sign in with Apple fails closed on the server if bundle/service ID is unset. |
| Local audit log can be wiped by the user | Hash-chained on device only; not a WORM bucket. |
| Cleaner handoff | Existing PIN path remains for returning from cleaner mode on legacy vaults; new accounts prefer Face ID. |
