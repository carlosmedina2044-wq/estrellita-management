import { registerPlugin } from "@capacitor/core";

export type DeviceKeyBiometryType = "faceId" | "touchId" | "opticId" | "none";

export type CanEvaluateResult = {
  available: boolean;
  biometryType: DeviceKeyBiometryType;
  deviceIsSecure: boolean;
};

export type CuidalaDeviceKeyPlugin = {
  get(options: { key: string; reason?: string; fallbackTitle?: string }): Promise<{ value: string }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
  /** Non-key owner gates only (cleaner hand-back, disable lock, erase). */
  verifyOwner(options: { reason: string; fallbackTitle?: string }): Promise<void>;
  /** Pre-flight for Settings lock UI — not a security control. */
  canEvaluate(): Promise<CanEvaluateResult>;
};

export const CuidalaDeviceKey = registerPlugin<CuidalaDeviceKeyPlugin>("CuidalaDeviceKey");
