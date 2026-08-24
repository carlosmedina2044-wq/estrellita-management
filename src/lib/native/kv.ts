import { isNative } from "@/lib/native/platform";

/**
 * Small key/value adapter. On device it uses Capacitor Preferences (backed by
 * UserDefaults, which is not purged under storage pressure the way WKWebView
 * localStorage can be). On the web it uses localStorage.
 */
export async function kvGet(key: string): Promise<string | null> {
  if (isNative()) {
    const { Preferences } = await import("@capacitor/preferences");
    const result = await Preferences.get({ key });
    return result.value ?? null;
  }
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (isNative()) {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value });
    return;
  }
  window.localStorage.setItem(key, value);
}

export async function kvRemove(key: string): Promise<void> {
  if (isNative()) {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.remove({ key });
    return;
  }
  window.localStorage.removeItem(key);
}
