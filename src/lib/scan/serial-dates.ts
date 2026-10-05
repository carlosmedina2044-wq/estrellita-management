import type { AssetType } from "@/lib/types";
import { BRANDS } from "./brands";
import { toDigits } from "./text";

/**
 * Serial number to manufacture date.
 *
 * HONESTY RULE: wrong is worse than unknown. A decoder returns a date only when
 * the serial matches the manufacturer's pattern exactly AND the decoded year is
 * inside the range that pattern is known to be valid for. Everything else is
 * { confidence: "unknown" } and the caller falls back to the printed date or asks.
 *
 * Confidence meaning:
 *   exact  - the scheme gives year and month directly (letter or digit month).
 *   likely - the year is certain but the month is derived from a week number, or
 *            the scheme is widely documented but not published by the maker.
 *            Also used whenever an OCR look-alike (O/0, I/1) had to be corrected.
 *
 * DECODER STATUS (see DECODER_STATUS below). Formats here were written from
 * widely published manufacturer/installer references, not checked against a
 * live source in this build. Spot-check each against a real plate before
 * trusting it in a release:
 *   implemented: rheem (and Ruud), aosmith (and State), carrier (Carrier,
 *                Bryant, Payne), goodman (and Amana HVAC only)
 *   stubbed (always "unknown"): bradford_white, trane, lennox, york, whirlpool
 *                (and Maytag, KitchenAid, Jenn-Air, Amana appliances), ge
 *                (and Hotpoint), lg, samsung, frigidaire, bosch, and the rest.
 *                Their year/month letters repeat on 10-30 year cycles or vary by
 *                plant, so a guess could be off by a decade.
 */

export type SerialConfidence = "exact" | "likely" | "unknown";

export type SerialDate = {
  year?: number;
  month?: number;
  confidence: SerialConfidence;
  /** Machine id of the rule used (or why it refused). Not user-facing. */
  rule: string;
  /** Inclusive range of years the rule is valid for (set when a rule was applied). */
  validYears?: [number, number];
  /** An O/0 or I/1 look-alike was corrected to make the serial fit. */
  corrected?: boolean;
};

export type DecoderStatus = "implemented" | "stub";

export const DECODER_STATUS: Record<string, DecoderStatus> = {
  rheem: "implemented",
  aosmith: "implemented",
  carrier: "implemented",
  goodman: "implemented",
  amana: "implemented", // HVAC only; appliance Amana is refused
  bradford_white: "stub",
  trane: "stub",
  lennox: "stub",
  york: "stub",
  whirlpool: "stub",
  ge: "stub",
  lg: "stub",
  samsung: "stub",
  frigidaire: "stub",
  bosch: "stub",
};

type DecodeInput = { brandId: string; serial: string; type?: AssetType; now?: Date };

const unknown = (rule: string): SerialDate => ({ confidence: "unknown", rule });

const HVAC_TYPES: AssetType[] = ["hvac_system", "furnace", "hvac"];

function familyOf(brandId: string): string | undefined {
  return BRANDS.find((b) => b.id === brandId)?.family;
}

/** Real month for an ISO-ish week number (1-53), taken at mid-week. */
function monthOfWeek(year: number, week: number): number {
  const date = new Date(year, 0, 1 + (week - 1) * 7 + 3);
  return date.getFullYear() === year ? date.getMonth() + 1 : week > 26 ? 12 : 1;
}

/** Slice of `serial` that must be digits; returns undefined if it cannot be. */
function digitsAt(serial: string, start: number, length: number): { value: number; corrected: boolean } | undefined {
  const raw = serial.slice(start, start + length);
  if (raw.length !== length) return undefined;
  const fixed = toDigits(raw);
  if (!/^\d+$/.test(fixed)) return undefined;
  return { value: Number(fixed), corrected: fixed !== raw };
}

// Rheem / Ruud tank water heaters.
// Serial = month letter (A=Jan ... L=Dec, no letters skipped), 2-digit year, then
// the unit number. "M" and beyond are not months, so such serials are refused.
// Valid 2000 to now. Not applied to Rheem furnaces or AC, which use other schemes.
function decodeRheem(serial: string, type: AssetType | undefined, now: Date): SerialDate {
  if (type && type !== "water_heater") return unknown("rheem-not-water-heater");
  const first = serial[0];
  const letter = first === "1" ? "I" : first;
  if (!/^[A-Z]$/.test(letter)) return unknown("rheem-no-month-letter");
  const monthIndex = "ABCDEFGHIJKL".indexOf(letter);
  if (monthIndex < 0) return unknown("rheem-month-letter-invalid");
  const yy = digitsAt(serial, 1, 2);
  if (!yy) return unknown("rheem-year-not-digits");
  if (!/^\d{5,9}$/.test(toDigits(serial.slice(3)))) return unknown("rheem-pattern");
  const year = 2000 + yy.value;
  if (year > now.getFullYear()) return unknown("rheem-year-out-of-range");
  const corrected = first === "1" || yy.corrected || toDigits(serial.slice(3)) !== serial.slice(3);
  return {
    year,
    month: monthIndex + 1,
    confidence: corrected ? "likely" : "exact",
    rule: "rheem-letter-month-yy",
    validYears: [2000, now.getFullYear()],
    corrected: corrected || undefined,
  };
}

