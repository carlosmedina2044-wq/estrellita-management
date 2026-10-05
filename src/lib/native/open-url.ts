import { isNative } from "@/lib/native/platform";

/** Opens a retailer page in SFSafariViewController on device, a new tab on web. */
export async function openExternalUrl(url: string): Promise<boolean> {
  if (!/^https?:\/\//i.test(url)) return false;
  const secure = url.replace(/^http:\/\//i, "https://");
  try {
    if (isNative()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: secure, presentationStyle: "popover" });
      return true;
    }
    const opened = window.open(secure, "_blank", "noopener,noreferrer");
    return Boolean(opened);
  } catch {
    return false;
  }
}

/**
 * Opens this app's own page in the iPhone's Settings app. The same route the lock
 * screen uses: a custom scheme only opens through a top-level navigation. Apple
 * does not allow linking to any deeper pane, so callers spell out the steps.
 */
export function openAppSettings(): boolean {
  if (!isNative()) return false;
  window.location.href = "app-settings:";
  return true;
}
