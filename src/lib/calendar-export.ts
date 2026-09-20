/**
 * "Add to calendar" for a chore or a season's worth of them.
 *
 * Cuidala stays the source of truth: this is a one-way export, not a synced
 * calendar. Two paths, chosen by the person, neither needing a new
 * permission or a native plugin:
 *
 *  - Google Calendar: the standard calendar.google.com "add event" link.
 *    On iPhone it opens in the browser (Google's own behaviour, not ours)
 *    where a signed-in person taps Save once.
 *  - Apple Calendar (or any other calendar app): a plain .ics file, shared
 *    through the normal iOS share sheet. iOS recognizes the file type and
 *    offers to add it directly — no EventKit permission prompt, because
 *    nothing here reads or writes the calendar database, it only hands the
 *    OS a file the person chooses to open.
 *
 * A Google Task (a checkable to-do on the calendar grid, not just an event)
 * needs the Google Tasks API behind OAuth and Google's app verification —
 * out of scope here; see docs/FEEDBACK_PLAN_2026-09-19.md, "1.1: Connect
 * Google Tasks".
 */

export type CalendarEventInput = {
  title: string;
  /** Plain text; each entry becomes its own line. */
  details: string[];
  /** ISO date (YYYY-MM-DD). The event is all-day. */
  date: string;
  /** Repeats yearly on this date — for a seasonal playbook's window. */
  recurYearly?: boolean;
};

function isoDateDigits(date: string): string {
  return date.replace(/-/g, "");
}

function addOneDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

/** Builds the standard "add to Google Calendar" link. No API, no sign-in
 * from this app — Google's own page handles the save once it opens. */
export function googleCalendarUrl(input: CalendarEventInput): string {
  const start = isoDateDigits(input.date);
  // Google's all-day "dates" range is exclusive of the end date.
  const end = isoDateDigits(addOneDay(input.date));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${start}/${end}`,
    details: input.details.join("\n"),
  });
  if (input.recurYearly) params.set("recur", "RRULE:FREQ=YEARLY");
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function foldIcsLine(line: string): string {
  // RFC 5545: lines over 75 octets fold onto a continuation line that
  // starts with a space. Cuidala's descriptions are short, but a long
  // playbook task list can cross that line, and an unfolded VEVENT is
  // technically invalid even when most calendar apps forgive it.
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = " " + rest.slice(75);
  }
  parts.push(rest);
  return parts.join("\r\n");
}

/** Builds a minimal, valid .ics file for one all-day event. Shared as a
 * file (see native/share.ts's shareIcsFile), never opened as a link — a
 * data: URL for a file the OS should treat as an attachment is unreliable
 * across share targets. */
export function icsFileContent(input: CalendarEventInput, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uid = `${isoDateDigits(input.date)}-${Math.abs(hashCode(input.title))}@cuidala.app`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cuidala//Add to calendar//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${isoDateDigits(input.date)}`,
    `DTEND;VALUE=DATE:${isoDateDigits(addOneDay(input.date))}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
  ];
  if (input.details.length > 0) {
    lines.push(`DESCRIPTION:${escapeIcsText(input.details.join("\n"))}`);
  }
  if (input.recurYearly) lines.push("RRULE:FREQ=YEARLY");
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/** A filesystem- and share-sheet-safe filename from a chore or playbook title. */
export function icsFilenameFor(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "reminder"}.ics`;
}
