import {
  aiAvailable,
  aiStructureLabel,
  aiStructureReceipt,
  type AiLabel,
  type AiReceipt,
} from "@/lib/native/intelligence";
import { appraise } from "@/lib/scan/appraise";
import type { AssetType, Household, SupplyAutomation } from "@/lib/types";
import { hasValidCheckDigit, findByBarcode, normalizeBarcode } from "./barcode";
import { parseFilterSize, type ParsedFilterSize } from "./filter";
import { readLabel, type LabelReading } from "./index";
import { parseReceipt, matchReceipt, type ParsedReceipt, type ReceiptLine, type ReceiptLineMatch } from "./receipt";
import { classifyScan, type ScanKind } from "./route";
import { cleanLine } from "./text";
import { readWarranty, type WarrantyReading } from "./warranty-read";
import type { ConfirmedReceiptLine } from "./apply-receipt";

/**
 * The reader sheet's brain, with no React in it. Everything here is pure except
 * `enrichWithAi`, which asks the on-device model for help and always falls back
 * to the plain read. The model only fills gaps: dates and money that the plain
 * reader found are never replaced.
 */

export type ReadKind = Exclude<ScanKind, "unknown">;

export type Capture = { lines: string[]; barcodes: string[] };

/** Where a field came from, so a card can say "Read with Apple Intelligence". */
export type AiFilled = "brand" | "model" | "serial" | "type" | "date" | "store" | "total" | "match";

export type LabelRead = { kind: "label"; reading: LabelReading; aiFilled: AiFilled[] };

export type ReaderLine = ReceiptLineMatch & { viaAi?: boolean };
export type ReceiptRead = {
  kind: "receipt";
  receipt: ParsedReceipt;
  /** Store, date and total after any gaps were filled. */
  store?: string;
  date?: string;
  total?: number;
  lines: ReaderLine[];
  aiFilled: AiFilled[];
};
export type FilterRead = { kind: "filter"; size: ParsedFilterSize; aiFilled: AiFilled[] };
export type ProductRead = {
  kind: "product";
  barcode: string;
  /** The tracked supply this box was taught to, when it has been seen before. */
  known?: SupplyAutomation;
};
export type WarrantyRead = { kind: "warranty"; reading: WarrantyReading };

export type Read = LabelRead | ReceiptRead | FilterRead | ProductRead | WarrantyRead;

export type Decision =
  | { kind: ReadKind; confident: boolean }
  | { kind: "ask"; candidates: ReadKind[] }
  | { kind: "none" };

// ---------- capture ----------

/** A line that is only a barcode number (typed or pasted). Check digit must pass. */
export function barcodesFromLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const digits = line.replace(/[\s-]/g, "");
    const code = /^\d+$/.test(digits) ? normalizeBarcode(digits) : null;
    if (code && hasValidCheckDigit(code) && !out.includes(code)) out.push(code);
  }
  return out;
}

/** Splits pasted text into lines, dropping blanks. */
export function linesOfText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => cleanLine(line))
    .filter(Boolean);
}

export function makeCapture(lines: string[], barcodes: string[] = []): Capture {
  const all = [...barcodes.map((b) => normalizeBarcode(b)).filter((b): b is string => Boolean(b))];
  for (const typed of barcodesFromLines(lines)) if (!all.includes(typed)) all.push(typed);
  return { lines, barcodes: all };
}

// ---------- deciding ----------

/** At most this many choices in the "which is it?" question. */
const MAX_CHOICES = 3;

export function decideKind(capture: Capture): Decision {
  const result = classifyScan({ lines: capture.lines, barcodes: capture.barcodes });
  if (result.kind !== "unknown") return { kind: result.kind, confident: result.confidence !== "low" };
  const candidates = result.candidates.slice(0, MAX_CHOICES).map((c) => c.kind);
  if (candidates.length >= 2) return { kind: "ask", candidates };
  if (candidates.length === 1) return { kind: candidates[0], confident: false };
  return { kind: "none" };
}

// ---------- reading, plain rules only ----------

function hasAnything(reading: LabelReading): boolean {
  return Boolean(reading.brand || reading.model || reading.serial || reading.type || reading.manufactured);
}

