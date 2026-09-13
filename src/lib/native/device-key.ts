import { b64ToBytes, bytesToB64, generateRawKey, importRawKey } from "@/lib/crypto";
import { isNative } from "@/lib/native/platform";

/** Bound Keychain account (SecAccessControl biometryCurrentSet OR devicePasscode). */
export const KEY_ID = "cuidala-device-key-v2";
/** Unbound v1 + pre-release leftovers — migrated once into v2 then deleted. */
export const LEGACY_KEY_IDS = ["cuidala-device-key-v1", "estrellita-device-key-v1"] as const;

/**
 * iOS: stored in the Keychain by CuidalaDeviceKeyPlugin.
 * v2 uses SecAccessControl (WhenPasscodeSetThisDeviceOnly + biometryCurrentSet OR devicePasscode).
 * Authenticated `get` prompts Face ID / passcode; the key does not migrate via Quick Start.
 * Portable backup password is the cross-device path. See docs/RESIDUAL_RISKS.md.
 *
 * Web (development only): stored in localStorage. The web build is a dev shell.
 */
export class DeviceKeyError extends Error {
  readonly code?: string;

  constructor(message: string, options?: { cause?: unknown; code?: string }) {
    super(message);
    this.name = "DeviceKeyError";
    this.code = options?.code;
    if (options?.cause !== undefined) (this as Error & { cause?: unknown }).cause = options.cause;
  }
}

function pluginCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  return code;
}

function pluginMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

/** Plugin rejection when the Keychain item is genuinely absent. */
export function isMissingKeychainItemError(error: unknown): boolean {
  const code = pluginCode(error);
  if (code === "not_found") return true;
  return /item with given key does not exist/i.test(pluginMessage(error));
}

/** User dismissed the system Face ID / passcode sheet. Must not be treated as missing. */
export function isUserCanceledKeyError(error: unknown): boolean {
  if (error instanceof DeviceKeyError && error.code === "user_canceled") return true;
  const code = pluginCode(error);
  if (code === "user_canceled") return true;
  return /user canceled|cancelled authentication|errSecUserCanceled|-128/i.test(pluginMessage(error));
}

export function isAuthFailedKeyError(error: unknown): boolean {
  if (error instanceof DeviceKeyError && error.code === "auth_failed") return true;
  const code = pluginCode(error);
  if (code === "auth_failed") return true;
  return /authentication failed|errSecAuthFailed|-25293/i.test(pluginMessage(error));
}

export function isInteractionNotAllowedKeyError(error: unknown): boolean {
  if (error instanceof DeviceKeyError && error.code === "interaction_not_allowed") return true;
  const code = pluginCode(error);
  if (code === "interaction_not_allowed") return true;
  return /interaction is not allowed|errSecInteractionNotAllowed|-25308/i.test(pluginMessage(error));
}

/** True when Keychain reads require an interactive ACL prompt (native iOS). */
export function deviceKeyRequiresInteractiveUnlock(): boolean {
  return isNative();
}

export type LoadDeviceKeyOptions = {
  /** Localized reason shown on the system Face ID / passcode sheet. */
  reason?: string;
};

/** Read the existing AES key. Null only when the item is absent. Other errors throw. */
export async function loadDeviceKey(options?: LoadDeviceKeyOptions): Promise<CryptoKey | null> {
  const existing = await readRaw(options?.reason ?? "Unlock Cuidala");
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
export async function loadOrCreateDeviceKey(options?: LoadDeviceKeyOptions): Promise<CryptoKey> {
  const existing = await loadDeviceKey(options);
  if (existing) return existing;
  return createDeviceKey();
}

export async function deleteDeviceKey(): Promise<void> {
  for (const id of [KEY_ID, ...LEGACY_KEY_IDS]) {
    await removeRaw(id);
  }
}

async function readRaw(reason: string): Promise<Uint8Array | null> {
  const current = await readId(KEY_ID, reason);
  if (current) return current;
  // Web / tests: migrate unbound legacy ids into v2 storage.
  for (const id of LEGACY_KEY_IDS) {
    const legacy = await readId(id, reason);
    if (!legacy) continue;
    await writeRaw(legacy);
    await removeRaw(id);
    return legacy;
  }
  return null;
}

async function readId(id: string, reason: string): Promise<Uint8Array | null> {
  if (isNative()) {
    const { CuidalaDeviceKey } = await import("@/lib/native/cuidala-device-key");
    try {
      const result = await CuidalaDeviceKey.get({ key: id, reason });
      return result.value ? b64ToBytes(result.value) : null;
    } catch (error) {
      if (isMissingKeychainItemError(error)) return null;
      if (isUserCanceledKeyError(error)) {
        throw new DeviceKeyError("User canceled authentication", { cause: error, code: "user_canceled" });
      }
      if (isAuthFailedKeyError(error)) {
        throw new DeviceKeyError("Authentication failed", { cause: error, code: "auth_failed" });
      }
      if (isInteractionNotAllowedKeyError(error)) {
        throw new DeviceKeyError("User interaction is not allowed", {
          cause: error,
          code: "interaction_not_allowed",
        });
      }
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
    const { CuidalaDeviceKey } = await import("@/lib/native/cuidala-device-key");
    try {
      await CuidalaDeviceKey.set({ key: KEY_ID, value: encoded });
    } catch (error) {
      throw new DeviceKeyError("Could not write the device key", { cause: error });
    }
    return;
  }
  window.localStorage.setItem(KEY_ID, encoded);
}

async function removeRaw(id: string): Promise<void> {
  if (isNative()) {
    const { CuidalaDeviceKey } = await import("@/lib/native/cuidala-device-key");
    try {
      await CuidalaDeviceKey.remove({ key: id });
    } catch {
      // already gone
    }
    return;
  }
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(id);
}
