import type { Audience, Effort, Frequency } from "@/lib/types";
import { inferAudience as inferHouseAudience } from "@/lib/house";

export const FREQUENCIES: { id: Frequency; label: string }[] = [
  { id: "daily", label: "Every day" },
  { id: "weekly", label: "Every week" },
  { id: "monthly", label: "Every month" },
  { id: "quarterly", label: "Every quarter" },
  { id: "yearly", label: "Every year" },
  { id: "once", label: "One time" },
];

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

export const EFFORTS: { id: Effort; label: string; hint: string }[] = [
  { id: "small", label: "Light", hint: "A few minutes" },
  { id: "medium", label: "Regular", hint: "A short chore" },
  { id: "large", label: "Heavy", hint: "A real lift" },
];

export const AUDIENCES: { id: Audience; label: string }[] = [
  { id: "me", label: "Me" },
  { id: "cleaner", label: "Cleaner" },
  { id: "anyone", label: "Either" },
];

export function audienceLabel(audience: Audience): string {
  return AUDIENCES.find((item) => item.id === audience)?.label ?? audience;
}

export function frequencyLabelShort(frequency: Frequency): string {
  if (frequency === "daily") return "Daily";
  if (frequency === "weekly") return "Weekly";
  if (frequency === "monthly") return "Monthly";
  if (frequency === "quarterly") return "Quarterly";
  if (frequency === "yearly") return "Yearly";
  return "One time";
}

export function frequencyLabel(frequency: Frequency, weekday: number, monthDay: number): string {
  if (frequency === "daily") return "Daily";
  if (frequency === "weekly") return `Weekly · ${WEEKDAYS[weekday] ?? "Sunday"}`;
  if (frequency === "monthly") {
    const suffix =
      monthDay % 10 === 1 && monthDay !== 11
        ? "st"
        : monthDay % 10 === 2 && monthDay !== 12
          ? "nd"
          : monthDay % 10 === 3 && monthDay !== 13
            ? "rd"
            : "th";
    return `Monthly · ${monthDay}${suffix}`;
  }
  if (frequency === "quarterly") return "Quarterly";
  if (frequency === "yearly") return "Yearly";
  return "One time";
}

export function inferAudience(title: string): Audience {
  return inferHouseAudience(title);
}
