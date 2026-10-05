import type { AssetType } from "@/lib/types";
import { BRANDS, type BrandInfo } from "./brands";
import { cleanLine, expandYear, fixNumericLookalikes } from "./text";

/** A value plus the raw plate line it came from, so the confirm card can show its evidence. */
export type Evidence<T> = { value: T; line: string; lineIndex: number };

export type TypeGuess = {
  type: AssetType;
  /** "words" = the plate names it; "brand" = only the brand implies it; "weak" = a unit like BTU or TON. */
  basis: "words" | "brand" | "weak";
};

export type FilterSize = { width: number; height: number; depth: number; text: string; labelled: boolean };

export type PrintedDate = {
  year: number;
  month?: number;
  raw: string;
  /** Both halves were 1-12 (e.g. 05-11), so month and year could be swapped. */
  ambiguous: boolean;
};

export type ParsedLabel = {
  brand?: Evidence<BrandInfo>;
  model?: Evidence<string>;
  serial?: Evidence<string>;
  type?: Evidence<TypeGuess>;
  filterSize?: Evidence<FilterSize>;
  printedDate?: Evidence<PrintedDate>;
  /** Cleaned, non-empty lines that were actually considered. */
  lines: string[];
};

const MAX_LINE = 160;

// ---------- brand ----------

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BRAND_MATCHERS = BRANDS.flatMap((brand) =>
  brand.aliases.map((alias) => ({
    brand,
    alias,
    re: new RegExp(`(?<![A-Z0-9])${escapeRe(alias).replace(/\\ /g, "[ .\\-]?")}(?![A-Z0-9])`),
    compact: alias.replace(/[^A-Z0-9]/g, ""),
  })),
);

function findBrand(lines: string[]): Evidence<BrandInfo> | undefined {
  let best: { brand: BrandInfo; len: number; index: number } | undefined;
  lines.forEach((line, index) => {
    const upper = line.toUpperCase();
    const compactLine = upper.replace(/[^A-Z0-9]/g, "");
    for (const m of BRAND_MATCHERS) {
      let hit = m.re.test(upper);
      // OCR often drops the space or dot in two-word names ("BRADFORDWHITE", "AOSMITH").
      if (!hit && m.compact.length >= 7 && compactLine.includes(m.compact)) hit = true;
      if (!hit) continue;
      const len = m.compact.length;
      if (!best || len > best.len || (len === best.len && index < best.index)) {
        best = { brand: m.brand, len, index };
      }
    }
  });
  return best ? { value: best.brand, line: lines[best.index], lineIndex: best.index } : undefined;
}

// ---------- labelled fields ----------

