import { audienceLabel, frequencyLabel, roomLabel } from "@/lib/constants";
import { HOUSE_ROOMS } from "@/lib/house";
import { roomName } from "@/lib/home-model";
import {
  addCalendarMonths,
  addCalendarYears,
  daysInMonth,
  formatDueDate,
  lastWeeklyStart,
  monthRange,
  parseISODate,
  startOfDay,
  toISODate,
  weekRange,
} from "@/lib/dates";
import type { Audience, Completion, Duty, Frequency, Household } from "@/lib/types";

export function lastCompletion(
  dutyId: string,
  completions: Completion[],
): Completion | undefined {
  return completions
    .filter((item) => item.dutyId === dutyId)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
}

export function installedAtFor(household: Household, dutyId: string): string | null {
  return household.supplyAutomations.find((item) => item.dutyId === dutyId)?.installedAt ?? null;
}

function addCadence(anchor: Date, frequency: Extract<Frequency, "quarterly" | "yearly">): Date {
  return frequency === "quarterly" ? addCalendarMonths(anchor, 3) : addCalendarYears(anchor, 1);
}

export function nextDueDate(
  duty: Duty,
  completions: Completion[],
  now = new Date(),
  installedAt?: string | null,
): Date | null {
  switch (duty.frequency) {
    case "once":
      return duty.dueDate ? new Date(parseISODate(duty.dueDate)) : null;
    case "daily":
      return new Date(startOfDay(now));
    case "weekly":
      return new Date(lastWeeklyStart(now, duty.weekday));
    case "monthly": {
      const dueDay = Math.min(duty.monthDay, daysInMonth(now));
      return new Date(now.getFullYear(), now.getMonth(), dueDay);
    }
    case "quarterly":
    case "yearly": {
      const last = lastCompletion(duty.id, completions);
      if (last) return addCadence(new Date(last.completedAt), duty.frequency);
      if (installedAt) return addCadence(new Date(parseISODate(installedAt)), duty.frequency);
      return new Date(duty.createdAt);
    }
  }
}

export function isDoneThisPeriod(
  duty: Duty,
  completions: Completion[],
  now = new Date(),
  installedAt?: string | null,
): boolean {
  const last = lastCompletion(duty.id, completions);
  if (!last) return false;
  const doneAt = new Date(last.completedAt);

  switch (duty.frequency) {
    case "once":
      return true;
    case "daily":
      return startOfDay(doneAt) === startOfDay(now);
    case "weekly":
      return new Date(last.completedAt).getTime() >= lastWeeklyStart(now, duty.weekday);
    case "monthly":
      return doneAt.getFullYear() === now.getFullYear() && doneAt.getMonth() === now.getMonth();
    case "quarterly":
    case "yearly": {
      const next = nextDueDate(duty, completions, now, installedAt);
      return Boolean(next) && startOfDay(now) < startOfDay(next!);
    }
  }
}

export function isDueToday(
  duty: Duty,
  completions: Completion[],
  now = new Date(),
  installedAt?: string | null,
): boolean {
  if (duty.archived || isDoneThisPeriod(duty, completions, now, installedAt)) return false;

  switch (duty.frequency) {
    case "once":
      return Boolean(duty.dueDate) && parseISODate(duty.dueDate!) <= startOfDay(now);
    case "daily":
      return true;
    case "weekly":
      return now.getDay() === duty.weekday;
    case "monthly": {
      const dueDay = Math.min(duty.monthDay, daysInMonth(now));
      return now.getDate() === dueDay;
    }
    case "quarterly":
    case "yearly": {
      const next = nextDueDate(duty, completions, now, installedAt);
      return Boolean(next) && startOfDay(now) >= startOfDay(next!);
    }
  }
}

export function isOverdue(
  duty: Duty,
  completions: Completion[],
  now = new Date(),
  installedAt?: string | null,
): boolean {
  if (duty.archived || isDoneThisPeriod(duty, completions, now, installedAt)) return false;

  switch (duty.frequency) {
    case "once":
      return Boolean(duty.dueDate) && parseISODate(duty.dueDate!) < startOfDay(now);
    case "daily":
      return false;
    case "weekly":
      return now.getDay() !== duty.weekday;
    case "monthly": {
      const dueDay = Math.min(duty.monthDay, daysInMonth(now));
      return now.getDate() > dueDay;
    }
    case "quarterly":
    case "yearly": {
      const next = nextDueDate(duty, completions, now, installedAt);
      return Boolean(next) && startOfDay(now) > startOfDay(next!);
    }
  }
}

export function isOverdueFor(duty: Duty, household: Household, now = new Date()): boolean {
  return isOverdue(duty, household.completions, now, installedAtFor(household, duty.id));
}

export function wasCompletedToday(
  duty: Duty,
  completions: Completion[],
  now = new Date(),
): boolean {
  const last = lastCompletion(duty.id, completions);
  if (!last) return false;
  return startOfDay(new Date(last.completedAt)) === startOfDay(now);
}

export function dutySubtitle(
  duty: Duty,
  completions: Completion[] = [],
  now = new Date(),
  installedAt?: string | null,
  household?: Household,
): string {
  const cadence = frequencyLabel(duty.frequency, duty.weekday, duty.monthDay);
  const next = nextDueDate(duty, completions, now, installedAt);
  const dueBit =
    duty.frequency === "once" && duty.dueDate
      ? `Due ${duty.dueDate}`
      : duty.frequency === "quarterly" || duty.frequency === "yearly"
        ? `${cadence} · Due ${next ? formatDueDate(toISODate(next)) : "—"}`
        : cadence;
  const place = household ? roomName(household, duty.room) : roomLabel(duty.room);
  return `${place} · ${dueBit} · ${audienceLabel(duty.audience)}`;
}

