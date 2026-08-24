# Incident response

Owner-held runbook. Cursor cannot declare this exercised.

## Phases

1. **Detection** — auth failure spike, refresh-token reuse, vault 401 burst, weather/AI 5xx, unexpected admin session. Sources: Vercel logs, `logEvent` JSON lines, local audit chain in Settings (when exported).
2. **Containment** — rotate `BLOB_READ_WRITE_TOKEN`, revoke refresh tokens by deleting `auth/store-v1.json` refresh rows, force `MIN_SUPPORTED_APP_VERSION` bump, disable magic-link sending (`RESEND_API_KEY` unset).
3. **Eradication** — patch the route, rotate Apple client secret if leaked, invalidate Keychain sessions by changing vault wrap (users re-auth with Sign in with Apple).
4. **User notification** — if email + address (or ZIP + name) may have been exposed, export the affected user list from the auth store and notify within the shortest applicable US state window (often 30–60 days). Template below.
5. **Post-mortem** — date, timeline, data elements, who was notified, residual risk. Store under `docs/evidence/incidents/`.

## Data elements that trigger notice

At minimum: email, approximate location (ZIP / lat-lng), and household nickname. The app does not store retailer credentials, payment methods, or shipping addresses. Vault ciphertext alone, without the Keychain secret, is not treated as a contents disclosure until counsel says otherwise.

## Notice template

Subject: Important information about your Estrellita account

We learned on [date] that [what happened]. Information that may have been involved: [list]. We [contained by]. You should [sign in with Apple again]. This is not a request for a password — Estrellita does not use passwords.

## Contacts

- Owner on-call: fill in
- Counsel: fill in
- Host: Vercel
- Apple: developer.apple.com support + App Store Connect

## Staging drill

NOT VERIFIED. Fire a deliberate alert in staging and record receipt here with date.
