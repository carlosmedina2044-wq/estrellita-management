export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1).getTime();
}

export function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function daysAgoStart(days: number, now = new Date()): number {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - days);
  return start.getTime();
}

export function lastWeeklyStart(now: Date, weekday: number): number {
  const diff = (now.getDay() - weekday + 7) % 7;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - diff);
  return start.getTime();
}

export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(parseISODate(value)));
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function addCalendarMonths(date: Date, months: number): Date {
  const targetMonth = date.getMonth() + months;
  const next = new Date(date.getFullYear(), targetMonth, date.getDate());
  if (next.getDate() !== date.getDate()) {
    return new Date(date.getFullYear(), targetMonth + 1, 0);
  }
  return next;
}

export function addCalendarYears(date: Date, years: number): Date {
  return addCalendarMonths(date, years * 12);
}

export function formatDueDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(parseISODate(value)) : value;
  const includeYear = date.getFullYear() !== new Date().getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
  }).format(date);
}

export function formatWeekdayDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(parseISODate(value)) : value;
  const includeYear = date.getFullYear() !== new Date().getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
  }).format(date);
}

export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function weekRange(date: Date): { start: Date; end: Date } {
  const start = startOfWeek(date);
  return { start, end: addDays(start, 6) };
}

export function monthRange(date: Date): { start: Date; end: Date } {
  return { start: startOfMonth(date), end: endOfMonth(date) };
}

export function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function isFirstOfMonth(date: Date): boolean {
  return date.getDate() === 1;
}

export function formatMonthTitle(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}
