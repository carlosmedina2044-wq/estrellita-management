import assert from "node:assert/strict";
import { test } from "node:test";
import { googleCalendarUrl, icsFileContent, icsFilenameFor } from "@/lib/calendar-export";

const now = new Date("2026-09-19T12:00:00.000Z");

test("googleCalendarUrl builds an all-day, exclusive-end-date link", () => {
  const url = googleCalendarUrl({
    title: "Replace HVAC filter",
    details: ["Two sizes: 16x25x1 and 20x25x1."],
    date: "2026-10-01",
  });
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, "https://calendar.google.com/calendar/render");
  assert.equal(parsed.searchParams.get("action"), "TEMPLATE");
  assert.equal(parsed.searchParams.get("text"), "Replace HVAC filter");
  // All-day Google links are exclusive of the end date.
  assert.equal(parsed.searchParams.get("dates"), "20261001/20261002");
  assert.equal(parsed.searchParams.get("details"), "Two sizes: 16x25x1 and 20x25x1.");
  assert.equal(parsed.searchParams.has("recur"), false);
});

test("googleCalendarUrl adds a yearly recurrence for seasonal playbooks", () => {
  const url = googleCalendarUrl({
    title: "Fall prep, 5 tasks",
    details: ["Test smoke detectors", "Clean gutters"],
    date: "2026-10-01",
    recurYearly: true,
  });
  assert.equal(new URL(url).searchParams.get("recur"), "RRULE:FREQ=YEARLY");
});

test("googleCalendarUrl carries a leap-year end date correctly", () => {
  const url = googleCalendarUrl({ title: "x", details: [], date: "2028-02-29" });
  assert.equal(new URL(url).searchParams.get("dates"), "20280229/20280301");
});

test("icsFileContent produces a parseable, correctly-scoped VEVENT", () => {
  const ics = icsFileContent(
    { title: "Replace HVAC filter", details: ["Two sizes tracked."], date: "2026-10-01" },
    now,
  );
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /VERSION:2\.0/);
  assert.match(ics, /BEGIN:VEVENT/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261001/);
  assert.match(ics, /DTEND;VALUE=DATE:20261002/);
  assert.match(ics, /SUMMARY:Replace HVAC filter/);
  assert.match(ics, /DESCRIPTION:Two sizes tracked\./);
  assert.match(ics, /END:VEVENT\r\nEND:VCALENDAR\r\n$/);
  assert.equal(ics.includes("RRULE"), false);
});

test("icsFileContent escapes commas, semicolons and newlines in text fields", () => {
  const ics = icsFileContent(
    { title: "Fix the sink, finally", details: ["Line one", "Line two; with a semicolon"], date: "2026-10-01" },
    now,
  );
  assert.match(ics, /SUMMARY:Fix the sink\\, finally/);
  assert.match(ics, /DESCRIPTION:Line one\\nLine two\\; with a semicolon/);
});

test("icsFileContent adds RRULE for a yearly playbook event", () => {
  const ics = icsFileContent({ title: "Fall prep", details: [], date: "2026-10-01", recurYearly: true }, now);
  assert.match(ics, /RRULE:FREQ=YEARLY/);
});

test("icsFileContent folds lines over 75 octets per RFC 5545", () => {
  const longDetail = "A".repeat(100);
  const ics = icsFileContent({ title: "x", details: [longDetail], date: "2026-10-01" }, now);
  const descriptionLine = ics.split("\r\n").find((line) => line.startsWith("DESCRIPTION:"));
  assert.ok(descriptionLine);
  assert.ok(descriptionLine!.length <= 75);
});

test("icsFileContent gives two different events two different UIDs", () => {
  const a = icsFileContent({ title: "Replace HVAC filter", details: [], date: "2026-10-01" }, now);
  const b = icsFileContent({ title: "Clean gutters", details: [], date: "2026-10-01" }, now);
  const uidOf = (ics: string) => ics.match(/UID:(\S+)/)?.[1];
  assert.notEqual(uidOf(a), uidOf(b));
});

test("icsFilenameFor slugifies a title into a safe .ics filename", () => {
  assert.equal(icsFilenameFor("Replace HVAC filter"), "replace-hvac-filter.ics");
  assert.equal(icsFilenameFor("Fix the sink, finally!"), "fix-the-sink-finally.ics");
  assert.equal(icsFilenameFor(""), "reminder.ics");
});
