import { b64ToBytes, bytesToB64, generateRawKey, importRawKey } from "@/lib/crypto";
import { isNative } from "@/lib/native/platform";

const KEY_ID = "cuidala-device-key-v1";
const LEGACY_KEY_IDS = ["estrellita-device-key-v1"];

/**
 * iOS: stored in the Keychain by capacitor-secure-storage-plugin.
 * Accessibility is kSecAttrAccessibleAfterFirstUnlock (not ThisDeviceOnly).
 * The item migrates through encrypted iCloud/Finder backups and Quick Start.
 * Face ID is an app-lock UI gate, not a cryptographic unlock of this key.
 * See docs/RESIDUAL_RISKS.md.
 *
 * Web (development only): stored in localStorage. The web build is a dev shell.
 */
export class DeviceKeyError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "DeviceKeyError";
    if (options?.cause !== undefined) (this as Error & { cause?: unknown }).cause = options.cause;
  }
}

/** Plugin rejection when the Keychain item is genuinely absent. */
export function isMissingKeychainItemError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /item with given key does not exist/i.test(message);
}

/** Read the existing AES key. Null only when the item is absent. Other errors throw. */
export async function loadDeviceKey(): Promise<CryptoKey | null> {
  const existing = await readRaw();
  if (existing) return importRawKey(existing);
  return null;
}

/** Generate and persist a new AES key. Call only when no vault exists. */
export async function createDeviceKey(): Promise<CryptoKey> {
  const raw = generateRawKey();
  await writeRaw(raw);
  return importRawKey(raw);
}

/**
 * Returns the device's AES key, creating it on first use.
 * Hydration must not call this while a vault already exists.
 */
export async function loadOrCreateDeviceKey(): Promise<CryptoKey> {
  const existing = await loadDeviceKey();
  if (existing) return existing;
  return createDeviceKey();
}

export async function deleteDeviceKey(): Promise<void> {
  for (const id of [KEY_ID, ...LEGACY_KEY_IDS]) {
    await removeRaw(id);
  }
}

async function readRaw(): Promise<Uint8Array | null> {
  const current = await readId(KEY_ID);
  if (current) return current;
  for (const id of LEGACY_KEY_IDS) {
    const legacy = await readId(id);
    if (!legacy) continue;
    await writeRaw(legacy);
    await removeRaw(id);
    return legacy;
  }
  return null;
}

async function readId(id: string): Promise<Uint8Array | null> {
  if (isNative()) {
    const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
    try {
      const result = await SecureStoragePlugin.get({ key: id });
      return result.value ? b64ToBytes(result.value) : null;
    } catch (error) {
      if (isMissingKeychainItemError(error)) return null;
      throw new DeviceKeyError("Could not read the device key", { cause: error });
    }
  }
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(id);
  return raw ? b64ToBytes(raw) : null;
}

async function writeRaw(raw: Uint8Array): Promise<void> {
  const encoded = bytesToB64(raw);
  if (isNative()) {
    const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
    await SecureStoragePlugin.set({ key: KEY_ID, value: encoded });
    return;
  }
  window.localStorage.setItem(KEY_ID, encoded);
}

async function removeRaw(id: string): Promise<void> {
  if (isNative()) {
    const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
    try {
      await SecureStoragePlugin.remove({ key: id });
    } catch {
      // already gone
    }
    return;
  }
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(id);
}
