import { tActive } from "@/i18n";
import { addDays } from "@/lib/dates";
import { todaysOpenDuties } from "@/lib/duties";
import { closedDayRun, todayEffort } from "@/lib/momentum";
import type { EveningNudgeSettings, Household } from "@/lib/types";

export const DEFAULT_EVENING_NUDGE: EveningNudgeSettings = { enabled: false, hour: 19 };
export const NUDGE_ID_BASE = 3000;
export const NUDGE_DAYS = 7;
/** Only when the day is nearly closed: one or two things left. */
export const NUDGE_MAX_OPEN = 2;
/** Only when there is a run worth keeping. */
export const NUDGE_MIN_RUN = 3;

export function eveningNudgeSettings(household: Pick<Household, "eveningNudge">): EveningNudgeSettings {
  return { ...DEFAULT_EVENING_NUDGE, ...household.eveningNudge };
}

export type EveningNudgeNotification = {
  id: number;
  title: string;
  body: string;
  schedule: { at: Date };
  extra: { tab: "today" };
};

/**
 * One gentle evening note, only when a chore or two would close the day and
 * a run of three or more is at stake. Planned for the next seven days from
 * what is scheduled; re-planned on every persist, so a day that gets closed
 * early loses its nudge. The grace day already makes a miss forgivable, so
 * this never has to shame anyone.
 */
export function eveningNudgeNotifications(household: Household, now = new Date()): EveningNudgeNotification[] {
  const settings = eveningNudgeSettings(household);
  if (!settings.enabled) return [];
  const run = closedDayRun(household, now).current;
  if (run < NUDGE_MIN_RUN) return [];
  const privateMode = household.restockDigest.privateNotifications === true;
  const out: EveningNudgeNotification[] = [];
  for (let offset = 0; offset < NUDGE_DAYS; offset += 1) {
    const day = addDays(now, offset);
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), settings.hour, 0, 0);
    if (at.getTime() <= now.getTime()) continue;
    const open = todaysOpenDuties(household, day);
    if (open.length === 0 || open.length > NUDGE_MAX_OPEN) continue;
    out.push({
      id: NUDGE_ID_BASE + offset,
      title: tActive("notify.eveningTitle"),
      body: privateMode
        ? tActive("notify.eveningPrivate")
        : tActive("notify.eveningBody", { count: open.length, minutes: todayEffort(open), run: run + offset }),
      schedule: { at },
      extra: { tab: "today" },
    });
  }
  return out;
}
