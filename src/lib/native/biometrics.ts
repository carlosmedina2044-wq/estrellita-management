import { isNative } from "@/lib/native/platform";
import { lockMethodLabel, type LockMethod } from "@/lib/native/lock-labels";

export type { LockMethod };
export { lockMethodLabel };

export async function detectLockMethod(): Promise<LockMethod> {
  if (!isNative()) return "none";
  try {
    const { BiometryType, NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    const result = await NativeBiometric.isAvailable({ useFallback: true });
    if (!result.isAvailable) return "none";
    switch (result.biometryType) {
      case BiometryType.TOUCH_ID:
      case BiometryType.FINGERPRINT:
        return "touchId";
      case BiometryType.FACE_ID:
      case BiometryType.FACE_AUTHENTICATION:
      case BiometryType.IRIS_AUTHENTICATION:
      case BiometryType.MULTIPLE:
        return "faceId";
      default:
        // NONE or DEVICE_CREDENTIAL: lock is available via passcode only.
        return "passcode";
    }
  } catch {
    return "none";
  }
}

export async function biometricsAvailable(): Promise<boolean> {
  return (await detectLockMethod()) !== "none";
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
