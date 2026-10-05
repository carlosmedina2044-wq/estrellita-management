import type { Household } from "@/lib/types";
import { findDates } from "./us-date";
import { normalizeBarcode, sameBarcode } from "./barcode";
import { cleanLine } from "./text";

/**
 * Receipt reading and matching. Money is USD dollars (numbers with two
 * decimals); nothing here returns an English sentence. OCR on receipts is
 * messy, so every field is optional and `confidence` says how far to trust the
 * whole read. The confirm card always has the last word.
 */

export type ReceiptLevel = "high" | "medium" | "low";

export type ReceiptLine = {
  /** The item as printed, cleaned of codes, prices and quantity marks. */
  name: string;
  /** The whole printed line, kept as evidence (and for UPC matching). */
  raw: string;
  qty: number;
  /** What was paid for the line, in dollars. Negative for a discount. */
  price: number;
  /** Price of one, when the receipt printed "2 @ 4.99". */
  unitPrice?: number;
  /** A coupon or discount line. Never an item; matching skips it. */
  discount?: boolean;
};

export type ParsedReceipt = {
  store?: string;
  /** True when the store matched a known chain; false when it is just the first line of text. */
  storeKnown?: boolean;
  /** "YYYY-MM-DD" */
  date?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  lines: ReceiptLine[];
  /** Items add up to the subtotal (or total minus tax). null when there was nothing to check against. */
  sumMatches: boolean | null;
  confidence: ReceiptLevel;
};

// ---------- money ----------

const TAIL = /(-)?\s?\$?\s?((?:\d{1,3}(?:,\d{3})+|[\dO]{1,5})\s?[.,]\s?[\dO]{2})\s*(-|CR)?\s*(?:[A-Z]{1,2})?\s*$/i;

/** "4.99", "4,99", "1,234.50", "$ 4 .99" to dollars. */
export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/[$\s]/g, "").replace(/O/gi, "0");
  const m = /^(\d{1,3}(?:,\d{3})+|\d+)[.,](\d{2})$/.exec(cleaned);
  if (!m) return null;
  const n = Number(`${m[1].replace(/,/g, "")}.${m[2]}`);
  return Number.isFinite(n) ? n : null;
}

type Tail = { amount: number; negative: boolean; index: number };

function priceTail(line: string): Tail | null {
  const m = TAIL.exec(line);
  if (!m) return null;
  const digits = m[2];
  if (!/\d/.test(digits.replace(/O/gi, ""))) return null;
  const amount = parseMoney(digits);
  if (amount === null) return null;
  return { amount, negative: Boolean(m[1]) || Boolean(m[3]), index: m.index };
}

// ---------- line vocabulary ----------

