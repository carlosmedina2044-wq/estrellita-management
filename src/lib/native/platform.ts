import { Capacitor } from "@capacitor/core";

export function isNativeIos(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}