// A. O. Smith / State: YYWW then a letter and the unit number, e.g. 1214M123456.
// Year is certain; month is derived from the week, so confidence is "likely".
function decodeAoSmith(serial: string, now: Date): SerialDate {
  if (!/^[0-9OIL]{4}[A-Z][0-9OIL]{5,7}$/.test(serial)) return unknown("aosmith-pattern");
  const yy = digitsAt(serial, 0, 2);
  const ww = digitsAt(serial, 2, 2);
  if (!yy || !ww) return unknown("aosmith-pattern");
  const year = 2000 + yy.value;
  if (year > now.getFullYear()) return unknown("aosmith-year-out-of-range");
  if (ww.value < 1 || ww.value > 53) return unknown("aosmith-week-invalid");
  return {
    year,
    month: monthOfWeek(year, ww.value),
    confidence: "likely",
    rule: "aosmith-yyww",
    validYears: [2000, now.getFullYear()],
    corrected: yy.corrected || ww.corrected || undefined,
  };
}

// Carrier / Bryant / Payne: WWYY then a letter and a 5-digit unit number, e.g. 2514A12345.
function decodeCarrier(serial: string, now: Date): SerialDate {
  if (!/^[0-9OIL]{4}[A-Z][0-9OIL]{5}$/.test(serial)) return unknown("carrier-pattern");
  const ww = digitsAt(serial, 0, 2);
  const yy = digitsAt(serial, 2, 2);
  if (!ww || !yy) return unknown("carrier-pattern");
  const year = 2000 + yy.value;
  if (year > now.getFullYear()) return unknown("carrier-year-out-of-range");
  if (ww.value < 1 || ww.value > 53) return unknown("carrier-week-invalid");
  return {
    year,
    month: monthOfWeek(year, ww.value),
    confidence: "likely",
    rule: "carrier-wwyy",
    validYears: [2000, now.getFullYear()],
    corrected: yy.corrected || ww.corrected || undefined,
  };
}

// Goodman (and Amana-brand HVAC): first four digits are YYMM, e.g. 1305123456 = May 2013.
function decodeGoodman(serial: string, now: Date): SerialDate {
  if (!/^[0-9OIL]{8,10}[A-Z]?$/.test(serial)) return unknown("goodman-pattern");
  const yy = digitsAt(serial, 0, 2);
  const mm = digitsAt(serial, 2, 2);
  if (!yy || !mm) return unknown("goodman-pattern");
  const year = 2000 + yy.value;
  if (year > now.getFullYear()) return unknown("goodman-year-out-of-range");
  if (mm.value < 1 || mm.value > 12) return unknown("goodman-month-invalid");
  if (year === now.getFullYear() && mm.value > now.getMonth() + 2) return unknown("goodman-future");
  return {
    year,
    month: mm.value,
    confidence: "likely",
    rule: "goodman-yymm",
    validYears: [2000, now.getFullYear()],
    corrected: yy.corrected || mm.corrected || undefined,
  };
}

export function decodeSerial({ brandId, serial, type, now = new Date() }: DecodeInput): SerialDate {
  const clean = serial.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length < 6) return unknown("too-short");
  const family = familyOf(brandId);
  switch (family) {
    case "rheem":
      return decodeRheem(clean, type, now);
    case "aosmith":
      return decodeAoSmith(clean, now);
    case "carrier":
      return decodeCarrier(clean, now);
    case "goodman":
      return decodeGoodman(clean, now);
    case "amana":
      // Amana HVAC is Goodman-built; Amana kitchen appliances are Whirlpool-built and not decoded.
      return type && HVAC_TYPES.includes(type) ? decodeGoodman(clean, now) : unknown("amana-appliance-not-supported");
    default:
      return unknown(family && DECODER_STATUS[family] === "stub" ? `${family}-stub` : "brand-not-supported");
  }
}
