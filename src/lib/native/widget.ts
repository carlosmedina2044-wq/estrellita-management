import { registerPlugin } from "@capacitor/core";
import { isNative } from "@/lib/native/platform";
import type { Household } from "@/lib/types";
import { widgetSnapshotFor, type WidgetSnapshot } from "@/lib/widget-snapshot";

export type NativeWidget = {
  updateSnapshot(options: WidgetSnapshot): Promise<void>;
  clearSnapshot(): Promise<void>;
  startPowerHour(options: {
    title: string;
    total: number;
    left: number;
    nextTitle?: string;
    endsAtMs: number;
  }): Promise<{ started: boolean; reason?: "disabled" | "unsupported" | "failed" }>;
  updatePowerHour(options: { left: number; nextTitle?: string; endsAtMs?: number }): Promise<void>;
  endPowerHour(options: { finished: boolean }): Promise<void>;
};

/** One registration of the plugin, shared with `power-hour.ts`. */
export const cuidalaWidgetPlugin = registerPlugin<NativeWidget>("CuidalaWidget");

/** Writes today's due/done glance to the App Group. No-op off native. Never sends the vault key. */
export async function syncWidgetSnapshot(household: Household, now = new Date()): Promise<void> {
  if (!isNative()) return;
  try {
    await cuidalaWidgetPlugin.updateSnapshot(widgetSnapshotFor(household, now));
  } catch {
    // Missing App Group or unsigned build must never break persist.
  }
}

/** Removes the glance after erase-all. No-op off native. */
export async function clearWidgetSnapshot(): Promise<void> {
  if (!isNative()) return;
  try {
    await cuidalaWidgetPlugin.clearSnapshot();
  } catch {
    // Same as sync — wipe must still succeed if the extension is not installed yet.
  }
}
