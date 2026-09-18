import { kvGet, kvSet } from "@/lib/native/kv";

/**
 * The tilt parallax on Today needs `deviceorientation` events. On iOS 13 and
 * later WebKit delivers none of them until `DeviceOrientationEvent
 * .requestPermission()` has been called from a real user gesture and allowed —
 * which nothing in this app ever did, so the parallax was written, wired and
 * silent on every phone it shipped to.
 *
 * The answer is remembered so the system prompt is asked for exactly once.
 * There is nothing to undo here: declining simply leaves the house still.
 */
const KEY = "cuidala.motionTilt";

type Gate = { requestPermission: () => Promise<"granted" | "denied" | "prompt"> };

function gate(): Gate | null {
  if (typeof window === "undefined") return null;
  const ctor = window.DeviceOrientationEvent as unknown as Gate | undefined;
  if (!ctor || typeof ctor.requestPermission !== "function") return null;
  return ctor;
}

/** True where the permission gate exists at all (iOS Safari and WKWebView). */
export function tiltNeedsPermission(): boolean {
  return gate() !== null;
}

export async function tiltDecision(): Promise<"granted" | "denied" | null> {
  const stored = await kvGet(KEY);
  return stored === "granted" || stored === "denied" ? stored : null;
}

/**
 * Asks once, from whatever gesture called this, and remembers the answer.
 * Returns the decision. Platforms with no gate (Android, the browser, older
 * iOS) report `granted` without prompting, because there they simply deliver
 * the events.
 */
export async function requestTilt(): Promise<"granted" | "denied"> {
  const existing = await tiltDecision();
  if (existing) return existing;
  const ctor = gate();
  if (!ctor) {
    await kvSet(KEY, "granted");
    return "granted";
  }
  try {
    const result = await ctor.requestPermission();
    const decision = result === "granted" ? "granted" : "denied";
    await kvSet(KEY, decision);
    return decision;
  } catch {
    // A rejection here means the call did not come from a user gesture, or
    // the prompt was dismissed. Not remembered, so the next tap can ask again.
    return "denied";
  }
}
