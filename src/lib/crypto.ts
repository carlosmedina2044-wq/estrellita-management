import { isPlainObject } from "@/lib/sanitize";

export const VAULT_STORAGE_KEY = "estrellita-vault-v1";
export const PBKDF2_ITERATIONS = 310_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type VaultEnvelope = {
  v: 1;
  alg: "A256GCM";
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  vaultId: string;
  updatedAt: string;
};

export type VaultSession = {
  vaultId: string;
  salt: Uint8Array;
  encKey: CryptoKey;
  authToken: string;
};

export function isVaultId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function isVaultEnvelope(value: unknown): value is VaultEnvelope {
  if (!isPlainObject(value)) return false;
  return (
    value.v === 1 &&
    value.alg === "A256GCM" &&
    value.kdf === "PBKDF2-SHA256" &&
    typeof value.iterations === "number" &&
    value.iterations >= 100_000 &&
    value.iterations <= 600_000 &&
    typeof value.salt === "string" &&
    typeof value.iv === "string" &&
    typeof value.ciphertext === "string" &&
    typeof value.vaultId === "string" &&
    isVaultId(value.vaultId) &&
    typeof value.updatedAt === "string" &&
    value.salt.length > 8 &&
    value.iv.length > 8 &&
    value.ciphertext.length > 8 &&
    value.ciphertext.length < 900_000
  );
}

function asBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pbkdf2Bits(secret: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: asBufferSource(salt), iterations },
    baseKey,
    256,
  );
  return new Uint8Array(bits);
}

async function hkdfBits(ikm: Uint8Array, info: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", asBufferSource(ikm), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: encoder.encode(info) },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function createVaultSession(
  secret: string,
  options?: { vaultId?: string; salt?: Uint8Array; iterations?: number },
): Promise<VaultSession> {
  const salt = options?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const iterations = options?.iterations ?? PBKDF2_ITERATIONS;
  const ikm = await pbkdf2Bits(secret, salt, iterations);
  const encRaw = await hkdfBits(ikm, "estrellita-enc-v1");
  const authRaw = await hkdfBits(ikm, "estrellita-auth-v1");
  const encKey = await crypto.subtle.importKey("raw", asBufferSource(encRaw), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
  return {
    vaultId: options?.vaultId ?? crypto.randomUUID(),
    salt,
    encKey,
    authToken: bytesToB64(authRaw),
  };
}

export async function encryptHousehold(
  session: VaultSession,
  plaintext: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<VaultEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(session.vaultId) },
    session.encKey,
    encoder.encode(plaintext),
  );
  return {
    v: 1,
    alg: "A256GCM",
    kdf: "PBKDF2-SHA256",
    iterations,
    salt: bytesToB64(session.salt),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(sealed)),
    vaultId: session.vaultId,
    updatedAt: new Date().toISOString(),
  };
}

export async function decryptEnvelope(session: VaultSession, envelope: VaultEnvelope): Promise<string> {
  const iv = b64ToBytes(envelope.iv);
  const data = b64ToBytes(envelope.ciphertext);
  const opened = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asBufferSource(iv), additionalData: encoder.encode(envelope.vaultId) },
    session.encKey,
    asBufferSource(data),
  );
  return decoder.decode(opened);
}

export async function sessionFromEnvelope(secret: string, envelope: VaultEnvelope): Promise<VaultSession> {
  return createVaultSession(secret, {
    vaultId: envelope.vaultId,
    salt: b64ToBytes(envelope.salt),
    iterations: envelope.iterations,
  });
}

export function parseEnvelopeJson(raw: string): VaultEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isVaultEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
