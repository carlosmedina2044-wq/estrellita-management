import { isNative } from "@/lib/native/platform";

export async function biometricsAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    const result = await NativeBiometric.isAvailable({ useFallback: true });
    return result.isAvailable;
  } catch {
    return false;
  }
}

/**
 * Prompts Face ID / Touch ID (falling back to the device passcode).
 * Resolves true only when the system confirms the user; any error or
 * cancellation resolves false. Callers must treat false as "stay locked".
 */
export async function verifyDeviceOwner(reason = "Unlock Cuidala"): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    await NativeBiometric.verifyIdentity({
      reason,
      title: "Cuidala",
      subtitle: reason,
      useFallback: true,
    });
    return true;
  } catch {
    return false;
  }
}
