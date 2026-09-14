import type { MessageKey } from "@/i18n";
import { tActive } from "@/i18n";
import { tDutyTitle } from "@/i18n/content";
import { doneToday, todaysOpenDuties } from "@/lib/duties";
import { closedDayRun, dayArc } from "@/lib/momentum";
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
  dueLabel: string;
  doneLabel: string;
  emptyLabel: string;
  runLength: number;
  dayFraction: number;
  careLabel: string;
  runLabel: string;
};

export function widgetSnapshotFor(household: Household, now = new Date()): WidgetSnapshot {
  const open = todaysOpenDuties(household, now);
  const done = doneToday(household, now);
  const privateMode = household.restockDigest.privateNotifications === true;
  const momentumOn = household.momentum.enabled;
  const runLength = momentumOn ? closedDayRun(household, now).current : 0;
  const dayFraction = momentumOn ? dayArc(household, now).fraction : 0;
  const level = household.momentum.care?.level ?? "settling-in";
  const careLabel = momentumOn ? tActive(`care.level.${level}` as MessageKey) : "";
  const runLabel =
    momentumOn && runLength > 0 ? tActive("widget.run", { count: runLength }) : "";
  return {
    dueCount: open.length,
    doneCount: done.length,
    updatedAt: now.toISOString(),
    titles: privateMode ? [] : open.slice(0, WIDGET_TITLE_LIMIT).map((duty) => tDutyTitle(duty.title)),
    dueLabel: tActive("widget.due", { count: open.length }),
    doneLabel: tActive("widget.done", { count: done.length }),
    emptyLabel: tActive("widget.empty"),
    runLength,
    dayFraction,
    careLabel,
    runLabel,
  };
}