/** Reads a capture as the given kind. Null when nothing usable came out. Never throws. */
export function readAs(kind: ReadKind, capture: Capture, household: Household, now: Date): Read | null {
  try {
    if (kind === "label") {
      const reading = readLabel(capture.lines, now);
      return hasAnything(reading) ? { kind, reading, aiFilled: [] } : null;
    }
    if (kind === "receipt") {
      const receipt = parseReceipt(capture.lines, now);
      if (receipt.lines.length === 0 && receipt.total === undefined) return null;
      const matches = matchReceipt(receipt, household);
      return {
        kind,
        receipt,
        store: receipt.store,
        date: receipt.date,
        total: receipt.total,
        lines: matches,
        aiFilled: [],
      };
    }
    if (kind === "filter") {
      const size = parseFilterSize(capture.lines);
      return size ? { kind, size, aiFilled: [] } : null;
    }
    if (kind === "product") {
      const barcode = capture.barcodes[0];
      if (!barcode) return null;
      return { kind, barcode, known: findByBarcode(household, barcode) };
    }
    const reading = readWarranty(capture.lines, { now });
    const usable = reading.warrantyUntil || reading.needsStartDate || reading.lifetime || reading.terms.length > 0;
    return usable ? { kind: "warranty", reading } : null;
  } catch {
    return null;
  }
}

/** Re-reads a warranty once the person gives the purchase date. */
export function rereadWarranty(capture: Capture, now: Date, purchaseDate: string): WarrantyRead {
  return { kind: "warranty", reading: readWarranty(capture.lines, { now, purchaseDate }) };
}

// ---------- when to ask the model ----------

export function needsHelp(read: Read): boolean {
  if (read.kind === "label") {
    return read.reading.confidence.overall !== "high" || read.reading.missing.length > 0 || !read.reading.model;
  }
  if (read.kind === "receipt") {
    const unmatched = read.lines.some((l) => l.status === "none" && !l.line.discount && l.line.price > 0);
    return (
      read.receipt.confidence !== "high" ||
      unmatched ||
      read.store === undefined ||
      read.date === undefined ||
      read.total === undefined
    );
  }
  return false;
}

// ---------- merging the model's proposal ----------

function monthYearLine(year: number, month?: number): string {
  return month ? `MFG DATE: ${String(month).padStart(2, "0")}/${year}` : `MFG DATE: ${year}`;
}

/**
 * Fills only what the plain reader left empty. The model's values go back through
 * the same reader as extra plate lines, so serial decoding and the age maths still
 * run in tested code.
 */
export function mergeLabel(read: LabelRead, ai: AiLabel, lines: string[], now: Date): LabelRead {
  const before = read.reading;
  const extra: string[] = [];
  if (!before.brand && ai.brand) extra.push(ai.brand);
  if (!before.model && ai.model) extra.push(`MODEL NO. ${ai.model}`);
  if (!before.serial && ai.serial) extra.push(`SERIAL NO. ${ai.serial}`);
  if (!before.manufactured && ai.manufacturedYear) extra.push(monthYearLine(ai.manufacturedYear, ai.manufacturedMonth));

  let next = extra.length > 0 ? readLabel([...lines, ...extra], now) : before;
  if (!next.type && ai.type) {
    const type: AssetType = ai.type;
    const appraisal = next.manufactured
      ? appraise({ type, manufacturedAt: { year: next.manufactured.year, month: next.manufactured.month }, now })
      : undefined;
    next = {
      ...next,
      type: { type, basis: "weak", line: "" },
      appraisal,
      missing: next.missing.filter((m) => m !== "type"),
      confidence: { ...next.confidence, type: "low" },
    };
  }

  const filled: AiFilled[] = [];
  if (!before.brand && next.brand) filled.push("brand");
  if (!before.model && next.model) filled.push("model");
  if (!before.serial && next.serial) filled.push("serial");
  if (!before.type && next.type) filled.push("type");
  if (!before.manufactured && next.manufactured) filled.push("date");
  return filled.length === 0 ? read : { kind: "label", reading: next, aiFilled: [...read.aiFilled, ...filled] };
}

function cents(n: number): number {
  return Math.round(n * 100);
}

function sameWords(a: string, b: string): boolean {
  const words = (s: string) => new Set(s.toUpperCase().split(/[^A-Z0-9]+/).filter((w) => w.length > 2));
  const wa = words(a);
  for (const w of words(b)) if (wa.has(w)) return true;
  return false;
}

/**
 * Fills the store, date and total only when the plain reader found none, and
 * offers a tracked supply for lines the plain matcher gave up on. A model match
 * is only ever a "maybe": it starts unticked, so a person decides.
 */
