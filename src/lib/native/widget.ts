import { registerPlugin } from "@capacitor/core";
import { isNative } from "@/lib/native/platform";
import type { Household } from "@/lib/types";
import { widgetSnapshotFor, type WidgetSnapshot } from "@/lib/widget-snapshot";

type NativeWidget = {
  updateSnapshot(options: WidgetSnapshot): Promise<void>;
  clearSnapshot(): Promise<void>;
};

const plugin = registerPlugin<NativeWidget>("CuidalaWidget");

/** Writes today's due/done glance to the App Group. No-op off native. Never sends the vault key. */
export async function syncWidgetSnapshot(household: Household, now = new Date()): Promise<void> {
  if (!isNative()) return;
  try {
    await plugin.updateSnapshot(widgetSnapshotFor(household, now));
  } catch {
    // Missing App Group or unsigned build must never break persist.
  }
}

/** Removes the glance after erase-all. No-op off native. */
export async function clearWidgetSnapshot(): Promise<void> {
  if (!isNative()) return;
  try {
    await plugin.clearSnapshot();
  } catch {
    // Same as sync — wipe must still succeed if the extension is not installed yet.
  }
}
