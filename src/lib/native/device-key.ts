import { b64ToBytes, bytesToB64, generateRawKey, importRawKey } from "@/lib/crypto";
import { isNative } from "@/lib/native/platform";

const KEY_ID = "cuidala-device-key-v1";
const LEGACY_KEY_IDS = ["estrellita-device-key-v1"];

/**
 * Returns the device's AES key, creating it on first use.
 *
 * iOS: stored in the Keychain by capacitor-secure-storage-plugin. The item is
 * device-scoped and protected by the device passcode; it is not included in
 * unencrypted backups and does not sync to iCloud Keychain.
 *
 * Web (development only): stored in localStorage. The web build is a dev shell,
 * not a shipping surface, and this is documented in the README.
 */
export async function loadOrCreateDeviceKey(): Promise<CryptoKey> {
  const existing = await readRaw();
  if (existing) return importRawKey(existing);
  const raw = generateRawKey();
  await writeRaw(raw);
  return importRawKey(raw);
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
    } catch {
      return null;
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
