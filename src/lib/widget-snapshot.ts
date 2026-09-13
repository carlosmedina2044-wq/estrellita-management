import { tDutyTitle } from "@/i18n/content";
import { doneToday, todaysOpenDuties } from "@/lib/duties";
import type { Household } from "@/lib/types";

/** Max duty titles written to the lock-screen snapshot. */
export const WIDGET_TITLE_LIMIT = 3;

/**
 * Deliberately plaintext glance for WidgetKit. The vault key never leaves
 * Keychain ThisDeviceOnly + biometry ACL; the extension cannot decrypt.
 */
export type WidgetSnapshot = {
  dueCount: number;
  doneCount: number;
  updatedAt: string;
  titles: string[];
};

export function widgetSnapshotFor(household: Household, now = new Date()): WidgetSnapshot {
  const open = todaysOpenDuties(household, now);
  const done = doneToday(household, now);
  const privateMode = household.restockDigest.privateNotifications === true;
  return {
    dueCount: open.length,
    doneCount: done.length,
    updatedAt: now.toISOString(),
    titles: privateMode ? [] : open.slice(0, WIDGET_TITLE_LIMIT).map((duty) => tDutyTitle(duty.title)),
  };
}
