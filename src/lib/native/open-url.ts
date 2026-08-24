import { isNativeIos } from "@/lib/native/platform";

export async function openExternalUrl(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) return true;
    if (isNativeIos()) {
      window.location.assign(url);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
