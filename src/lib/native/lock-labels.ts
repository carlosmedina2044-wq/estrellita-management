import { tActive } from "@/i18n";

export type LockMethod = "faceId" | "touchId" | "passcode" | "none";

/** Copy for the lock UI. Internal setting remains `requireFaceId`. */
export function lockMethodLabel(method: LockMethod): { noun: string; toggle: string; prompt: string } {
  switch (method) {
    case "touchId":
      return {
        noun: tActive("lockLabels.touchId"),
        toggle: tActive("lockLabels.requireTouchId"),
        prompt: tActive("lockLabels.promptTouchId"),
      };
    case "passcode":
      return {
        noun: tActive("lockLabels.passcodeNoun"),
        toggle: tActive("lockLabels.requirePasscode"),
        prompt: tActive("lockLabels.promptPasscode"),
      };
    case "none":
      return {
        noun: tActive("lockLabels.faceId"),
        toggle: tActive("lockLabels.requireFaceId"),
        prompt: tActive("lockLabels.promptFaceId"),
      };
    default:
      return {
        noun: tActive("lockLabels.faceId"),
        toggle: tActive("lockLabels.requireFaceId"),
        prompt: tActive("lockLabels.promptFaceId"),
      };
  }
}
