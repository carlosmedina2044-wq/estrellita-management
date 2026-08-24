const PASSKEY_STORAGE_KEY = "estrellita-passkey-v1";
const PASSKEY_WRAP_KEY = "estrellita-passkey-wrap-v1";

export type PasskeyRecord = {
  v: 1;
  credentialId: string;
  vaultId: string;
  wrappedSecret: string;
  iv: string;
  prf: boolean;
};

function bytesToB64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function asBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function isPasskeyRecord(value: unknown): value is PasskeyRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.v === 1 &&
    typeof record.credentialId === "string" &&
    typeof record.vaultId === "string" &&
    typeof record.wrappedSecret === "string" &&
    typeof record.iv === "string" &&
    typeof record.prf === "boolean"
  );
}

function readRecord(): PasskeyRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PASSKEY_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPasskeyRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeRecord(record: PasskeyRecord) {
  window.localStorage.setItem(PASSKEY_STORAGE_KEY, JSON.stringify(record));
}

function readLocalWrapKey(): Uint8Array | null {
  const raw = window.localStorage.getItem(PASSKEY_WRAP_KEY);
  if (!raw) return null;
  try {
    return b64urlToBytes(raw);
  } catch {
    return null;
  }
}

function writeLocalWrapKey(bytes: Uint8Array) {
  window.localStorage.setItem(PASSKEY_WRAP_KEY, bytesToB64url(bytes));
}

function blurActiveElement() {
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

function rpId(): string {
  return window.location.hostname;
}

function randomChallenge(): ArrayBuffer {
  return asBufferSource(crypto.getRandomValues(new Uint8Array(32)));
}

function userIdFromVault(vaultId: string): ArrayBuffer {
  const raw = new TextEncoder().encode(`estrellita:${vaultId}`);
  if (raw.byteLength < 16) {
    const padded = new Uint8Array(16);
    padded.set(raw);
    return asBufferSource(padded);
  }
  return asBufferSource(raw);
}

async function importWrapKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", asBufferSource(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function wrapSecret(secret: string, wrapKey: Uint8Array): Promise<{ iv: string; wrappedSecret: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importWrapKey(wrapKey);
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(secret),
  );
  return {
    iv: bytesToB64url(iv),
    wrappedSecret: bytesToB64url(new Uint8Array(sealed)),
  };
}

async function unwrapSecret(record: PasskeyRecord, wrapKey: Uint8Array): Promise<string> {
  const key = await importWrapKey(wrapKey);
  const opened = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asBufferSource(b64urlToBytes(record.iv)) },
    key,
    asBufferSource(b64urlToBytes(record.wrappedSecret)),
  );
  return new TextDecoder().decode(opened);
}

function creationOptions(vaultId: string): PublicKeyCredentialCreationOptions {
  return {
    rp: { id: rpId(), name: "Estrellita" },
    user: {
      id: userIdFromVault(vaultId),
      name: "household",
      displayName: "Estrellita household",
    },
    challenge: randomChallenge(),
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },
      { type: "public-key", alg: -257 },
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "required",
    },
    attestation: "none",
    timeout: 120_000,
  };
}

function requestOptions(credentialId: string): PublicKeyCredentialRequestOptions {
  return {
    challenge: randomChallenge(),
    rpId: rpId(),
    allowCredentials: [
      {
        type: "public-key",
        id: asBufferSource(b64urlToBytes(credentialId)),
      },
    ],
    userVerification: "required",
    timeout: 120_000,
  };
}

export function passkeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof window.PublicKeyCredential === "function" &&
    typeof navigator.credentials?.create === "function" &&
    typeof navigator.credentials?.get === "function"
  );
}

export function describePasskeyEnvironment(): { ready: boolean; message: string | null } {
  if (typeof window === "undefined") {
    return { ready: false, message: "Passkeys are only available in the browser." };
  }
  if (!window.isSecureContext) {
    return {
      ready: false,
      message: "Passkeys need Safari over HTTPS. Open https://estrellita-management.vercel.app.",
    };
  }
  if (typeof window.PublicKeyCredential !== "function" || typeof navigator.credentials?.create !== "function") {
    return {
      ready: false,
      message:
        "This browser cannot create a passkey. Use Safari on iPhone (not Chrome or Instagram), with Face ID or Touch ID enrolled.",
    };
  }
  return { ready: true, message: null };
}

