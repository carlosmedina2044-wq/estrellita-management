import { isNative } from "@/lib/native/platform";

/** Opens a retailer page in SFSafariViewController on device, a new tab on web. */
export async function openExternalUrl(url: string): Promise<boolean> {
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    if (isNative()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url, presentationStyle: "popover" });
      return true;
    }
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    return Boolean(opened);
  } catch {
    return false;
  }
}
