export function isNativeIos(): boolean {
  if (typeof window === "undefined") return false;
  const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } })
    .Capacitor;
  return Boolean(capacitor?.isNativePlatform?.() && capacitor.getPlatform?.() === "ios");
}

export function isCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
}
