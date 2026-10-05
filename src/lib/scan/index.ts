import type { AssetType } from "@/lib/types";
import { appraise, type Appraisal } from "./appraise";
import type { BrandInfo } from "./brands";
import { parseLabel, type Evidence, type FilterSize, type ParsedLabel, type PrintedDate } from "./parse";
import { decodeSerial, type SerialDate } from "./serial-dates";

export { appraise, statusFor } from "./appraise";
export type { Appraisal, AgeStatus, ManufacturedAt } from "./appraise";
export { BRANDS } from "./brands";
export type { BrandInfo } from "./brands";
export { parseLabel } from "./parse";
export type { Evidence, FilterSize, ParsedLabel, PrintedDate, TypeGuess } from "./parse";
export { decodeSerial, DECODER_STATUS } from "./serial-dates";
export type { SerialDate, SerialConfidence } from "./serial-dates";

export type ManufacturedSource = "printed" | "serial";
export type Level = "high" | "medium" | "low";

export type Manufactured = {
  year: number;
  month?: number;
  source: ManufacturedSource;
  /** Only "exact" or "likely"; unknown dates are not reported. */
  confidence: "exact" | "likely";
  /** Serial rule id, when source is "serial". */
  rule?: string;
};

export type LabelReading = {
  brand?: Evidence<BrandInfo>;
  model?: Evidence<string>;
  serial?: Evidence<string>;
  filterSize?: Evidence<FilterSize>;
  /** Best guess of what the appliance is, with how the guess was made. */
  type?: { type: AssetType; basis: "words" | "brand" | "weak"; line: string };
  manufactured?: Manufactured;
  /** The two date sources disagreed by more than a year; the printed date was kept. */
  dateConflict: boolean;
  appraisal?: Appraisal;
  /** What the confirm card still has to ask the person for. */
  missing: ("type" | "date")[];
  confidence: {
    overall: Level;
    date: "exact" | "likely" | "none";
    type: Level | "none";
  };
};

function pickManufactured(
  printed: Evidence<PrintedDate> | undefined,
  serial: SerialDate | undefined,
): { manufactured?: Manufactured; conflict: boolean } {
  const fromPrinted: Manufactured | undefined = printed
    ? {
        year: printed.value.year,
        month: printed.value.month,
        source: "printed",
        confidence: printed.value.ambiguous || printed.value.month === undefined ? "likely" : "exact",
      }
    : undefined;
  const fromSerial: Manufactured | undefined =
    serial && serial.confidence !== "unknown" && serial.year !== undefined
      ? { year: serial.year, month: serial.month, source: "serial", confidence: serial.confidence, rule: serial.rule }
      : undefined;
  if (fromPrinted && fromSerial) {
    const conflict = Math.abs(fromPrinted.year - fromSerial.year) > 1;
    // Conflicting evidence is not trusted at full strength.
    return { manufactured: conflict ? { ...fromPrinted, confidence: "likely" } : fromPrinted, conflict };
  }
  return { manufactured: fromPrinted ?? fromSerial, conflict: false };
}

/** Parse the plate text, decode the date, and work out age, life and cost. Never throws. */
export function readLabel(lines: string[], now: Date = new Date()): LabelReading {
  const parsed: ParsedLabel = parseLabel(lines, now);
  const type = parsed.type?.value;
  const serialDate =
    parsed.brand && parsed.serial
      ? decodeSerial({ brandId: parsed.brand.value.id, serial: parsed.serial.value, type: type?.type, now })
      : undefined;
  const { manufactured, conflict } = pickManufactured(parsed.printedDate, serialDate);

  const appraisal =
    type && manufactured
      ? appraise({ type: type.type, manufacturedAt: { year: manufactured.year, month: manufactured.month }, now })
      : undefined;

  const dateLevel = manufactured?.confidence ?? "none";
  const typeLevel: LabelReading["confidence"]["type"] = !type
    ? "none"
    : type.basis === "words"
      ? "high"
      : type.basis === "brand"
        ? "medium"
        : "low";
  const overall: Level =
    dateLevel === "exact" && typeLevel === "high" && !conflict
      ? "high"
      : dateLevel !== "none" && (typeLevel === "high" || typeLevel === "medium")
        ? "medium"
        : "low";

  const missing: LabelReading["missing"] = [];
  if (!type) missing.push("type");
  if (!manufactured) missing.push("date");

  return {
    brand: parsed.brand,
    model: parsed.model,
    serial: parsed.serial,
    filterSize: parsed.filterSize,
    type: type && parsed.type ? { type: type.type, basis: type.basis, line: parsed.type.line } : undefined,
    manufactured,
    dateConflict: conflict,
    appraisal,
    missing,
    confidence: { overall, date: dateLevel, type: typeLevel },
  };
}
