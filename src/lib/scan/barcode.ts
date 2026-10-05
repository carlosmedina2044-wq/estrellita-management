import type { Household, SupplyAutomation } from "@/lib/types";

/**
 * Barcode memory with no database and no network. The first time a box is
 * scanned the person says what it is, and we remember the code on that tracked
 * supply. After that the same box is recognised instantly.
 *
 * Storage rule (backwards compatible): the code goes in `SupplyAutomation.sku`
 * when that is empty. If `sku` already holds something else (a retailer SKU, or
 * a size like "16x25x1" set by addSupplySize), the code is added to the optional
 * `barcodes` list instead. The retailer SKU is never overwritten. Both fields
 * survive storage migration and backups (see asBarcodes in storage/migrate.ts).
 */

const MAX_BARCODES = 8;

/** Digits only, when it has a retail-barcode length (EAN-8, UPC-A, EAN-13, GTIN-14). */
export function normalizeBarcode(value: string): string | null {
  const digits = value.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  return [8, 12, 13, 14].includes(digits.length) ? digits : null;
}

/** GS1 check digit. Camera scans are already checked; this guards typed or OCR'd digits. */
export function hasValidCheckDigit(digits: string): boolean {
  if (!/^\d{8,14}$/.test(digits)) return false;
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < body.length; i += 1) {
    const fromRight = body.length - i; // 1 = digit next to the check digit
    sum += Number(body[i]) * (fromRight % 2 === 1 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === Number(digits.slice(-1));
}

/** A UPC-A is an EAN-13 with a leading zero; compare codes without leading zeros. */
function key(digits: string): string {
  return digits.replace(/^0+/, "");
}

export function sameBarcode(a: string, b: string): boolean {
  const x = normalizeBarcode(a);
  const y = normalizeBarcode(b);
  return x !== null && y !== null && key(x) === key(y);
}

function holds(item: SupplyAutomation, code: string): boolean {
  if (item.sku && sameBarcode(item.sku, code)) return true;
  return (item.barcodes ?? []).some((known) => sameBarcode(known, code));
}

export type RememberResult = {
  household: Household;
  /** "sku" = stored in sku; "barcodes" = added beside an existing sku; "known" = already remembered; "ignored" = not a usable code or no such item. */
  stored: "sku" | "barcodes" | "known" | "ignored";
};

export function rememberBarcodeDetailed(household: Household, automationId: string, value: string): RememberResult {
  const code = normalizeBarcode(value);
  const target = household.supplyAutomations.find((item) => item.id === automationId);
  if (!code || !target) return { household, stored: "ignored" };
  if (holds(target, code)) return { household, stored: "known" };

  const claimedElsewhere = household.supplyAutomations.find((item) => item.id !== automationId && holds(item, code));
  let supplyAutomations = household.supplyAutomations;
  if (claimedElsewhere) {
    // A box belongs to one thing: moving it is the person's correction, so drop the old claim.
    supplyAutomations = supplyAutomations.map((item) => (item.id === claimedElsewhere.id ? forget(item, code) : item));
  }

  const stored: RememberResult["stored"] = target.sku.trim() === "" ? "sku" : "barcodes";
  supplyAutomations = supplyAutomations.map((item) => {
    if (item.id !== automationId) return item;
    if (stored === "sku") return { ...item, sku: code };
    return { ...item, barcodes: [...(item.barcodes ?? []), code].slice(-MAX_BARCODES) };
  });
  return { household: { ...household, supplyAutomations }, stored };
}

/** Remembers a scanned code for a tracked supply. Pure; returns the same household when nothing changes. */
export function rememberBarcode(household: Household, automationId: string, value: string): Household {
  return rememberBarcodeDetailed(household, automationId, value).household;
}

function forget(item: SupplyAutomation, code: string): SupplyAutomation {
  const barcodes = (item.barcodes ?? []).filter((known) => !sameBarcode(known, code));
  return {
    ...item,
    sku: item.sku && sameBarcode(item.sku, code) ? "" : item.sku,
    barcodes: barcodes.length > 0 ? barcodes : undefined,
  };
}

/** The tracked supply this box was remembered for, if any. */
export function findByBarcode(household: Household, value: string): SupplyAutomation | undefined {
  const code = normalizeBarcode(value);
  if (!code) return undefined;
  return household.supplyAutomations.find((item) => holds(item, code));
}

/** True when this code has never been taught to the app, so the sheet should ask "What is this?". */
export function isFirstSeen(household: Household, value: string): boolean {
  return normalizeBarcode(value) !== null && findByBarcode(household, value) === undefined;
}