const SUBTOTAL_RE = /\bSUB-?\s?TOTAL\b/;
const TOTAL_RE = /\b(?:GRAND\s+)?TOTAL\b|\bAMOUNT DUE\b|\bBALANCE DUE\b|\bTOTAL DUE\b/;
const TOTAL_NOT = /TOTAL\s+(?:SAVINGS|SAVED|DISCOUNTS?|COUPONS?|ITEMS?|NUMBER|SOLD|TAX|POINTS)|ITEMS?\s+TOTAL|YOU SAVED|SAVINGS\s+TOTAL/;
const TAX_RE = /\b(?:SALES\s+)?TAX\b|\bHST\b|\bGST\b|\bVAT\b/;
const TENDER_RE = /\b(CHANGE(?: DUE)?|CASH|VISA|MASTERCARD|MASTER CARD|MC|AMEX|DISCOVER|DEBIT|CREDIT|TENDER(?:ED)?|CARD|APPROVED|AUTH(?:ORIZATION)?|PAID|BALANCE|ACCT|ACCOUNT|EBT|GIFT)\b|\*{3,}\s?\d{4}/;
const META_RE = /\b(ITEMS? SOLD|TERMINAL|REF|TRANS(?:ACTION)?|REGISTER|CASHIER|STORE|PHONE|TEL|THANK|WELCOME|RETURN|POLICY|SURVEY|REWARDS?|MEMBER|ST#|OP#|TE#|TR#)\b/;
const DISCOUNT_RE = /\b(COUPON|DISCOUNT|DISC|INSTANT SAVINGS|SAVINGS|PROMO(?:TION)?|MFR|REBATE|MARKDOWN|REDUCED|BOGO|OFF)\b/;

const STORES: [RegExp, string][] = [
  [/HOME\s?DEPOT/, "The Home Depot"],
  [/LOWE'?S/, "Lowe's"],
  [/WAL-?\s?MART/, "Walmart"],
  [/\bTARGET\b/, "Target"],
  [/COSTCO/, "Costco"],
  [/KROGER/, "Kroger"],
  [/SAFEWAY/, "Safeway"],
  [/TRADER\s?JOE/, "Trader Joe's"],
  [/WHOLE\s?FOODS/, "Whole Foods"],
  [/\bACE\s+HARDWARE\b|\bACE\b.*\bHARDWARE\b/, "Ace Hardware"],
  [/TRUE\s?VALUE/, "True Value"],
  [/MENARDS?/, "Menards"],
  [/\bCVS\b/, "CVS"],
  [/WALGREENS/, "Walgreens"],
  [/PUBLIX/, "Publix"],
  [/\bALDI\b/, "Aldi"],
  [/\bH-?E-?B\b/, "H-E-B"],
  [/SAM'?S\s?CLUB/, "Sam's Club"],
  [/DOLLAR\s?GENERAL/, "Dollar General"],
  [/DOLLAR\s?TREE/, "Dollar Tree"],
  [/BEST\s?BUY/, "Best Buy"],
  [/AMAZON/, "Amazon"],
  [/WINCO/, "WinCo"],
  [/MEIJER/, "Meijer"],
  [/RITE\s?AID/, "Rite Aid"],
  [/HARRIS\s?TEETER/, "Harris Teeter"],
];

// ---------- quantity ----------

const AT_RE = /(?<![\d.])(\d{1,2})\s*@\s*\$?\s?(\d{1,4}[.,]\d{2})/;
const QTY_WORD = /\bQTY[:\s]*(\d{1,2})\b/;
const X_AFTER = /(?<![\dxX])[xX]\s?(\d{1,2})(?![\d.xX])/;
const X_BEFORE = /(?<![\dxX.])(\d{1,2})\s?[xX](?![\dxXA-Za-z])/;
const WEIGHT_RE = /\d+(?:\.\d+)?\s*(?:LB|LBS|OZ|KG|G)\b\s*@/i;

function clampQty(n: number): number {
  return Number.isInteger(n) && n >= 1 && n <= 99 ? n : 1;
}

function stripLineNoise(text: string): string {
  return text
    .replace(AT_RE, " ")
    .replace(WEIGHT_RE, " ")
    .replace(QTY_WORD, " ")
    .replace(X_AFTER, " ")
    .replace(X_BEFORE, " ")
    .replace(/\d{8,}/g, " ") // UPC / SKU runs
    .replace(/^\s*(?:\d{3,7}[-\s])+/, " ") // a leading item number
    .replace(/(?:\s|^)(?:[FNTXAB]|TX)(?=\s|$)/g, " ") // trailing tax flags printed before the price
    .replace(/[@*#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const letters = (s: string) => (s.match(/[A-Za-z]/g) ?? []).length;

type Cursor = { pending?: string };

// ---------- the parser ----------

function isoDay(now: Date, plusDays = 0): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + plusDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function findReceiptDate(lines: string[], now: Date): string | undefined {
  const latest = isoDay(now, 1);
  for (const line of lines) {
    if (/\b(RETURN|EXPIRES?|VALID|THRU|BEFORE|DUE BY|OFFER)\b/i.test(line)) continue;
    for (const found of findDates(line, { now, minYear: now.getFullYear() - 15, maxYear: now.getFullYear() })) {
      if (found.iso && found.iso <= latest) return found.iso;
    }
  }
  return undefined;
}

function findStore(lines: string[]): { store?: string; known?: boolean } {
  const head = lines.slice(0, 10);
  for (const line of head) {
    const upper = line.toUpperCase();
    for (const [re, name] of STORES) if (re.test(upper)) return { store: name, known: true };
  }
  for (const line of lines.slice(0, 4)) {
    const upper = line.toUpperCase();
    if (letters(line) < 4 || priceTail(line) || findDates(line, { now: new Date() }).length > 0) continue;
    if (letters(line) / line.replace(/\s/g, "").length < 0.7) continue;
    if (/\b(RECEIPT|WELCOME|THANK|STORE|PHONE|TEL|ST#)\b/.test(upper)) continue;
    return { store: line, known: false };
  }
  return {};
}

/**
 * Receipt OCR swaps O and 0 inside words ("T0TAL", "P0DS") and inside numbers
 * ("2OX25X1", "6OCT", "14.4O"). Fix them token by token, only where the rest
 * of the token makes the intent clear.
 */
export function fixOcrTokens(line: string): string {
  return line
    .split(" ")
    .map((token) => {
      if (/^[A-Z0]{3,}$/.test(token) && /[A-Z]{2}/.test(token) && token.includes("0")) return token.replace(/0/g, "O");
      if (/^[\dO]+(?:[xX][\dO]+)+$/.test(token) && /\d/.test(token)) return token.replace(/O/g, "0");
      if (/^\d[\dO]*(?:CT|PK|OZ)$/i.test(token)) return token.replace(/O(?=[\dO]*[A-Za-z]{2}$)/g, "0");
      if (/^\$?[\dO]+[.,][\dO]{2}[A-Z-]?$/.test(token) && /\d/.test(token)) return token.replace(/O/g, "0");
      return token;
    })
    .join(" ");
}

export function parseReceipt(rawLines: string[], now: Date = new Date()): ParsedReceipt {
  const lines = rawLines.map(cleanLine).filter(Boolean).map(fixOcrTokens);
  const out: ReceiptLine[] = [];
  const cursor: Cursor = {};

  let subtotal: number | undefined;
  let tax: number | undefined;
  const totals: number[] = [];
  let itemsOpen = true;

  /** Amount on this line, or on the next one when the label and number were read apart. */
  const amountAt = (i: number): number | undefined => {
    const own = priceTail(lines[i]);
    if (own) return own.amount;
    const next = lines[i + 1];
    if (next && letters(next) === 0) return priceTail(next)?.amount;
    return undefined;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const upper = line.toUpperCase();

    if (SUBTOTAL_RE.test(upper)) {
      const amount = amountAt(i);
      if (amount !== undefined && subtotal === undefined) subtotal = amount;
      itemsOpen = false;
      cursor.pending = undefined;
      continue;
    }
    if (TAX_RE.test(upper) && !/\bTAXABLE\b/.test(upper)) {
      const amount = amountAt(i);
      if (amount !== undefined && tax === undefined) tax = amount;
      if (itemsOpen && subtotal === undefined) itemsOpen = false; // tax before subtotal: items are over
      cursor.pending = undefined;
      continue;
    }
    if (TOTAL_RE.test(upper) && !TOTAL_NOT.test(upper)) {
      const amount = amountAt(i);
      if (amount !== undefined) totals.push(amount);
      itemsOpen = false;
      cursor.pending = undefined;
      continue;
    }
    if (TENDER_RE.test(upper) || (META_RE.test(upper) && !priceTail(line))) {
      cursor.pending = undefined;
      // A tender line before any subtotal still ends the item list.
      if (TENDER_RE.test(upper) && out.length > 0) itemsOpen = false;
      continue;
    }
    if (!itemsOpen) continue;
    if (/\b(TOTAL SAVINGS|YOU SAVED)\b/.test(upper)) continue;

    const tail = priceTail(line);
    const body = tail ? line.slice(0, tail.index).trim() : line;

    // "2 @ 4.99" (alone, or after a name that came without a price)
    const at = AT_RE.exec(body);
    const weighted = WEIGHT_RE.test(body);
    const atQty = at && !weighted ? clampQty(Number(at[1])) : undefined;
    const atUnit = at && !weighted ? parseMoney(at[2]) ?? undefined : undefined;
    const qtyMark = atQty ?? clampQty(Number((QTY_WORD.exec(body) ?? X_AFTER.exec(body) ?? X_BEFORE.exec(body))?.[1] ?? 1));
    const name = stripLineNoise(body);

    if (!tail) {
      if (at && !weighted && letters(name) < 3 && cursor.pending && atUnit !== undefined) {
        // name line, then "2 @ 4.99" with no extended price: compute it
        out.push({ name: cursor.pending, raw: `${cursor.pending} ${line}`, qty: atQty ?? 1, unitPrice: atUnit, price: round2((atQty ?? 1) * atUnit) });
        cursor.pending = undefined;
      } else if (letters(name) >= 3) {
        cursor.pending = name;
      }
      continue;
    }

    let price = tail.negative ? -tail.amount : tail.amount;
    const itemName = letters(name) >= 3 ? name : "";

    if (!itemName) {
      // price only, or "2 @ 4.99    9.98" under a name-only line
      if (cursor.pending) {
        out.push({
          name: cursor.pending,
          raw: `${cursor.pending} ${line}`,
          qty: qtyMark,
          unitPrice: atUnit,
          price,
          discount: price < 0 || DISCOUNT_RE.test(cursor.pending.toUpperCase()) ? true : undefined,
        });
        cursor.pending = undefined;
      } else if (at && out.length > 0 && !weighted) {
        // "2 @ 4.99    9.98" straight after the item it belongs to
        const last = out[out.length - 1];
        if (!last.discount && Math.abs(last.price - tail.amount) < 0.011 && last.qty === 1 && atQty && atQty > 1) {
          last.qty = atQty;
          last.unitPrice = atUnit;
        }
      }
      continue;
    }

    const isDiscount = price < 0 || DISCOUNT_RE.test(itemName.toUpperCase());
    if (isDiscount && price > 0) price = -price;
    out.push({
      name: itemName,
      raw: line,
      qty: isDiscount ? 1 : qtyMark,
      unitPrice: isDiscount ? undefined : atUnit,
      price,
      discount: isDiscount ? true : undefined,
    });
    cursor.pending = undefined;
  }

  const items = out.filter((l) => !l.discount);
  const sum = round2(out.reduce((acc, l) => acc + l.price, 0));
  const total = pickTotal(totals, subtotal, tax);
  const checkAgainst = subtotal ?? (total !== undefined && tax !== undefined ? round2(total - tax) : undefined);
  const sumMatches = checkAgainst === undefined || out.length === 0 ? null : Math.abs(sum - checkAgainst) <= Math.max(0.05, checkAgainst * 0.02);

  const { store, known } = findStore(lines);
  const date = findReceiptDate(lines, now);

  let confidence: ReceiptLevel = "low";
  if (items.length >= 1 && sumMatches === true && (total !== undefined || subtotal !== undefined)) confidence = "high";
  else if (items.length >= 2 && total !== undefined && store && date) confidence = "high";
  else if (items.length >= 1 && (total !== undefined || store || date)) confidence = "medium";
  if (sumMatches === false && confidence === "high") confidence = "medium";

  return { store, storeKnown: store ? known : undefined, date, subtotal, tax, total, lines: out, sumMatches, confidence };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Several "TOTAL" lines can appear; the one that equals subtotal + tax wins, else the first. */
function pickTotal(totals: number[], subtotal?: number, tax?: number): number | undefined {
  if (totals.length === 0) return subtotal !== undefined && tax !== undefined ? round2(subtotal + tax) : undefined;
  if (subtotal !== undefined && tax !== undefined) {
    const expected = round2(subtotal + tax);
    const exact = totals.find((t) => Math.abs(t - expected) <= 0.02);
    if (exact !== undefined) return exact;
  }
  return totals[0];
}

// ---------- matching ----------

export type ReceiptMatchStatus = "matched" | "maybe" | "none";

export type ReceiptTarget = {
  automationId?: string;
  consumableId?: string;
  /** 0 to 1. */
  score: number;
  via: "barcode" | "name" | "size";
};

export type ReceiptLineMatch = {
  line: ReceiptLine;
  match?: ReceiptTarget;
  status: ReceiptMatchStatus;
  /** Only a high-scoring match may start ticked. "maybe" always starts unticked. */
  preChecked: boolean;
};

export const MATCHED_AT = 0.85;
export const MAYBE_AT = 0.5;
/** Two different candidates this close make the answer a "maybe". */
const AMBIGUITY_GAP = 0.1;

const ABBREVIATIONS: Record<string, string[]> = {
  DET: ["DETERGENT"], DETERG: ["DETERGENT"], DETGNT: ["DETERGENT"],
  PODS: ["POD"], PAC: ["POD"], PACS: ["POD"],
  FLTR: ["FILTER"], FLT: ["FILTER"], FILT: ["FILTER"], FLTRS: ["FILTER"],
  TP: ["TOILET", "PAPER"], TOIL: ["TOILET"], TLT: ["TOILET"],
  PT: ["PAPER", "TOWEL"], PTWL: ["PAPER", "TOWEL"],
  PPR: ["PAPER"], PAP: ["PAPER"], TWL: ["TOWEL"], TWLS: ["TOWEL"], TOW: ["TOWEL"], TWEL: ["TOWEL"],
  BTH: ["BATH"], TISS: ["TISSUE"], TSSU: ["TISSUE"],
  DW: ["DISHWASHER"], DSHWSHR: ["DISHWASHER"], DISHWSHR: ["DISHWASHER"], DSHWSH: ["DISHWASHER"],
  LNDRY: ["LAUNDRY"], LDRY: ["LAUNDRY"], LAUND: ["LAUNDRY"],
  SFTNR: ["SOFTENER"], SOFTNR: ["SOFTENER"], SOFTENR: ["SOFTENER"],
  SPNG: ["SPONGE"], SPNGS: ["SPONGE"], BTRY: ["BATTERY"], BATT: ["BATTERY"], BTRYS: ["BATTERY"],
  TRSH: ["TRASH"], GARB: ["TRASH"], GARBAGE: ["TRASH"], BG: ["BAG"], BGS: ["BAG"],
  WTR: ["WATER"], CLNR: ["CLEANER"], CLNSR: ["CLEANER"], DISINF: ["DISINFECTING"], DISINFCT: ["DISINFECTING"],
  WP: ["WIPE"], WPS: ["WIPE"], BLCH: ["BLEACH"], SHMP: ["SHAMPOO"],
  // A furnace, HVAC or AC filter is "an air filter" to everyone.
  FURNACE: ["AIR"], HVAC: ["AIR"], AC: ["AIR"], FURN: ["AIR"],
};

const DROP = new Set([
  "AND", "THE", "OF", "FOR", "WITH", "W", "PK", "PACK", "PKG", "CT", "CNT", "COUNT", "OZ", "LB", "LBS", "GAL", "EA", "EACH", "PC", "PCS", "PIECE",
  "ROLL", "SHEET", "LOAD", "FL", "QT", "SIZE", "XL", "XXL", "MEGA", "JUMBO", "SUPER", "ULTRA", "PLUS", "VALUE", "FAMILY", "PREMIUM", "BRAND", "NEW",
  "ORIGINAL", "FRESH", "MERV", "MPR", "FPR", "PERF", "MULTI", "ASST", "ASSORTED", "SELECT", "SMALL", "MED", "MEDIUM", "LARGE", "LG", "SM", "MINI",
  "IN", "INCH", "X",
]);
const BRANDS = new Set([
  "TIDE", "CASCADE", "FINISH", "BOUNTY", "CHARMIN", "KIRKLAND", "GREAT", "MEMBER", "MARK", "MARKS", "FILTRETE", "3M", "SCOTT", "GLAD", "HEFTY", "DAWN",
  "CLOROX", "LYSOL", "OXICLEAN", "DOWNY", "GAIN", "SWIFFER", "BRAWNY", "ENERGIZER", "DURACELL", "COTTONELLE", "SEVENTH", "GENERATION", "MRS", "MEYERS",
  "SPRAY", "NINE", "FLANDERS", "HONEYWELL", "PUREX", "ARM", "HAMMER", "SPECTRUM", "EQUATE", "UP", "SIGNATURE", "SELECT", "PARENTS", "CHOICE", "ECO",
  "SEVENTH", "EARTH", "ALL", "SNUGGLE", "BOUNCE", "CASCADE", "PLATINUM", "COMET", "MAGIC", "ERASER", "RAID", "WINDEX", "PLEDGE", "SOFTSOAP",
]);
const ACCESSORY = new Set(["HOLDER", "DISPENSER", "CASE", "RACK", "STAND", "COVER", "TRAY", "CADDY", "BASKET", "HANGER", "WRAP"]);
const SIZE_TOKEN = /^\d+(?:CT|PK|PC|PCS|OZ|LB|LBS|GAL|ML|L|EA|CNT|FL|QT|G|KG|IN)?$/;
const SIZE_X = /^\d+(?:\.\d+)?X\d+(?:\.\d+)?(?:X\d+(?:\.\d+)?)?$/;
const SIZE_IN_TEXT = /(?<![\d.])(\d{1,2}(?:\.\d{1,2})?)\s*["”']?\s*[xX×]\s*(\d{1,2}(?:\.\d{1,2})?)\s*["”']?\s*[xX×]\s*(\d{1,2}(?:\.\d{1,2})?)(?![\d.])/;

function singular(token: string): string {
  if (token.length > 4 && token.endsWith("IES")) return `${token.slice(0, -3)}Y`;
  if (token.length > 3 && token.endsWith("S") && !token.endsWith("SS") && !token.endsWith("US")) return token.slice(0, -1);
  return token;
}

/** Core words of an item name: upper case, abbreviations expanded, brand/size/count words removed. */
export function coreTokens(text: string): string[] {
  const out: string[] = [];
  const base = text.toUpperCase().replace(/'/g, "").replace(/(\d)\s*[xX×]\s*(?=\d)/g, "$1X");
  for (const raw of base.split(/[^A-Z0-9]+/).filter(Boolean)) {
    if (SIZE_X.test(raw) || SIZE_TOKEN.test(raw)) continue;
    if (/^(?:MERV|MPR|FPR)\d+$/.test(raw)) continue;
    const expanded = ABBREVIATIONS[raw] ?? [raw];
    for (const piece of expanded) {
      const token = singular(piece);
      if (DROP.has(token) || DROP.has(piece) || BRANDS.has(piece) || BRANDS.has(token)) continue;
      if (token.length < 2) continue;
      if (!out.includes(token)) out.push(token);
    }
  }
  return out;
}

function sizeOf(text: string | undefined): string | undefined {
  const m = text ? SIZE_IN_TEXT.exec(text) : null;
  return m ? `${Number(m[1])}x${Number(m[2])}x${Number(m[3])}` : undefined;
}

function sameSize(a: string, b: string): boolean {
  const x = sizeOf(a) ?? a.toLowerCase();
  const y = sizeOf(b) ?? b.toLowerCase();
  return x.toLowerCase() === y.toLowerCase();
}

type Candidate = {
  automationId?: string;
  consumableId?: string;
  name: string;
  tokens: string[];
  size?: string;
  barcodes: string[];
};

function candidatesFor(household: Pick<Household, "supplyAutomations" | "consumables">): Candidate[] {
  const list: Candidate[] = [];
  for (const a of household.supplyAutomations) {
    const sku = a.sku && normalizeBarcode(a.sku) ? [a.sku] : [];
    list.push({
      automationId: a.id,
      name: a.itemName,
      tokens: coreTokens(a.itemName),
      size: a.sizeSpec ?? sizeOf(a.itemName) ?? (a.sku ? sizeOf(a.sku) : undefined),
      barcodes: [...sku, ...(a.barcodes ?? [])],
    });
  }
  for (const c of household.consumables) {
    list.push({ consumableId: c.id, name: c.name, tokens: coreTokens(c.name), size: c.sizeSpec ?? sizeOf(c.name), barcodes: [] });
  }
  return list;
}

function digitRuns(text: string): string[] {
  return text.match(/\d{8,14}/g) ?? [];
}

function scoreName(lineTokens: string[], cand: Candidate): number {
  const a = lineTokens;
  const b = cand.tokens;
  if (a.length === 0 || b.length === 0) return 0;
  const shared = b.filter((t) => a.includes(t)).length;
  if (shared === 0) return 0;
  const dice = (2 * shared) / (a.length + b.length);
  const cover = shared / b.length;
  const extras = a.filter((t) => !b.includes(t));
  let score = dice;
  if (a.length === b.length && shared === b.length) score = 1;
  else if (cover === 1 && b.length >= 2) score = 0.7 + 0.3 * dice;
  if (extras.some((t) => ACCESSORY.has(t)) && !b.some((t) => ACCESSORY.has(t))) score = Math.min(score, 0.6);
  return Math.min(1, score);
}

/**
 * Matches each receipt line to something the household already tracks. Only
 * "matched" (a strong score with no close rival) may start ticked; "maybe"
 * must start unticked. Nothing is ever created here.
 */
export function matchReceipt(
  receipt: Pick<ParsedReceipt, "lines">,
  household: Pick<Household, "supplyAutomations" | "consumables">,
): ReceiptLineMatch[] {
  const candidates = candidatesFor(household);
  const results: ReceiptLineMatch[] = receipt.lines.map((line) => {
    if (line.discount || line.price <= 0) return { line, status: "none", preChecked: false };

    const lineTokens = coreTokens(line.name);
    const lineSize = sizeOf(line.raw) ?? sizeOf(line.name);
    const runs = digitRuns(line.raw);

    const scored = candidates
      .map((cand) => {
        let score = scoreName(lineTokens, cand);
        let via: ReceiptTarget["via"] = "name";
        if (runs.length > 0 && cand.barcodes.some((code) => runs.some((run) => sameBarcode(run, code)))) {
          return { cand, score: 1, via: "barcode" as const };
        }
        if (lineSize && cand.size) {
          if (sameSize(lineSize, cand.size)) {
            if (lineTokens.includes("FILTER") && cand.tokens.includes("FILTER")) {
              if (score < 0.9) via = "size";
              score = Math.max(score, 0.9);
            }
          } else {
            score = Math.min(score, 0.6); // a different size is a different item
          }
        }
        return { cand, score, via };
      })
      .filter((s) => s.score > 0)
      .sort((x, y) => y.score - x.score || (x.cand.automationId ? -1 : 1) - (y.cand.automationId ? -1 : 1));

    const best = scored[0];
    if (!best || best.score < MAYBE_AT) return { line, status: "none", preChecked: false };

    // A consumable and a restock item with the same name are one thing, so they are not rivals.
    const rival = scored.slice(1).find((s) => coreKey(s.cand.tokens) !== coreKey(best.cand.tokens) || s.cand.size !== best.cand.size);
    const crowded = best.via !== "barcode" && rival !== undefined && best.score - rival.score < AMBIGUITY_GAP;
    const status: ReceiptMatchStatus = best.score >= MATCHED_AT && !crowded ? "matched" : "maybe";
    return {
      line,
      match: { automationId: best.cand.automationId, consumableId: best.cand.consumableId, score: round2(best.score), via: best.via },
      status,
      preChecked: status === "matched",
    };
  });

  // One tracked item can only be "matched" by one line; the weaker line becomes a "maybe".
  const strongest = new Map<string, number>();
  results.forEach((r, i) => {
    if (r.status !== "matched" || !r.match) return;
    const id = r.match.automationId ?? r.match.consumableId ?? "";
    const prev = strongest.get(id);
    if (prev === undefined || r.match.score > (results[prev].match?.score ?? 0)) strongest.set(id, i);
  });
  results.forEach((r, i) => {
    if (r.status !== "matched" || !r.match) return;
    const id = r.match.automationId ?? r.match.consumableId ?? "";
    if (strongest.get(id) !== i) {
      r.status = "maybe";
      r.preChecked = false;
    }
  });
  return results;
}

function coreKey(tokens: string[]): string {
  return [...tokens].sort().join(" ");
}
