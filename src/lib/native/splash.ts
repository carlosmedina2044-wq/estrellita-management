import { SplashScreen } from "@capacitor/splash-screen";
import { isNative } from "@/lib/native/platform";

let hidden = false;

/** Hide the native splash after the first household shell render. */
export async function hideLaunchSplash(): Promise<void> {
  if (hidden || !isNative()) return;
  hidden = true;
  try {
    await SplashScreen.hide({ fadeOutDuration: 150 });
  } catch {
    // Web / missing plugin — ignore.
  }
}