const MODEL_LABEL =
  /(?<![A-Z0-9])(?:M[O0]DEL(?:\s*(?:N[O0]|NUM(?:BER)?|#)(?![A-Z]))?|M[O0]D|M\/N|MDL)(?![A-Z])\.?\s*(?:N[O0]\.?(?![A-Z])|#)?\s*[:#.\-]*\s*/gi;
const SERIAL_LABEL =
  /(?<![A-Z0-9])(?:SER[I1L]AL(?:\s*(?:N[O0]|NUM(?:BER)?|#)(?![A-Z]))?|SER(?![A-Z])\.?(?:\s*N[O0](?![A-Z]))?|S\/N|SN(?![A-Z]))\.?\s*[:#.\-]*\s*/gi;
const ANY_LABEL =
  /(?<![A-Z0-9])(?:M[O0]DEL|M\/N|M[O0]D|SER[I1L]AL|SER\.|S\/N|MFG|MFD|MFR|MANUF\w*|DATE|PROD(?:UCT)?\s+(?:N[O0]|NUM)|TYPE|VOLTS?|BTU|AMPS?)(?![A-Z0-9])/i;

const VALUE_TOKEN = /^[A-Z0-9][A-Z0-9\-\/.]*[A-Z0-9]$/i;
const NOT_A_VALUE = /^(?:NO|NUMBER|NUM|TYPE|DATE|MODEL|SERIAL|N\/A|NA)$/i;

function cleanValue(raw: string): string | undefined {
  // Cut the value at the next label on the same line: "MODEL ABC123 SERIAL X1".
  const stop = raw.search(ANY_LABEL);
  const head = stop > 0 ? raw.slice(0, stop) : raw;
  const token = head
    .trim()
    .split(" ")[0]
    ?.replace(/^[:#.\-]+|[:#.,;\-]+$/g, "");
  if (!token || token.length < 4 || token.length > 24) return undefined;
  if (NOT_A_VALUE.test(token) || !VALUE_TOKEN.test(token)) return undefined;
  if (!/[0-9]/.test(token)) return undefined;
  return fixNumericLookalikes(token.toUpperCase());
}

function findLabelled(lines: string[], label: RegExp, skip?: (line: string) => boolean): Evidence<string> | undefined {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (skip?.(line)) continue;
    label.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = label.exec(line)) !== null) {
      if (match[0].length === 0) {
        label.lastIndex += 1;
        continue;
      }
      let value = cleanValue(line.slice(match.index + match[0].length));
      let usedLine = line;
      let usedIndex = i;
      // Label alone on its line: the value is on the next one.
      if (!value && line.slice(match.index + match[0].length).trim() === "" && lines[i + 1]) {
        value = cleanValue(lines[i + 1]);
        usedLine = `${line} ${lines[i + 1]}`;
        usedIndex = i;
      }
      if (value) return { value, line: usedLine, lineIndex: usedIndex };
    }
  }
  return undefined;
}

// ---------- appliance type ----------

const TYPE_WORDS: { type: AssetType; re: RegExp }[] = [
  { type: "water_heater", re: /WATER\s*HEATER|HOT\s*WATER\s*(?:TANK|HEATER)|TANKLESS/ },
  { type: "furnace", re: /(?<![A-Z])FURNACE|GAS\s*HEAT(?:ING)?\s*UNIT|UPFLOW|DOWNFLOW/ },
  { type: "dishwasher", re: /DISH\s*WASHER/ },
  { type: "refrigerator", re: /REFRIGERATOR|FRIDGE|FREEZER|REFRIGERADOR/ },
  { type: "dryer", re: /(?<![A-Z])(?:CLOTHES\s*)?DRYER(?![A-Z])/ },
  { type: "washer", re: /(?<![A-Z])(?:CLOTHES\s*|LAUNDRY\s*)?WASHER(?![A-Z])|WASHING\s*MACHINE/ },
  { type: "hvac_system", re: /AIR\s*CONDITIONER|CONDENSING\s*UNIT|HEAT\s*PUMP|SPLIT\s*SYSTEM|AIR\s*HANDLER/ },
  { type: "range_oven", re: /(?<![A-Z])(?:RANGE|OVEN|COOKTOP)(?![A-Z])/ },
  { type: "microwave", re: /MICROWAVE/ },
  { type: "garbage_disposal", re: /DISPOSER|DISPOSAL/ },
];

function findType(lines: string[], brand?: Evidence<BrandInfo>): Evidence<TypeGuess> | undefined {
  for (let i = 0; i < lines.length; i += 1) {
    const upper = lines[i].toUpperCase();
    for (const entry of TYPE_WORDS) {
      if (entry.re.test(upper)) {
        return { value: { type: entry.type, basis: "words" }, line: lines[i], lineIndex: i };
      }
    }
  }
  if (brand?.value.typeHint) {
    return { value: { type: brand.value.typeHint, basis: "brand" }, line: brand.line, lineIndex: brand.lineIndex };
  }
  for (let i = 0; i < lines.length; i += 1) {
    const upper = lines[i].toUpperCase();
    if (/(?<![A-Z])(?:U\.?S\.?\s*)?GAL(?:LONS?|S)?(?![A-Z])/.test(upper) && /\d/.test(upper)) {
      return { value: { type: "water_heater", basis: "weak" }, line: lines[i], lineIndex: i };
    }
  }
  for (let i = 0; i < lines.length; i += 1) {
    const upper = lines[i].toUpperCase();
    if (/(?<![A-Z0-9])\d(?:\.\d)?\s*TONS?(?![A-Z])|NOMINAL\s*TONS?|COOLING\s*CAPACITY/.test(upper)) {
      return { value: { type: "hvac_system", basis: "weak" }, line: lines[i], lineIndex: i };
    }
  }
  for (let i = 0; i < lines.length; i += 1) {
    if (/(?<![A-Z])BTU/i.test(lines[i]) && /INPUT|HEATING|OUTPUT/i.test(lines[i])) {
      return { value: { type: "furnace", basis: "weak" }, line: lines[i], lineIndex: i };
    }
  }
  return undefined;
}

// ---------- filter size ----------

const FILTER_RE = /(?<![\d.])(\d{1,2}(?:\.\d{1,2})?)\s*[xX×*]\s*(\d{1,2}(?:\.\d{1,2})?)\s*[xX×*]\s*(\d{1,2}(?:\.\d{1,2})?)(?![\d.])/;

function findFilterSize(lines: string[]): Evidence<FilterSize> | undefined {
  let fallback: Evidence<FilterSize> | undefined;
  for (let i = 0; i < lines.length; i += 1) {
    const m = FILTER_RE.exec(lines[i]);
    if (!m) continue;
    const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const [width, height] = a <= b ? [a, b] : [b, a];
    // Real furnace/AC filters: sides 8-36 in, thickness 0.5-6 in. Rejects stray "120x240x60" style text.
    if (width < 8 || height > 36 || c < 0.5 || c > 6) continue;
    const labelled = /FILTER/i.test(lines[i]) || /FILTER/i.test(lines[i - 1] ?? "");
    const text = `${m[1]}x${m[2]}x${m[3]}`;
    const found = { value: { width, height, depth: c, text, labelled }, line: lines[i], lineIndex: i };
    if (labelled) return found;
    fallback ??= found;
  }
  return fallback;
}

// ---------- printed manufacture date ----------

const MONTHS: Record<string, number> = {
  JAN: 1, JANUARY: 1, FEB: 2, FEBRUARY: 2, MAR: 3, MARCH: 3, APR: 4, APRIL: 4, MAY: 5,
  JUN: 6, JUNE: 6, JUL: 7, JULY: 7, AUG: 8, AUGUST: 8, SEP: 9, SEPT: 9, SEPTEMBER: 9,
  OCT: 10, OCTOBER: 10, NOV: 11, NOVEMBER: 11, DEC: 12, DECEMBER: 12,
};

const DATE_LABEL =
  /(?<![A-Z0-9])(?:DATE\s+OF\s+MANUF\w*|DATE\s+MFD|MANUF\w*|MFG|MFD|MFR|MADE)(?![A-Z0-9])\.?\s*(?:DATE|DT)?(?![A-Z0-9])\.?\s*[:#.\-]*\s*/gi;

function fixDateDigits(text: string): string {
  return text.replace(/[A-Z0-9|]+/gi, (token) => (/^[0-9OIl|]+$/i.test(token) ? fixNumericLookalikes(token) : token));
}

function parseDateText(raw: string, now: Date): PrintedDate | undefined {
  const text = fixDateDigits(raw.trim().toUpperCase());
  const done = (year: number, month: number | undefined, ambiguous: boolean): PrintedDate | undefined => {
    if (year < 1970 || year > now.getFullYear()) return undefined;
    if (month !== undefined && (month < 1 || month > 12)) return undefined;
    if (month !== undefined && year === now.getFullYear() && month > now.getMonth() + 2) return undefined;
    return { year, month, raw: raw.trim(), ambiguous };
  };

  // MM/DD/YYYY (or DD/MM/YYYY when the first number cannot be a month)
  let m = /(?<!\d)(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4})(?!\d)/.exec(text);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a > 12 && b <= 12) return done(Number(m[3]), b, false);
    return done(Number(m[3]), a, a <= 12 && b <= 12 && a !== b);
  }
  // YYYY-MM
  m = /(?<!\d)((?:19|20)\d{2})\s*[\/\-.]\s*(\d{1,2})(?!\d)/.exec(text);
  if (m) return done(Number(m[1]), Number(m[2]), false);
  // MM-YYYY
  m = /(?<!\d)(\d{1,2})\s*[\/\-.]\s*((?:19|20)\d{2})(?!\d)/.exec(text);
  if (m) return done(Number(m[2]), Number(m[1]), false);
  // MON YYYY / MONTH, YYYY
  m = /(?<![A-Z])([A-Z]{3,9})\.?[\s,\-\/']*((?:19|20)\d{2})(?!\d)/.exec(text);
  if (m && MONTHS[m[1]] !== undefined) return done(Number(m[2]), MONTHS[m[1]], false);
  // YYYY MON
  m = /(?<!\d)((?:19|20)\d{2})[\s,\-\/]*([A-Z]{3,9})(?![A-Z])/.exec(text);
  if (m && MONTHS[m[2]] !== undefined) return done(Number(m[1]), MONTHS[m[2]], false);
  // MON-YY (needs a separator so "MAR 14" is not read as the 14th)
  m = /(?<![A-Z])([A-Z]{3,9})[\-\/']\s*(\d{2})(?!\d)/.exec(text);
  if (m && MONTHS[m[1]] !== undefined) return done(expandYear(Number(m[2]), now), MONTHS[m[1]], false);
  // MM-YY / YY-MM
  m = /(?<!\d)(\d{2})\s*[\/\-.]\s*(\d{2})(?!\d)/.exec(text);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a >= 1 && a <= 12 && b >= 1 && b <= 12) return done(expandYear(b, now), a, a !== b);
    if (a >= 1 && a <= 12) return done(expandYear(b, now), a, false);
    if (b >= 1 && b <= 12) return done(expandYear(a, now), b, false);
    return undefined;
  }
  // Bare year after a label.
  m = /^\s*((?:19|20)\d{2})\s*$/.exec(text);
  if (m) return done(Number(m[1]), undefined, false);
  return undefined;
}

function findPrintedDate(lines: string[], now: Date): Evidence<PrintedDate> | undefined {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    DATE_LABEL.lastIndex = 0;
    const label = DATE_LABEL.exec(line);
    if (!label) continue;
    let rest = line.slice(label.index + label[0].length);
    let evidenceLine = line;
    if (rest.trim() === "" && lines[i + 1]) {
      rest = lines[i + 1];
      evidenceLine = `${line} ${lines[i + 1]}`;
    }
    const stop = rest.search(/(?<![A-Z0-9])(?:M[O0]DEL|SER[I1L]AL|S\/N|M\/N)(?![A-Z0-9])/i);
    if (stop > 0) rest = rest.slice(0, stop);
    const parsed = parseDateText(rest, now);
    if (parsed) return { value: parsed, line: evidenceLine, lineIndex: i };
  }
  return undefined;
}

// ---------- entry point ----------

export function parseLabel(input: string[], now: Date = new Date()): ParsedLabel {
  const lines = input
    .map((line) => (typeof line === "string" ? cleanLine(line) : ""))
    .filter((line) => line.length > 0 && line.length <= MAX_LINE);

  const brand = findBrand(lines);
  const serial = findLabelled(lines, SERIAL_LABEL);
  const model = findLabelled(lines, MODEL_LABEL, (line) => /SER[I1L]AL/i.test(line) && !/M[O0]DEL|M\/N/i.test(line));
  return {
    brand,
    model,
    serial,
    type: findType(lines, brand),
    filterSize: findFilterSize(lines),
    printedDate: findPrintedDate(lines, now),
    lines,
  };
}
