# Control matrix

Status is honest. **VERIFIED** requires a test name, scan output, or config path. **NOT VERIFIED** means the control is specified or stubbed but proof is not in `docs/evidence/` yet.

| Control | Standard reference | Implementation | Verification | Status |
|---|---|---|---|---|
| AES-256-GCM vault envelopes | ASVS V6, MASVS-CRYPTO | `src/lib/crypto.ts` | `src/lib/crypto.ts` (`alg: A256GCM`); no unit test of decrypt round-trip committed | NOT VERIFIED — add a crypto round-trip test and commit output under `docs/evidence/` |
| Unique GCM nonces via Web Crypto | ASVS V6 | `src/lib/crypto.ts` `encryptHousehold` | Code review of `crypto.getRandomValues` IV | NOT VERIFIED — no dedicated test |
| Refresh tokens stored as SHA-256 hashes | ASVS V2/V3 | `src/lib/auth/session.ts` `hashToken`; `src/lib/auth/store.ts` | Code path exists; no reuse-detection test in CI | NOT VERIFIED |
| Sign in with Apple server-side verify | MASVS-AUTH, App Store 4.8 | `src/lib/auth/apple.ts`, `src/app/api/auth/apple/route.ts` | Needs live Apple JWKS fixture | NOT VERIFIED — requires `APPLE_BUNDLE_ID` / `APPLE_SERVICE_ID` and a recorded token verify |
| Passkeys (WebAuthn platform authenticator) | MASVS-AUTH | `src/lib/passkey.ts` | Manual device check only | NOT VERIFIED |
| Magic link 15-min single-use | ASVS V2 | `src/app/api/auth/magic-link/route.ts` | No automated expiry test | NOT VERIFIED |
| Face ID lock + lock-after | MASVS-AUTH | `src/components/face-lock.tsx`, `src/lib/native/biometrics.ts`, `src/components/app-shell.tsx` | Manual iOS check | NOT VERIFIED |
| Keychain / secure storage for session | MASVS-STORAGE | `src/lib/native/keychain.ts` | Native plugin not exercised in CI | NOT VERIFIED |
| No password field on signup | MASVS-AUTH | `src/components/onboarding.tsx` | Code inspection of welcome screen | NOT VERIFIED — grep-based test not committed |
| Account deletion | App Store 5.1.1(v) | `src/app/api/account/route.ts`, Settings in `src/components/home-view.tsx` | Manual | NOT VERIFIED |
| Location rounded to 2 decimals + ZIP only | MASVS-PRIVACY, CCPA minimization | `src/lib/climate.ts` `roundCoord`, onboarding location step | `src/lib/onboarding/generate.test.ts` skip-location case | NOT VERIFIED for rounding; skip-location test exists |
| Privacy manifest | Apple Privacy | `ios/App/App/PrivacyInfo.xcprivacy` | File present; App Store Connect labels not submitted | NOT VERIFIED |
| Face ID / location / camera usage strings | Apple Platform Security | `ios/App/App/Info-usage.plist.fragment` | Must be merged into generated Info.plist | NOT VERIFIED |
| Universal links + webcredentials | MASVS-PLATFORM | `public/.well-known/apple-app-site-association` | TEAMID placeholder | NOT VERIFIED |
| Security headers (HSTS preload, nosniff, CSP, no-store on API) | ASVS V14, spec 1.3 | `next.config.ts` | Config present; no header integration test | NOT VERIFIED |
| Request size limits (1 MB JSON) | ASVS V12/V13 | `src/lib/http.ts` | No automated limit test | NOT VERIFIED |
| Outbound weather timeout 8s | ASVS V9 | `src/lib/weather/provider.ts` | `src/lib/playbooks/playbooks.test.ts` does not cover timeout | NOT VERIFIED |
| Weather degrade (no crash, no tasks) | spec B4 | `src/app/api/weather/route.ts`, Seasonal status | Manual / UI path | NOT VERIFIED |
| Structured logs with PII redaction | ASVS V7 | `src/lib/logger.ts` | No redaction unit test | NOT VERIFIED |
| Tamper-evident local audit hash chain | spec 1.2 | `src/lib/audit.ts` | No chain-verify test | NOT VERIFIED |
| Household-scoped vault (no IDOR on ciphertext) | ASVS V4 | `src/app/api/vault/[vaultId]/route.ts` auth hash | Existing auth-hash compare; no IDOR test named | NOT VERIFIED |
| Household member roles reserved, no invites | spec 1.7 | `Household.householdRole` in `src/lib/types.ts` | N/A — invites not built | N/A — invite feature not implemented; design reserved |
| Envelope / KMS master keys | spec 1.1 | Client Web Crypto only; no managed KMS | — | NOT VERIFIED — no AWS/GCP KMS. Accepted residual until KMS is wired |
| WAF / DDoS / App Attest | spec 1.3 | Not implemented | — | NOT VERIFIED |
| SBOM per release | spec 1.4 | `docs/SBOM/README.md` | No CycloneDX artifact | NOT VERIFIED |
| Signed images / cosign | spec 1.4 | — | — | NOT VERIFIED |
| CI SAST (Semgrep OWASP) | spec 1.5 | `.github/workflows/security.yml` | Workflow added; no passing scan log committed | NOT VERIFIED |
| Secret scanning (gitleaks) | spec 1.5 | `.github/workflows/security.yml` | No evidence file | NOT VERIFIED |
| Dependency scanning (`npm audit`, OSV) | spec 1.5 | `.github/workflows/security.yml` | No evidence file | NOT VERIFIED |
| Container / IaC / MobSF / ZAP | spec 1.5 | No container or IPA yet | — | NOT VERIFIED |
| Independent pen test | Release gate 8 | — | — | NOT VERIFIED — owner-held |
| Counsel-reviewed ToS / Privacy | Release gate 9 | — | — | NOT VERIFIED — owner-held |
| Forecast engine rules | product spec A3 | `src/lib/forecast/index.ts` | `src/lib/forecast/forecast.test.ts` | VERIFIED for overdue, missing-data, condition, set-aside |
| Climate playbook matching | product spec B3 | `src/lib/playbooks/index.ts`, `src/lib/climate.ts` | `src/lib/playbooks/playbooks.test.ts` | VERIFIED for Tucson/Minneapolis/hasPool/freeze cooldown |
| Onboarding generation | onboarding §3.1 | `src/lib/onboarding/generate.ts` | `src/lib/onboarding/generate.test.ts` | VERIFIED for defaults, skip location, sample home, apartment rooms |
| ATS / certificate pinning | MASVS-NETWORK | Capacitor/iOS ATS defaults; no pinning | — | NOT VERIFIED |
| App Attest on high-value endpoints | spec 1.3 | — | — | NOT VERIFIED |
| Minimum supported app version | spec 1.3 | `src/lib/auth/session.ts` `minSupportedAppVersion` | Helper only; not enforced on login | NOT VERIFIED |
