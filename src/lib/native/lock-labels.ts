export type LockMethod = "faceId" | "touchId" | "passcode" | "none";

/** Copy for the lock UI. Internal setting remains `requireFaceId`. */
export function lockMethodLabel(method: LockMethod): { noun: string; toggle: string; prompt: string } {
  switch (method) {
    case "touchId":
      return {
        noun: "Touch ID",
        toggle: "Require Touch ID",
        prompt: "Use Touch ID or your passcode to open today’s list.",
      };
    case "passcode":
      return {
        noun: "your passcode",
        toggle: "Require passcode to open",
        prompt: "Enter your passcode to open today’s list.",
      };
    case "none":
      return {
        noun: "Face ID",
        toggle: "Require Face ID",
        prompt: "Use Face ID or your passcode to open today’s list.",
      };
    default:
      return {
        noun: "Face ID",
        toggle: "Require Face ID",
        prompt: "Use Face ID or your passcode to open today’s list.",
      };
  }
}
