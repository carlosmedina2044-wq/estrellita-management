import { isPlainObject } from "@/lib/sanitize";

/**
 * At-rest encryption for the household record.
 *
 * The key is a random 256-bit AES key generated on first launch and held in the
 * iOS Keychain (see `native/device-key.ts`). Nothing is derived from a PIN, so
 * the ciphertext cannot be brute-forced offline. The envelope is versioned so a
 * future format change can migrate in place.
 */
export const VAULT_STORAGE_KEY = "cuidala-vault-v2";
/** Pre-rebrand encrypted store. Copied once onto `VAULT_STORAGE_KEY`, then removed. */
export const PREVIOUS_VAULT_KEY = "estrellita-vault-v2";
export const LEGACY_VAULT_KEY = "estrellita-vault-v1";
export const LEGACY_PLAINTEXT_KEY = "estrellita-household-v1";

const VAULT_AAD = VAULT_STORAGE_KEY;
const PREVIOUS_VAULT_AAD = PREVIOUS_VAULT_KEY;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type VaultEnvelope = {
  v: 2;
  alg: "A256GCM";
  iv: string;
  ciphertext: string;
  updatedAt: string;
};

export function isVaultEnvelope(value: unknown): value is VaultEnvelope {
  if (!isPlainObject(value)) return false;
  return (
    value.v === 2 &&
    value.alg === "A256GCM" &&
    typeof value.iv === "string" &&
    typeof value.ciphertext === "string" &&
    typeof value.updatedAt === "string" &&
    value.iv.length >= 16 &&
    value.ciphertext.length > 0 &&
    value.ciphertext.length < 8_000_000
  );
}

/** Older PBKDF2/PIN envelopes from pre-release builds. Never opened, never deleted. */
export function isLegacyPinEnvelope(value: unknown): boolean {
  return isPlainObject(value) && value.v === 1 && value.kdf === "PBKDF2-SHA256" && value.kind !== "cuidala-backup";
}

function asBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function b64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function generateRawKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function importRawKey(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.byteLength !== 32) throw new Error("Vault key must be 32 bytes");
  return crypto.subtle.importKey("raw", asBufferSource(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptJson(
  key: CryptoKey,
  plaintext: string,
  aad: string = VAULT_AAD,
): Promise<VaultEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(aad) },
    key,
    encoder.encode(plaintext),
  );
  return {
    v: 2,
    alg: "A256GCM",
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(sealed)),
    updatedAt: new Date().toISOString(),
  };
}

export async function decryptJson(key: CryptoKey, envelope: VaultEnvelope, aad: string = VAULT_AAD): Promise<string> {
  const iv = asBufferSource(b64ToBytes(envelope.iv));
  const data = asBufferSource(b64ToBytes(envelope.ciphertext));
  const candidates = aad === VAULT_AAD ? [VAULT_AAD, PREVIOUS_VAULT_AAD] : [aad];
  for (const extra of candidates) {
    try {
      const opened = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: encoder.encode(extra) },
        key,
        data,
      );
      return decoder.decode(opened);
    } catch {
      // try the next AAD — pre-rebrand envelopes used the old storage-key string
    }
  }
  throw new Error("Unable to decrypt vault");
}

export function parseEnvelopeJson(raw: string): VaultEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isVaultEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
