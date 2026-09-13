import { tActive, type MessageKey } from "@/i18n";

export type LockMethod = "faceId" | "touchId" | "passcode" | "none";

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

/** Copy for the lock UI. Internal setting remains `requireFaceId`. */
export function lockMethodLabel(
  method: LockMethod,
  t: Translate = tActive,
): { noun: string; toggle: string; prompt: string } {
  switch (method) {
    case "touchId":
      return {
        noun: t("lockLabels.touchId"),
        toggle: t("lockLabels.requireTouchId"),
        prompt: t("lockLabels.promptTouchId"),
      };
    case "passcode":
      return {
        noun: t("lockLabels.passcodeNoun"),
        toggle: t("lockLabels.requirePasscode"),
        prompt: t("lockLabels.promptPasscode"),
      };
    case "none":
      return {
        noun: t("lockLabels.faceId"),
        toggle: t("lockLabels.requireFaceId"),
        prompt: t("lockLabels.promptFaceId"),
      };
    default:
      return {
        noun: t("lockLabels.faceId"),
        toggle: t("lockLabels.requireFaceId"),
        prompt: t("lockLabels.promptFaceId"),
      };
  }
}
