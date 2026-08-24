import { b64ToBytes, bytesToB64, encryptJson, decryptJson, importRawKey } from "@/lib/crypto";
import { isPlainObject, sanitizeText } from "@/lib/sanitize";

/**
 * Portable encrypted household backup. Separate from the on-device vault:
 * the device key stays in Keychain; this file is sealed with a passphrase
 * the user chooses so they can restore on a new iPhone.
 */
export const BACKUP_KIND = "cuidala-backup";
export const BACKUP_AAD = "cuidala-backup-v1";
export const BACKUP_ITERATIONS = 600_000;
export const BACKUP_MIN_PASSPHRASE = 8;

export type BackupEnvelope = {
  v: 1;
  kind: typeof BACKUP_KIND;
  alg: "A256GCM";
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
};

const encoder = new TextEncoder();

export function isBackupEnvelope(value: unknown): value is BackupEnvelope {
  if (!isPlainObject(value)) return false;
  return (
    value.v === 1 &&
    value.kind === BACKUP_KIND &&
    value.alg === "A256GCM" &&
    value.kdf === "PBKDF2-SHA256" &&
    typeof value.iterations === "number" &&
    value.iterations >= 100_000 &&
    typeof value.salt === "string" &&
    typeof value.iv === "string" &&
    typeof value.ciphertext === "string" &&
    typeof value.createdAt === "string" &&
    value.salt.length >= 16 &&
    value.ciphertext.length > 0 &&
    value.ciphertext.length < 8_000_000
  );
}

export function normalizePassphrase(value: string): string {
  return sanitizeText(value.normalize("NFC"), 128);
}

export function passphraseError(value: string): string | null {
  const passphrase = normalizePassphrase(value);
  if (passphrase.length < BACKUP_MIN_PASSPHRASE) {
    return `Passphrases are at least ${BACKUP_MIN_PASSPHRASE} characters.`;
  }
  return null;
}

async function deriveBackupKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveBits"]);
  const saltBuf = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuf, iterations },
    material,
    256,
  );
  return importRawKey(new Uint8Array(bits));
}

export async function sealBackup(
  plaintext: string,
  passphrase: string,
  iterations: number = BACKUP_ITERATIONS,
): Promise<string> {
  const cleaned = normalizePassphrase(passphrase);
  const error = passphraseError(cleaned);
  if (error) throw new Error(error);
  const rounds = Number.isFinite(iterations) && iterations >= 100_000 ? Math.trunc(iterations) : BACKUP_ITERATIONS;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveBackupKey(cleaned, salt, rounds);
  const sealed = await encryptJson(key, plaintext, BACKUP_AAD);
  const envelope: BackupEnvelope = {
    v: 1,
    kind: BACKUP_KIND,
    alg: "A256GCM",
    kdf: "PBKDF2-SHA256",
    iterations: rounds,
    salt: bytesToB64(salt),
    iv: sealed.iv,
    ciphertext: sealed.ciphertext,
    createdAt: sealed.updatedAt,
  };
  return JSON.stringify(envelope);
}

export async function openBackup(raw: string, passphrase: string): Promise<string> {
  const cleaned = normalizePassphrase(passphrase);
  if (!cleaned) throw new Error("Enter the passphrase for this backup.");
  const short = passphraseError(cleaned);
  if (short) throw new Error(short);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("That file isn’t a Cuidala backup.");
  }
  if (!isBackupEnvelope(parsed)) throw new Error("That file isn’t a Cuidala backup.");
  const key = await deriveBackupKey(cleaned, b64ToBytes(parsed.salt), parsed.iterations);
  try {
    return await decryptJson(
      key,
      {
        v: 2,
        alg: "A256GCM",
        iv: parsed.iv,
        ciphertext: parsed.ciphertext,
        updatedAt: parsed.createdAt,
      },
      BACKUP_AAD,
    );
  } catch {
    throw new Error("Wrong passphrase, or the file is damaged.");
  }
}