export function sortDuties(duties: Duty[], household?: Household): Duty[] {
  const ranked = household?.rooms?.length
    ? household.rooms
    : HOUSE_ROOMS.map((room, index) => ({ id: room.id, sortOrder: index }));
  const roomRank = Object.fromEntries(ranked.map((room, index) => [room.id, "sortOrder" in room ? room.sortOrder : index]));
  const effortRank = { large: 0, medium: 1, small: 2 };
  return [...duties].sort((a, b) => {
    const room = (roomRank[a.room] ?? 99) - (roomRank[b.room] ?? 99);
    if (room !== 0) return room;
    const effort = effortRank[a.effort] - effortRank[b.effort];
    if (effort !== 0) return effort;
    return a.title.localeCompare(b.title);
  });
}

export function matchesAudience(duty: Duty, audience: Audience | "all"): boolean {
  if (audience === "all") return true;
  if (audience === "me") return duty.audience === "me" || duty.audience === "anyone";
  if (audience === "cleaner") return duty.audience === "cleaner" || duty.audience === "anyone";
  return duty.audience === audience;
}

export function todaysOpenDuties(
  household: Household,
  now = new Date(),
  audience: Audience | "all" = "all",
): Duty[] {
  return sortDuties(
    household.duties.filter((duty) => {
      if (!matchesAudience(duty, audience)) return false;
      const installedAt = installedAtFor(household, duty.id);
      return (
        isDueToday(duty, household.completions, now, installedAt) ||
        isOverdue(duty, household.completions, now, installedAt)
      );
    }),
    household,
  );
}

export function isScheduledOn(
  duty: Duty,
  date: Date,
  completions: Completion[] = [],
  installedAt?: string | null,
): boolean {
  if (duty.archived) return false;
  switch (duty.frequency) {
    case "once":
      return Boolean(duty.dueDate) && parseISODate(duty.dueDate!) === startOfDay(date);
    case "daily":
      return true;
    case "weekly":
      return date.getDay() === duty.weekday;
    case "monthly": {
      const dueDay = Math.min(duty.monthDay, daysInMonth(date));
      return date.getDate() === dueDay;
    }
    case "quarterly":
    case "yearly": {
      const next = nextDueDate(duty, completions, date, installedAt);
      return Boolean(next) && startOfDay(next!) === startOfDay(date);
    }
  }
}

export function isScheduledInRange(
  duty: Duty,
  start: Date,
  end: Date,
  completions: Completion[] = [],
  installedAt?: string | null,
): boolean {
  const last = startOfDay(end);
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (startOfDay(cursor) <= last) {
    if (isScheduledOn(duty, cursor, completions, installedAt)) return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

export type OutstandingScope = "daily" | "weekly" | "monthly";

export function rangeForScope(scope: OutstandingScope, now: Date): { start: Date; end: Date } {
  if (scope === "weekly") return weekRange(now);
  if (scope === "monthly") return monthRange(now);
  return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
}

export function openDutiesInScope(
  household: Household,
  scope: OutstandingScope,
  now = new Date(),
  audience: Audience | "all" = "all",
): Duty[] {
  if (scope === "daily") return todaysOpenDuties(household, now, audience);
  const range = rangeForScope(scope, now);
  return sortDuties(
    household.duties.filter((duty) => {
      if (!matchesAudience(duty, audience)) return false;
      const installedAt = installedAtFor(household, duty.id);
      if (isDoneThisPeriod(duty, household.completions, now, installedAt)) return false;
      return (
        isScheduledInRange(duty, range.start, range.end, household.completions, installedAt) ||
        isOverdue(duty, household.completions, now, installedAt)
      );
    }),
    household,
  );
}

export function dutiesDueOnDate(
  household: Household,
  date: Date,
  audience: Audience | "all" = "all",
): Duty[] {
  return sortDuties(
    household.duties.filter((duty) => {
      if (!matchesAudience(duty, audience)) return false;
      const installedAt = installedAtFor(household, duty.id);
      return isScheduledOn(duty, date, household.completions, installedAt);
    }),
    household,
  );
}

export function monthPlanDuties(
  household: Household,
  now = new Date(),
  audience: Audience | "all" = "all",
): Duty[] {
  const range = monthRange(now);
  return sortDuties(
    household.duties.filter((duty) => {
      if (!matchesAudience(duty, audience)) return false;
      const installedAt = installedAtFor(household, duty.id);
      if (isDoneThisPeriod(duty, household.completions, now, installedAt)) return false;
      return isScheduledInRange(duty, range.start, range.end, household.completions, installedAt);
    }),
    household,
  );
}

export function groupByRoom(duties: Duty[], household?: Household) {
  const rooms = household?.rooms?.length
    ? [...household.rooms]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((room) => ({ id: room.id, label: room.name, floor: room.floorId }))
    : HOUSE_ROOMS.map((room) => ({ id: room.id, label: room.label, floor: room.floor }));
  return rooms
    .map((room) => ({
      id: room.id,
      label: room.label,
      floor: room.floor,
      duties: duties.filter((duty) => duty.room === room.id),
    }))
    .filter((group) => group.duties.length > 0);
}

export function shareText(household: Household, duties: Duty[]): string {
  const lines = [`${household.householdName} — today's work`, ""];
  for (const group of groupByRoom(duties, household)) {
    lines.push(group.label);
    for (const duty of group.duties) {
      const note = duty.notes.trim() ? ` (${duty.notes.trim()})` : "";
      lines.push(`- [ ] ${duty.title}${note}`);
    }
    lines.push("");
  }
  if (duties.length === 0) lines.push("Nothing queued today.");
  return lines.join("\n").trim();
}
