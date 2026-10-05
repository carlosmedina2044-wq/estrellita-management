/**
 * Rejection codes from every method except `availability`:
 * - "unavailable": no on-device model right now (old iOS, Apple Intelligence off, not ready).
 * - "refused": the model declined the text (guardrails).
 * - "tooLong": the text did not fit the model's context.
 * - "failed": anything else, including cancellation.
 * The model only PROPOSES. Treat every returned field as untrusted and validate it.
 */
export type IntelligenceUnavailableReason =
  | "deviceNotEligible"
  | "notEnabled"
  | "modelNotReady"
  | "unsupportedLocale"
  | "unavailable";

export type IntelligenceFailureCode = "unavailable" | "refused" | "tooLong" | "failed";

export type RawLabel = {
  brand?: string;
  model?: string;
  serial?: string;
  type?: string;
  manufacturedMonth?: number;
  manufacturedYear?: number;
  filterSize?: string;
};

export type RawReceiptItem = { name: string; qty?: number; price?: number; matchesTracked?: string };
export type RawReceipt = { store?: string; date?: string; total?: number; items: RawReceiptItem[] };

export type RawAction =
  | {
      kind: "addChore";
      title: string;
      room?: string;
      frequency?: { unit: string; every: number };
      notes?: string;
    }
  | { kind: "logPurchase"; label: string; amount?: number; date?: string }
  | { kind: "completeChore"; title: string }
  | { kind: "unknown" };

export type TellCuidalaInput = {
  text: string;
  context: { rooms: string[]; duties: string[]; supplies: string[] };
  /** Today as YYYY-MM-DD, so "yesterday" can be resolved. */
  today: string;
};

export type CuidalaIntelligencePlugin = {
  availability(): Promise<{ available: boolean; reason?: IntelligenceUnavailableReason }>;
  structureLabel(options: { lines: string[] }): Promise<RawLabel>;
  structureReceipt(options: { lines: string[]; trackedNames: string[] }): Promise<RawReceipt>;
  tellCuidala(options: TellCuidalaInput): Promise<{ actions: RawAction[] }>;
};
