import { cleanLine } from "./text";

/** A date found in free text. `day` is missing for "06/2028" and "June 2028". */
export type FoundDate = {
  year: number;
  month: number;
  day?: number;
  /** "YYYY-MM-DD" for a full date, undefined for month-and-year only. */
  iso?: string;
  raw: string;
  index: number;
};

export type FindDatesOptions = {
  now: Date;
  /** Latest year accepted. Receipts stop at this year; warranties look decades ahead. */
  maxYear?: number;
  minYear?: number;
  /** Accept "06/2028" and "June 2028". */
  allowMonthYear?: boolean;
};

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12,
};

const DIGITISH = "[0-9OIl]";

/** Digit look-alikes inside a token that is already known to be a date part. */
function num(value: string): number {
  return Number(value.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1"));
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fullYear(value: string, now: Date): number {
  const n = num(value);
  if (value.length === 4) return n;
  // Two digits: up to next year is this century, later is the last one.
  return n <= (now.getFullYear() % 100) + 1 ? 2000 + n : 1900 + n;
}

function validYMD(y: number, m: number, d: number, o: FindDatesOptions): boolean {
  const min = o.minYear ?? 1990;
  const max = o.maxYear ?? o.now.getFullYear();
  return y >= min && y <= max && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

const FULL_NUMERIC = new RegExp(`(?<![\\dA-Za-z])(${DIGITISH}{1,2})\\s?([/.\\-])\\s?(${DIGITISH}{1,2})\\s?\\2\\s?(${DIGITISH}{4}|${DIGITISH}{2})(?![\\d])`, "g");
const ISO = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;
const MONTH_YEAR_NUM = /(?<![\d/])(\d{1,2})\s?[/\-]\s?(\d{4})(?![\d/])/g;
const MONTH_NAMES = "JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUNE?|JULY?|AUG(?:UST)?|SEPT?(?:EMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?";
const NAMED_FULL = new RegExp(`(?<![A-Z])(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:ST|ND|RD|TH)?,?\\s+(\\d{4})(?!\\d)`, "g");
const NAMED_DAY_FIRST = new RegExp(`(?<![\\dA-Z])(\\d{1,2})\\s+(${MONTH_NAMES})\\.?,?\\s+(\\d{4})(?!\\d)`, "g");
const NAMED_MONTH_YEAR = new RegExp(`(?<![A-Z])(${MONTH_NAMES})\\.?,?\\s+(\\d{4})(?!\\d)`, "g");

function monthOf(name: string): number {
  return MONTHS[name.slice(0, name.startsWith("SEPT") ? 4 : 3)] ?? 0;
}

/**
 * Finds US-style dates (M/D/YYYY, M-D-YY, "Oct 4, 2026", "2026-10-04") in one
 * line, tolerating O/I look-alikes in the digits. Pure; never throws.
 * Numeric dates are read month-first because the app is US only.
 */
export function findDates(rawLine: string, options: FindDatesOptions): FoundDate[] {
  let work = cleanLine(rawLine).toUpperCase();
  const found: FoundDate[] = [];
  const blank = (index: number, length: number) => {
    work = work.slice(0, index) + " ".repeat(length) + work.slice(index + length);
  };

  for (const m of work.matchAll(ISO)) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (validYMD(y, mo, d, options)) found.push({ year: y, month: mo, day: d, iso: isoOf(y, mo, d), raw: m[0], index: m.index ?? 0 });
  }
  for (const f of found) blank(f.index, f.raw.length);

  const pushFull = (index: number, raw: string, y: number, mo: number, d: number) => {
    if (!validYMD(y, mo, d, options)) return false;
    found.push({ year: y, month: mo, day: d, iso: isoOf(y, mo, d), raw, index });
    return true;
  };

  const scan = (re: RegExp, build: (m: RegExpMatchArray) => [number, number, number] | null) => {
    const snapshot = work;
    for (const m of snapshot.matchAll(re)) {
      const parts = build(m);
      if (!parts) continue;
      if (pushFull(m.index ?? 0, m[0], parts[0], parts[1], parts[2])) blank(m.index ?? 0, m[0].length);
    }
  };

  scan(FULL_NUMERIC, (m) => [fullYear(m[4], options.now), num(m[1]), num(m[3])]);
  scan(NAMED_FULL, (m) => [Number(m[3]), monthOf(m[1]), Number(m[2])]);
  scan(NAMED_DAY_FIRST, (m) => [Number(m[3]), monthOf(m[2]), Number(m[1])]);

  if (options.allowMonthYear) {
    const snapshot = work;
    const min = options.minYear ?? 1990;
    const max = options.maxYear ?? options.now.getFullYear();
    const push = (index: number, raw: string, y: number, mo: number) => {
      if (y < min || y > max || mo < 1 || mo > 12) return;
      found.push({ year: y, month: mo, raw, index });
      blank(index, raw.length);
    };
    for (const m of snapshot.matchAll(MONTH_YEAR_NUM)) push(m.index ?? 0, m[0], Number(m[2]), Number(m[1]));
    for (const m of snapshot.matchAll(NAMED_MONTH_YEAR)) push(m.index ?? 0, m[0], Number(m[2]), monthOf(m[1]));
  }

  return found.sort((a, b) => a.index - b.index);
}
