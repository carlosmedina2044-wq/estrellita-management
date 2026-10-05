import { isNativeIos } from "@/lib/native/platform";

export type PowerHourStart = {
  title: string;
  total: number;
  left: number;
  nextTitle?: string;
  endsAtMs: number;
};

export type PowerHourStartResult =
  | { ok: true }
  | { ok: false; reason: "disabled" | "unsupported" | "unavailable" | "failed" };

/** The slice of the CuidalaWidget plugin this wrapper uses. */
export type PowerHourPlugin = {
  startPowerHour(options: PowerHourStart): Promise<{ started: boolean; reason?: string }>;
  updatePowerHour(options: { left: number; nextTitle?: string; endsAtMs?: number }): Promise<void>;
  endPowerHour(options: { finished: boolean }): Promise<void>;
};

let testPlugin: PowerHourPlugin | null = null;

/** Test hook: stand in for the native plugin. Pass null to restore. */
export function installPowerHourPluginForTests(plugin: PowerHourPlugin | null): void {
  testPlugin = plugin;
}

async function loadPlugin(): Promise<PowerHourPlugin | null> {
  if (testPlugin) return testPlugin;
  if (!isNativeIos()) return null;
  const { cuidalaWidgetPlugin } = await import("@/lib/native/widget");
  return cuidalaWidgetPlugin;
}

/**
 * Starts the Lock Screen / Dynamic Island timer. Never throws. Off iOS it is
 * "unavailable"; with Live Activities switched off in Settings it is "disabled".
 */
export async function startPowerHourActivity(input: PowerHourStart): Promise<PowerHourStartResult> {
  try {
    const plugin = await loadPlugin();
    if (!plugin) return { ok: false, reason: "unavailable" };
    const result = await plugin.startPowerHour(input);
    if (result?.started === true) return { ok: true };
    const reason = result?.reason;
    return { ok: false, reason: reason === "disabled" || reason === "unsupported" ? reason : "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Pushes the new count (and optionally a new end time) to the Live Activity. Never throws. */
export async function updatePowerHourActivity(input: {
  left: number;
  nextTitle?: string;
  endsAtMs?: number;
}): Promise<void> {
  try {
    const plugin = await loadPlugin();
    await plugin?.updatePowerHour(input);
  } catch {
    // A missing activity must never disturb the session.
  }
}

/** Finished keeps "All done" on the Lock Screen for five minutes; otherwise it goes at once. Never throws. */
export async function endPowerHourActivity(finished: boolean): Promise<void> {
  try {
    const plugin = await loadPlugin();
    await plugin?.endPowerHour({ finished });
  } catch {
    // Same as update.
  }
}
