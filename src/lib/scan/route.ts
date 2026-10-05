import { cleanLine } from "./text";

/**
 * Decides what a scan is, with plain rules. Pure and deterministic, and it only
 * returns codes (never sentences). A close call comes back as "unknown" with the
 * contenders in `candidates`, so the sheet asks instead of guessing.
 */
export type ScanKind = "label" | "receipt" | "filter" | "product" | "warranty" | "unknown";
export type ScanLevel = "high" | "medium" | "low";

export type ScanInput = {
  /** Recognised text lines, in reading order. */
  lines: string[];
  /** Raw barcode payloads (EAN/UPC digits). */
  barcodes?: string[];
};

export type ScanClassification = {
  kind: ScanKind;
  confidence: ScanLevel;
  /** Stable codes such as "label.model" or "receipt.total", most useful for tests and the sheet. */
  reasons: string[];
  /** Every kind that scored, best first. When kind is "unknown" these are the choices to ask about. */
  candidates: { kind: Exclude<ScanKind, "unknown">; score: number }[];
};

type Kind = Exclude<ScanKind, "unknown">;

/** Below this a kind is not even a candidate. */
const MIN_SCORE = 2;
/** The winner must beat the runner-up by this much, otherwise we ask. */
const MIN_MARGIN = 1;

