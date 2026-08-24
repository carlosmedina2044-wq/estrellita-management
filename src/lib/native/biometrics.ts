import { isNativeIos } from "@/lib/native/platform";

export async function nativeBiometricsAvailable(): Promise<boolean> {
  if (!isNativeIos()) return false;
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch {
    return false;
  }
}

export async function evaluateDeviceOwner(): Promise<boolean> {
  if (!isNativeIos()) return false;
  const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
  await NativeBiometric.verifyIdentity({
    reason: "Unlock Estrellita",
    title: "Face ID",
    subtitle: "Confirm it’s you to open your home.",
    useFallback: true,
  });
  return true;
}