export function mergeReceipt(read: ReceiptRead, ai: AiReceipt, household: Household): ReceiptRead {
  const filled: AiFilled[] = [...read.aiFilled];
  let { store, date, total } = read;
  if (store === undefined && ai.store) {
    store = ai.store;
    filled.push("store");
  }
  if (date === undefined && ai.date) {
    date = ai.date;
    filled.push("date");
  }
  if (total === undefined && ai.total !== undefined) {
    total = ai.total;
    filled.push("total");
  }

  let lines: ReaderLine[] = read.lines;
  if (lines.length === 0 && ai.items.length > 0) {
    // The plain reader found no lines at all: build them from the model's, priced ones only.
    const built: ReceiptLine[] = ai.items
      .filter((item) => item.price !== undefined && item.price > 0)
      .map((item) => ({ name: item.name, raw: item.name, qty: item.qty ?? 1, price: item.price as number }));
    lines = matchReceipt({ lines: built }, household).map((m) => ({ ...m, viaAi: true }));
    if (lines.length > 0) filled.push("match");
  }

  const used = new Set<number>();
  let matchedByAi = false;
  lines = lines.map((entry) => {
    if (entry.viaAi && entry.match) return entry;
    if (entry.status !== "none" || entry.line.discount || entry.line.price <= 0) return entry;
    let pick = -1;
    ai.items.forEach((item, index) => {
      if (used.has(index) || !item.matchesTracked || item.price === undefined) return;
      if (cents(item.price) !== cents(entry.line.price)) return;
      if (pick === -1 || sameWords(item.name, entry.line.raw)) pick = index;
    });
    if (pick === -1) return entry;
    const target = household.supplyAutomations.find(
      (a) => a.itemName.toLowerCase() === ai.items[pick].matchesTracked?.toLowerCase(),
    );
    if (!target) return entry;
    used.add(pick);
    matchedByAi = true;
    return { ...entry, match: { automationId: target.id, score: 0.6, via: "name" as const }, status: "maybe" as const, preChecked: false, viaAi: true };
  });
  if (matchedByAi && !filled.includes("match")) filled.push("match");

  if (filled.length === read.aiFilled.length && lines === read.lines) return read;
  return { ...read, store, date, total, lines, aiFilled: filled };
}

// ---------- asking the model, never blocking ----------

export const AI_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/**
 * When the plain read is shaky and Apple Intelligence is on, asks it to fill the gaps.
 * Returns the same read after about 8 seconds, or at once when it is off or fails.
 */
export async function enrichWithAi(
  read: Read,
  capture: Capture,
  household: Household,
  now: Date,
  timeoutMs: number = AI_TIMEOUT_MS,
): Promise<Read> {
  if ((read.kind !== "label" && read.kind !== "receipt") || !needsHelp(read)) return read;
  const job = (async (): Promise<Read> => {
    const availability = await aiAvailable();
    if (!availability.available) return read;
    if (read.kind === "label") {
      const result = await aiStructureLabel(capture.lines);
      return result.ok ? mergeLabel(read, result.label, capture.lines, now) : read;
    }
    const names = household.supplyAutomations.map((a) => a.itemName);
    const result = await aiStructureReceipt(capture.lines, names);
    return result.ok ? mergeReceipt(read, result.receipt, household) : read;
  })();
  return (await withTimeout(job, timeoutMs)) ?? read;
}

// ---------- receipt helpers ----------

/** A line the person can tick: it has something tracked behind it. */
export function isTickable(line: ReaderLine): boolean {
  return line.status !== "none" && Boolean(line.match?.automationId || line.match?.consumableId);
}

export function startingTicks(lines: ReaderLine[]): Set<number> {
  const out = new Set<number>();
  lines.forEach((line, index) => {
    if (isTickable(line) && line.preChecked) out.add(index);
  });
  return out;
}

/**
 * The lines the person ticked, ready for applyReceipt. A restock item is topped up by
 * its usual order size per pack bought (what the Restock "arrived" button offers),
 * not by the 1 the receipt prints, so a bought pack never leaves it running low.
 */
export function confirmedLines(
  lines: ReaderLine[],
  ticked: ReadonlySet<number>,
  household?: Pick<Household, "supplyAutomations">,
): ConfirmedReceiptLine[] {
  const out: ConfirmedReceiptLine[] = [];
  lines.forEach((entry, index) => {
    if (!ticked.has(index) || !isTickable(entry) || !entry.match) return;
    const item = entry.match.automationId
      ? household?.supplyAutomations.find((a) => a.id === entry.match?.automationId)
      : undefined;
    const packs = Math.max(1, Math.round(entry.line.qty) || 1);
    const qty = item ? Math.min(99, packs * Math.max(1, item.qtyPerOrder || 1)) : entry.line.qty;
    out.push({
      line: { name: entry.line.name, qty, price: entry.line.price },
      automationId: entry.match.automationId,
      consumableId: entry.match.automationId ? undefined : entry.match.consumableId,
    });
  });
  return out;
}

/** What the toast says: how many were marked, and the money that now counts. */
export function receiptTotals(confirmed: ConfirmedReceiptLine[]): { count: number; amount: number } {
  let amount = 0;
  for (const c of confirmed) if (Number.isFinite(c.line.price) && c.line.price > 0) amount += c.line.price;
  return { count: confirmed.length, amount: Math.round(amount * 100) / 100 };
}
