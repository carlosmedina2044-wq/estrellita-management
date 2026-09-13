import { tActive } from "@/i18n";
import { tDutyTitle } from "@/i18n/content";
import { addDays } from "@/lib/dates";
import { todaysOpenDuties } from "@/lib/duties";
import { closedDayRun } from "@/lib/momentum";
import type { Duty, Household, MorningBriefSettings } from "@/lib/types";

export const DEFAULT_MORNING_BRIEF: MorningBriefSettings = {
  enabled: true,
  hour: 8,
  weekdaysOnly: false,
};

export const BRIEF_ID_BASE = 10;
export const BRIEF_DAYS = 7;

export function briefCopy(
  duties: Array<Pick<Duty, "title">>,
  privateNotifications = false,
  household?: Household,
  now = new Date(),
): { title: string; body: string } {
  const count = duties.length;
  let title =
    count === 1 ? tActive("notify.briefOne") : tActive("notify.briefMany", { count });
  if (household?.momentum.enabled) {
    const { current } = closedDayRun(household, now);
    if (current >= 2) {
      title = `${tActive("notify.briefRun", { count: current })} · ${title}`;
    }
  }
  if (privateNotifications) {
    return { title, body: tActive("digest.openDetails") };
  }
  const names = duties.slice(0, 3).map((duty) => tDutyTitle(duty.title));
  const more = count > 3 ? tActive("notify.briefMore", { count: count - 3 }) : "";
  return {
    title,
    body: more ? `${names.join(" · ")} · ${more}` : names.join(" · "),
  };
}

export function morningBriefNotifications(
  household: Household,
  now = new Date(),
): Array<{
  id: number;
  title: string;
  body: string;
  schedule: { at: Date };
  extra: { tab: "today" };
}> {
  const settings = household.morningBrief;
  if (!settings.enabled) return [];

  const privateNotifications = household.restockDigest.privateNotifications === true;
  const notices: Array<{
    id: number;
    title: string;
    body: string;
    schedule: { at: Date };
    extra: { tab: "today" };
  }> = [];

  for (let offset = 0; offset < BRIEF_DAYS; offset += 1) {
    const day = addDays(now, offset);
    if (settings.weekdaysOnly && (day.getDay() === 0 || day.getDay() === 6)) continue;
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), settings.hour, 0, 0);
    if (at.getTime() <= now.getTime()) continue;
    const open = todaysOpenDuties(household, day);
    if (open.length === 0) continue;
    notices.push({
      id: BRIEF_ID_BASE + offset,
      ...briefCopy(open, privateNotifications, household, now),
      schedule: { at },
      extra: { tab: "today" },
    });
  }

  return notices;
}
