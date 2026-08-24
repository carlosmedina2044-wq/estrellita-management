import { isNativeIos } from "@/lib/native/platform";

const WEB_KEY = "estrellita-keychain-v1";

export async function keychainSet(key: string, value: string): Promise<void> {
  if (isNativeIos()) {
    const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
    await SecureStoragePlugin.set({ key, value });
    return;
  }
  window.sessionStorage.setItem(`${WEB_KEY}:${key}`, value);
}

export async function keychainGet(key: string): Promise<string | null> {
  if (isNativeIos()) {
    try {
      const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
      const result = await SecureStoragePlugin.get({ key });
      return result.value ?? null;
    } catch {
      return null;
    }
  }
  return window.sessionStorage.getItem(`${WEB_KEY}:${key}`) ?? window.localStorage.getItem(`${WEB_KEY}:${key}`);
}

export async function keychainRemove(key: string): Promise<void> {
  if (isNativeIos()) {
    try {
      const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
      await SecureStoragePlugin.remove({ key });
    } catch {
      // already gone
    }
    return;
  }
  window.sessionStorage.removeItem(`${WEB_KEY}:${key}`);
  window.localStorage.removeItem(`${WEB_KEY}:${key}`);
}

export async function persistVaultSecret(secret: string) {
  await keychainSet("vault-secret", secret);
  if (!isNativeIos()) {
    window.localStorage.setItem(`${WEB_KEY}:vault-secret`, secret);
  }
}

export async function readVaultSecret(): Promise<string | null> {
  return keychainGet("vault-secret");
}

export async function persistRefreshToken(token: string) {
  await keychainSet("refresh-token", token);
}

export async function readRefreshToken(): Promise<string | null> {
  return keychainGet("refresh-token");
}
