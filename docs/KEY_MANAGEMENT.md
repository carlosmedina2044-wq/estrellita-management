# Key management

## What exists today

- **Household vault key** — derived in the client with PBKDF2-SHA256 (310k) + HKDF from a device secret stored in iOS Keychain (`capacitor-secure-storage-plugin`) or, on web, session/local storage. AES-256-GCM, 12-byte IV, vaultId as AAD. See `src/lib/crypto.ts`.
- **Refresh tokens** — opaque, stored only as SHA-256 hashes in the auth blob (`src/lib/auth/store.ts`).
- **Apple identity tokens** — verified against Apple JWKS; not stored.
- **Magic-link tokens** — hashed, 15-minute TTL, single-use.

## What does not exist yet

- Managed KMS (AWS KMS / Cloud KMS) for a master wrap key.
- Separate production vs staging CMKs.
- Annual master-key rotation with re-wrap of data keys.
- IAM that grants `Decrypt` only to the API role.

Those are **NOT VERIFIED**. Until KMS is wired, the master secret is the per-user vault secret on device. Application code never ships a hardcoded master key.

## Rotation procedure (staging)

1. Generate a new vault secret on device after Sign in with Apple.
2. Re-wrap the household (`wrapHousehold` / `rotateVaultSecret`).
3. Confirm the old secret fails unlock.
4. Record date and operator in `docs/evidence/kms-rotation-staging.md`.

NOT VERIFIED — this drill has not been run.

## Backup restore

Restore is “pull vault envelope + unlock with the Keychain secret.” A forgotten device secret cannot be recovered by the server. NOT VERIFIED in staging.
