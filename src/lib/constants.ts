import { tActive, type MessageKey } from "@/i18n";
import type { Audience, Effort, Frequency } from "@/lib/types";
import { inferAudience as inferHouseAudience } from "@/lib/house";

const FREQ_KEYS: Record<Frequency, MessageKey> = {
  daily: "freq.everyDay",
  weekly: "freq.everyWeek",
  monthly: "freq.everyMonth",
  quarterly: "freq.everyQuarter",
  yearly: "freq.everyYear",
  once: "freq.oneTime",
};

const FREQ_SHORT: Record<Frequency, MessageKey> = {
  daily: "freq.daily",
  weekly: "freq.weekly",
  monthly: "freq.monthly",
  quarterly: "freq.quarterly",
  yearly: "freq.yearly",
  once: "freq.oneTime",
};

/** Localized frequency options for forms. */
export function frequencyOptions(): { id: Frequency; label: string }[] {
  return (Object.keys(FREQ_KEYS) as Frequency[]).map((id) => ({
    id,
    label: tActive(FREQ_KEYS[id]),
  }));
}

/** @deprecated Prefer frequencyOptions() for localized labels. */
export const FREQUENCIES: { id: Frequency; label: string }[] = [
  { id: "daily", label: "Every day" },
  { id: "weekly", label: "Every week" },
  { id: "monthly", label: "Every month" },
  { id: "quarterly", label: "Every quarter" },
  { id: "yearly", label: "Every year" },
  { id: "once", label: "One time" },
];

export function lifespanUnitOptions(): { id: "days" | "months" | "years"; label: string }[] {
  return [
    { id: "days", label: tActive("unit.days") },
    { id: "months", label: tActive("unit.months") },
    { id: "years", label: tActive("unit.years") },
  ];
}

/** @deprecated Prefer lifespanUnitOptions(). */
export const LIFESPAN_UNITS: { id: "days" | "months" | "years"; label: string }[] = [
  { id: "days", label: "Days" },
  { id: "months", label: "Months" },
  { id: "years", label: "Years" },
];

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function weekdayLabel(index: number): string {
  const key = `weekday.${((index % 7) + 7) % 7}` as MessageKey;
  return tActive(key);
}

export function effortOptions(): { id: Effort; label: string; hint: string }[] {
  return [
    { id: "small", label: tActive("effort.light"), hint: tActive("effort.lightHint") },
    { id: "medium", label: tActive("effort.regular"), hint: tActive("effort.regularHint") },
    { id: "large", label: tActive("effort.heavy"), hint: tActive("effort.heavyHint") },
  ];
}

/** @deprecated Prefer effortOptions(). */
export const EFFORTS: { id: Effort; label: string; hint: string }[] = [
  { id: "small", label: "Light", hint: "A few minutes" },
  { id: "medium", label: "Regular", hint: "A short chore" },
  { id: "large", label: "Heavy", hint: "A real lift" },
];

export function audienceOptions(): { id: Audience; label: string }[] {
  return [
    { id: "me", label: tActive("audience.me") },
    { id: "cleaner", label: tActive("audience.cleaner") },
    { id: "anyone", label: tActive("audience.either") },
  ];
}

/** @deprecated Prefer audienceOptions(). */
export const AUDIENCES: { id: Audience; label: string }[] = [
  { id: "me", label: "Me" },
  { id: "cleaner", label: "Cleaner" },
  { id: "anyone", label: "Either" },
];

export function audienceLabel(audience: Audience): string {
  return audienceOptions().find((item) => item.id === audience)?.label ?? audience;
}

export function frequencyLabelShort(frequency: Frequency): string {
  return tActive(FREQ_SHORT[frequency]);
}

export function frequencyLabel(frequency: Frequency, weekday: number, monthDay: number): string {
  if (frequency === "daily") return tActive("freq.daily");
  if (frequency === "weekly") return tActive("freq.weeklyDay", { day: weekdayLabel(weekday) });
  if (frequency === "monthly") {
    return tActive("freq.monthlyDay", { day: String(monthDay) });
  }
  if (frequency === "quarterly") return tActive("freq.quarterly");
  if (frequency === "yearly") return tActive("freq.yearly");
  return tActive("freq.oneTime");
}

export function inferAudience(title: string): Audience {
  return inferHouseAudience(title);
}
