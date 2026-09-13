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
    const { CuidalaDeviceKey } = await import("@/lib/native/cuidala-device-key");
    const result = await CuidalaDeviceKey.canEvaluate();
    if (!result.available && !result.deviceIsSecure) return "none";
    switch (result.biometryType) {
      case "touchId":
        return "touchId";
      case "faceId":
      case "opticId":
        return "faceId";
      default:
        // No biometry enrolled, but passcode can still unlock.
        return result.deviceIsSecure || result.available ? "passcode" : "none";
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
    const { CuidalaDeviceKey } = await import("@/lib/native/cuidala-device-key");
    await CuidalaDeviceKey.verifyOwner({
      reason,
      fallbackTitle: deviceOwnerFallbackTitle(),
    });
    return true;
  } catch {
    return false;
  } finally {
    promptInFlight -= 1;
  }
}