export async function platformPasskeyAvailable(): Promise<boolean> {
  if (!passkeySupported()) return false;
  if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
    return true;
  }
  try {
    return await Promise.race([
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
      new Promise<boolean>((resolve) => {
        window.setTimeout(() => resolve(true), 800);
      }),
    ]);
  } catch {
    return true;
  }
}

export function hasStoredPasskey(vaultId?: string | null): boolean {
  const record = readRecord();
  if (!record) return false;
  if (vaultId && record.vaultId !== vaultId) return false;
  return true;
}

export function clearPasskey() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PASSKEY_STORAGE_KEY);
  window.localStorage.removeItem(PASSKEY_WRAP_KEY);
}

export function isUserCancelError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError");
}

export function formatPasskeyError(error: unknown, startedAt = 0): string {
  if (error instanceof DOMException) {
    const quick = startedAt > 0 && Date.now() - startedAt < 600;
    switch (error.name) {
      case "NotAllowedError":
        return quick
          ? "Face ID didn’t appear. Tap the button again in Safari, with Face ID enrolled."
          : "Face ID was cancelled. Tap again, or unlock with your PIN.";
      case "AbortError":
        return "Face ID was cancelled. Tap again, or unlock with your PIN.";
      case "InvalidStateError":
        return "A passkey for this site already exists. In Settings → Passwords, remove the Estrellita passkey, then try again.";
      case "NotSupportedError":
        return "This iPhone couldn’t create that passkey. Use Safari (not Chrome) with Face ID or Touch ID enrolled.";
      case "SecurityError":
        return "This page’s address doesn’t match the passkey site. Open https://estrellita-management.vercel.app in Safari.";
      case "ConstraintError":
        return "This iPhone’s authenticator rejected the passkey options. Use Safari with Face ID enrolled.";
      default:
        return error.message
          ? `Passkey failed (${error.name}: ${error.message}). Use your PIN.`
          : `Passkey failed (${error.name}). Use your PIN.`;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return "Could not use Face ID. Try again, or unlock with your PIN.";
}

/**
 * Starts `navigator.credentials.create()` in the same tick as the user tap.
 * iPhone Safari drops user activation after any `await` (PIN hashing, UVPAA).
 */
export function beginPasskeyRegistration(vaultId: string): Promise<PublicKeyCredential | null> {
  if (!passkeySupported()) {
    throw new DOMException("Passkeys are not available in this browser", "NotSupportedError");
  }
  blurActiveElement();
  return navigator.credentials.create({
    publicKey: creationOptions(vaultId),
  }) as Promise<PublicKeyCredential | null>;
}

export async function finishPasskeyRegistration(
  credential: PublicKeyCredential | null,
  secret: string,
  vaultId: string,
): Promise<void> {
  if (!credential) {
    throw new DOMException("The authenticator returned no passkey", "NotReadableError");
  }
  if (secret.trim().length < 4) {
    throw new Error("Enter your owner PIN to wrap the vault key.");
  }

  const wrapKey = crypto.getRandomValues(new Uint8Array(32));
  writeLocalWrapKey(wrapKey);
  const wrapped = await wrapSecret(secret, wrapKey);
  writeRecord({
    v: 1,
    credentialId: bytesToB64url(new Uint8Array(credential.rawId)),
    vaultId,
    wrappedSecret: wrapped.wrappedSecret,
    iv: wrapped.iv,
    prf: false,
  });
}

export async function registerPasskey(secret: string, vaultId: string): Promise<boolean> {
  if (!passkeySupported() || secret.trim().length < 4) return false;
  const credential = await beginPasskeyRegistration(vaultId);
  await finishPasskeyRegistration(credential, secret, vaultId);
  return true;
}

export async function unlockSecretWithPasskey(): Promise<string> {
  const record = readRecord();
  if (!record) {
    throw new Error("No Face ID passkey is saved on this phone. Add one in Settings.");
  }
  if (!passkeySupported()) {
    throw new DOMException("Passkeys are not available in this browser", "NotSupportedError");
  }

  blurActiveElement();
  const assertion = (await navigator.credentials.get({
    publicKey: requestOptions(record.credentialId),
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new DOMException("The authenticator returned no assertion", "NotReadableError");
  }

  const wrapKey = readLocalWrapKey();
  if (!wrapKey) {
    throw new Error("Face ID worked, but the wrap key is missing on this phone. Add Face ID again in Settings, or use your PIN.");
  }
  try {
    return await unwrapSecret(record, wrapKey);
  } catch {
    throw new Error("Face ID worked, but this phone could not unwrap the vault key. Use your PIN, then add Face ID again in Settings.");
  }
}
