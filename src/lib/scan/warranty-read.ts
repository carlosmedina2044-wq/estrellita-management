import { addCalendarMonths } from "@/lib/dates";
import { cleanLine } from "./text";
import { daysInMonth, findDates, isoOf } from "./us-date";

/**
 * Reads warranty text from a scan (a card, a box, a receipt footer). Returns the
 * day the warranty ends as an ISO date, or says what is still missing. Codes
 * only, never sentences. Named warranty-read to stay apart from lib/warranty.ts.
 */

export type WarrantyLevel = "high" | "medium" | "low";

export type WarrantyReading = {
  /** "YYYY-MM-DD". Missing when the text gave a length but no start date to count from. */
  warrantyUntil?: string;
  confidence: WarrantyLevel;
  basis?: "printed_end" | "term_from_date";
  /** The longest term printed, in months ("5 year limited warranty" is 60). */
  termMonths?: number;
  /** Every term seen, longest first ("10 years tank, 1 year parts"). */
  terms: number[];
  lifetime: boolean;
  /** Where the count started, when basis is "term_from_date". */
  startDate?: string;
  /** A length was read but no purchase or install date was given, so the card must ask for one. */
  needsStartDate: boolean;
  /** The printed end was only month and year, so the last day of that month was used. */
  monthOnly?: boolean;
  reasons: string[];
};

export type WarrantyReadOptions = {
  now: Date;
  /** "YYYY-MM-DD" of purchase, from the receipt or the person. Preferred start. */
  purchaseDate?: string;
  /** "YYYY-MM-DD" of install, used when there is no purchase date. */
  installDate?: string;
};

const WORD_NUMBERS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10, TWELVE: 12, FIFTEEN: 15, TWENTY: 20 };
const NUM = "(\\d{1,2}|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|TWELVE|FIFTEEN|TWENTY)";
const UNIT = "(YEARS?|YRS?|MONTHS?|MOS?)";
const END_CUE = /\b(?:WARRANTY\s+)?(?:UNTIL|EXPIRES?|EXPIRATION(?:\s+DATE)?|VALID\s+(?:UNTIL|THRU|THROUGH)|ENDS?|THROUGH|THRU|COVERED\s+(?:UNTIL|THROUGH))\b/;

function valueOf(token: string): number {
  return WORD_NUMBERS[token] ?? Number(token);
}

function monthsOf(count: number, unit: string): number {
  return unit.startsWith("Y") ? count * 12 : count;
}

/** All lengths: "5 year limited warranty", "warranty: 10 years", "10 YR TANK". */
function findTerms(text: string): number[] {
  const terms: number[] = [];
  const patterns = [
    new RegExp(`${NUM}[- ]?${UNIT}\\s+(?:LIMITED\\s+|FULL\\s+|PARTS\\s+|LABOR\\s+|TANK\\s+|MANUFACTURER'?S?\\s+)*WARRANT`, "g"),
    new RegExp(`WARRANT(?:Y|IES)(?:\\s+PERIOD|\\s+TERM|\\s+LENGTH)?\\s*[:\\-]?\\s*${NUM}[- ]?${UNIT}`, "g"),
    new RegExp(`${NUM}[- ]?${UNIT}\\s+LIMITED\\b`, "g"),
    new RegExp(`LIMITED\\s+${NUM}[- ]?${UNIT}\\s+WARRANT`, "g"),
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const months = monthsOf(valueOf(m[1]), m[2]);
      if (months >= 1 && months <= 600 && !terms.includes(months)) terms.push(months);
    }
  }
  // "10 YEARS ON THE TANK, 1 YEAR ON PARTS": numbers near the word WARRANTY on a following line.
  if (terms.length > 0) {
    for (const m of text.matchAll(new RegExp(`(?<![\\d/.-])${NUM}[- ]?${UNIT}\\s+(?:ON|FOR|FOR THE|ON THE|PARTS|LABOR|TANK|HEAT EXCHANGER|COMPRESSOR)\\b`, "g"))) {
      const months = monthsOf(valueOf(m[1]), m[2]);
      if (months >= 1 && months <= 600 && !terms.includes(months)) terms.push(months);
    }
  }
  return terms.sort((a, b) => b - a);
}

/** Reads warranty text. Never throws. */
export function readWarranty(rawLines: string[], options: WarrantyReadOptions): WarrantyReading {
  const lines = rawLines.map(cleanLine).filter(Boolean);
  const upper = lines.map((l) => l.toUpperCase());
  const text = upper.join(" \n ");
  const reasons: string[] = [];
  const hasWarranty = /\bWARRANT(?:Y|IES)\b/.test(text);
  const lifetime = /\bLIFETIME\s+(?:LIMITED\s+)?WARRANTY\b|\bWARRANTY\b.{0,20}\bLIFETIME\b/.test(text);
  const terms = findTerms(text);
  const nowYear = options.now.getFullYear();

  // 1. A printed end date wins: "WARRANTY UNTIL 06/2028", "EXPIRES 06/15/2028".
  for (let i = 0; i < upper.length; i += 1) {
    const near = `${upper[i - 1] ?? ""} ${upper[i]}`;
    if (!END_CUE.test(upper[i]) && !(hasWarranty && END_CUE.test(near))) continue;
    if (!hasWarranty && !/\bEXPIR/.test(near)) continue;
    const found = findDates(upper[i], { now: options.now, minYear: nowYear - 30, maxYear: nowYear + 50, allowMonthYear: true });
    const pick = found.find((f) => f.day !== undefined) ?? found[0];
    if (!pick) continue;
    const day = pick.day ?? daysInMonth(pick.year, pick.month);
    reasons.push("warranty.printed_end");
    if (pick.day === undefined) reasons.push("warranty.month_only");
    return {
      warrantyUntil: isoOf(pick.year, pick.month, day),
      confidence: hasWarranty ? (pick.day === undefined ? "medium" : "high") : "low",
      basis: "printed_end",
      termMonths: terms[0],
      terms,
      lifetime,
      needsStartDate: false,
      monthOnly: pick.day === undefined ? true : undefined,
      reasons,
    };
  }

  // 2. A length counted from the purchase or install date.
  if (terms.length > 0) {
    reasons.push("warranty.term");
    const start = options.purchaseDate ?? options.installDate;
    if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      reasons.push("warranty.no_start");
      return { confidence: "low", termMonths: terms[0], terms, lifetime, needsStartDate: true, reasons };
    }
    const [y, m, d] = start.split("-").map(Number);
    const end = addCalendarMonths(new Date(y, m - 1, d), terms[0]);
    reasons.push(options.purchaseDate ? "warranty.from_purchase" : "warranty.from_install");
    if (terms.length > 1) reasons.push("warranty.longest_of_several");
    return {
      warrantyUntil: isoOf(end.getFullYear(), end.getMonth() + 1, end.getDate()),
      confidence: terms.length > 1 ? "medium" : options.purchaseDate ? "high" : "medium",
      basis: "term_from_date",
      termMonths: terms[0],
      terms,
      lifetime,
      startDate: start,
      needsStartDate: false,
      reasons,
    };
  }

  if (lifetime) reasons.push("warranty.lifetime");
  else if (hasWarranty) reasons.push("warranty.no_term");
  else reasons.push("warranty.none");
  return { confidence: "low", terms: [], lifetime, needsStartDate: false, reasons };
}