const PRICE_AT_END = /(?:^|[\s$])-?\$?(?:\d{1,3}(?:,\d{3})+\.\d{2}|\d{1,5}[.,]\d{2})\s*-?\s*[A-Z]?\s*$/;
const STORE_WORDS = /\b(HOME DEPOT|LOWE'?S|WALMART|WAL-?MART|TARGET|COSTCO|KROGER|SAFEWAY|TRADER JOE'?S|WHOLE FOODS|ACE HARDWARE|TRUE VALUE|MENARDS|CVS|WALGREENS|PUBLIX|ALDI|H-?E-?B|SAM'?S CLUB|DOLLAR (?:GENERAL|TREE)|BEST BUY|AMAZON|WINCO|MEIJER|RITE AID|HARDWARE|SUPERMARKET|PHARMACY|MARKET)\b/;
const FILTER_3D = /(?<![\d.])(\d{1,2}(?:\.\d{1,2})?)\s*["”']?\s*[xX×*]\s*(\d{1,2}(?:\.\d{1,2})?)\s*["”']?\s*[xX×*]\s*(\d{1,2}(?:\.\d{1,2})?)\s*["”']?(?![\d.])/;
const FILTER_2D = /(?<![\d.xX×*])(\d{1,2})\s*["”']?\s*[xX×]\s*(\d{1,2})\s*["”']?(?![\d.xX×*])/;

type Hit = { score: number; reasons: string[] };
const hit = (): Hit => ({ score: 0, reasons: [] });
function add(h: Hit, score: number, reason: string) {
  h.score += score;
  if (!h.reasons.includes(reason)) h.reasons.push(reason);
}

function plausibleFilter(a: number, b: number, depth?: number): boolean {
  const [w, h] = a <= b ? [a, b] : [b, a];
  if (w < 8 || h > 36) return false;
  return depth === undefined || (depth >= 0.5 && depth <= 6);
}

export function classifyScan(input: ScanInput): ScanClassification {
  const lines = input.lines.map(cleanLine).filter(Boolean);
  const barcodes = (input.barcodes ?? []).filter((b) => /\d{8,14}/.test(b));
  const upper = lines.map((l) => l.toUpperCase());
  const all = upper.join("\n");

  const label = hit();
  const receipt = hit();
  const filter = hit();
  const product = hit();
  const warranty = hit();

  // ---- label (appliance plate) ----
  const hasModel = upper.some((l) => /\b(MODEL|MOD\.?\s?(?:NO|#)|M\/N)\b/.test(l));
  const hasSerial = upper.some((l) => /\b(SERIAL|SER\.?\s?(?:NO|#)|S\/N)\b/.test(l));
  if (hasModel) add(label, 2, "label.model");
  if (hasSerial) add(label, 2, "label.serial");
  if (upper.some((l) => /\b(MFG|MFD|MANUFACTURED|DATE OF MANUFACTURE|MFR DATE)\b/.test(l))) add(label, 1, "label.made");
  if (upper.some((l) => /\b(BTU|VOLTS?|HZ|AMPS?|WATTS?|PSI|GALLONS?)\b/.test(l)) && hasModel) add(label, 0.5, "label.ratings");

  // ---- receipt ----
  const priceLines = lines.filter((l) => PRICE_AT_END.test(l)).length;
  const money = (re: RegExp) => upper.some((l) => re.test(l));
  if (money(/\bSUB-?\s?TOTAL\b/)) add(receipt, 2, "receipt.subtotal");
  if (money(/(?<!SUB-?\s?)\b(?:GRAND\s+)?TOTAL\b|\bAMOUNT DUE\b|\bBALANCE DUE\b/)) add(receipt, 2, "receipt.total");
  if (money(/\b(?:SALES\s+)?TAX\b|\bHST\b|\bGST\b/)) add(receipt, 1.5, "receipt.tax");
  if (money(/\bCHANGE(?: DUE)?\b|\bCASH\b|\bTENDER\b/)) add(receipt, 1, "receipt.change");
  if (money(/\b(VISA|MASTERCARD|MASTER CARD|AMEX|DISCOVER|DEBIT|CREDIT)\b|\bMC\s*\*{2,}|\*{4}\s?\d{4}/)) add(receipt, 1.5, "receipt.card");
  if (money(/\b(THANK YOU|THANKS FOR SHOPPING|RECEIPT|ITEMS? SOLD|CASHIER|REGISTER|TRANS(?:ACTION)?\s?(?:#|NO)|TERMINAL)\b/)) add(receipt, 1, "receipt.footer");
  if (upper.slice(0, 6).some((l) => STORE_WORDS.test(l))) add(receipt, 1.5, "receipt.store");
  if (priceLines >= 5) add(receipt, 2.5, "receipt.prices");
  else if (priceLines >= 3) add(receipt, 2, "receipt.prices");
  else if (priceLines === 2) add(receipt, 1, "receipt.prices");

  // ---- filter ----
  const filterWord = /\bFILTERS?\b|\bFLTR\b|\bMERV\b|\bAIR FILTER\b/.test(all);
  let sizeFound = false;
  for (const line of lines) {
    const m3 = FILTER_3D.exec(line);
    if (m3 && plausibleFilter(Number(m3[1]), Number(m3[2]), Number(m3[3]))) {
      sizeFound = true;
      add(filter, 2.5, "filter.size3");
      break;
    }
    const m2 = FILTER_2D.exec(line);
    if (m2 && plausibleFilter(Number(m2[1]), Number(m2[2]))) {
      sizeFound = true;
      add(filter, filterWord ? 1.5 : 0.8, "filter.size2");
      break;
    }
  }
  if (sizeFound && filterWord) add(filter, 1.5, "filter.word");
  if (/\bMERV\s?\d{1,2}\b/.test(all)) add(filter, 1, "filter.merv");
  // A filter word alone (no size) is not enough: "COFFEE FILTER" boxes exist.

  // ---- product (a barcode with little else) ----
  if (barcodes.length > 0) {
    if (lines.length <= 3) add(product, 3, "product.lone_barcode");
    else if (lines.length <= 8) add(product, 2, "product.barcode_with_text");
    else add(product, 0.5, "product.barcode_in_text");
  }

  // ---- warranty ----
  if (/\bWARRANT(?:Y|IES)\b/.test(all)) add(warranty, 2, "warranty.word");
  if (/\b(?:WARRANTY PERIOD|LIMITED WARRANTY|YEARS? LIMITED|YR\.? LIMITED|\d+[- ]?(?:YEAR|YR)S?\s+(?:LIMITED\s+)?WARRANTY)\b/.test(all)) add(warranty, 2, "warranty.term");
  if (/\bWARRANTY\b.*\b(?:UNTIL|EXPIRES?|EXPIRATION|THRU|THROUGH)\b|\b(?:EXPIRES?|EXPIRATION DATE)\b/.test(all)) add(warranty, 1, "warranty.end");

  const scored: { kind: Kind; hit: Hit }[] = [
    { kind: "label", hit: label },
    { kind: "receipt", hit: receipt },
    { kind: "filter", hit: filter },
    { kind: "product", hit: product },
    { kind: "warranty", hit: warranty },
  ];
  const candidates = scored
    .filter((s) => s.hit.score >= MIN_SCORE)
    .sort((a, b) => b.hit.score - a.hit.score);
  const list = candidates.map((c) => ({ kind: c.kind, score: c.hit.score }));

  if (candidates.length === 0) {
    const reasons = scored.flatMap((s) => s.hit.reasons);
    return { kind: "unknown", confidence: "low", reasons: reasons.length ? reasons : ["none"], candidates: list };
  }

  const [top, second] = candidates;
  if (second && top.hit.score - second.hit.score < MIN_MARGIN) {
    return {
      kind: "unknown",
      confidence: "low",
      reasons: ["tie", ...top.hit.reasons, ...second.hit.reasons],
      candidates: list,
    };
  }
  const margin = top.hit.score - (second?.hit.score ?? 0);
  const confidence: ScanLevel = top.hit.score >= 4 && margin >= 2 ? "high" : "medium";
  return { kind: top.kind, confidence, reasons: top.hit.reasons, candidates: list };
}
