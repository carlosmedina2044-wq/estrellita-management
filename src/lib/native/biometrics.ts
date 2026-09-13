import { tActive } from "@/i18n";
import { isNative } from "@/lib/native/platform";
import { lockMethodLabel, type LockMethod } from "@/lib/native/lock-labels";

export type { LockMethod };
export { lockMethodLabel };

/** Shown on Apple’s Face ID / Touch ID sheet. Empty string hides the button. */
export function deviceOwnerFallbackTitle(): string {
  return tActive("biometrics.enterPasscode");
}

/** English fallback for tests / static checks; prefer deviceOwnerFallbackTitle() at runtime. */
export const DEVICE_OWNER_FALLBACK_TITLE = "Enter Passcode";

/** Capacitor rejects missing native methods with this code. */
export function isUnimplementedPluginError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (code === "UNIMPLEMENTED") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /unimplemented|not implemented/i.test(message);
}

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

let promptInFlight = 0;

export function isOwnerPromptInFlight() {
  return promptInFlight > 0;
}

/**
 * Prompts Face ID / Touch ID (falling back to the device passcode).
 * Resolves true only when the system confirms the user; any error or
 * cancellation resolves false. Callers must treat false as "stay locked".
 */
export async function verifyDeviceOwner(reason = tActive("biometrics.unlockCuidala")): Promise<boolean> {
  if (!isNative()) return false;
  promptInFlight += 1;
  try {
    try {
      const { CuidalaDeviceKey } = await import("@/lib/native/cuidala-device-key");
      await CuidalaDeviceKey.verifyOwner({
        reason,
        fallbackTitle: deviceOwnerFallbackTitle(),
      });
      return true;
    } catch (error) {
      // Capgo’s verifyIdentity sets localizedFallbackTitle = "" first, which hides
      // Enter Passcode. Only use it when this binary has no verifyOwner yet.
      if (!isUnimplementedPluginError(error)) return false;
    }
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    await NativeBiometric.verifyIdentity({
      reason,
      title: "Cuidala",
      subtitle: reason,
      useFallback: true,
      fallbackTitle: deviceOwnerFallbackTitle(),
    });
    return true;
  } catch {
    return false;
  } finally {
    promptInFlight -= 1;
  }
}
