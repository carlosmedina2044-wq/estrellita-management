import type {
  CuidalaIntelligencePlugin,
  IntelligenceUnavailableReason,
} from "@/lib/native/cuidala-intelligence";
import { isNativeIos } from "@/lib/native/platform";
import type { AssetType } from "@/lib/types";

/**
 * Apple Intelligence helpers. On-device only, optional, and never authoritative:
 * the model PROPOSES, this file validates every field, and the caller still shows a
 * confirm card before anything is saved. Nothing here throws.
 */

export type AiFailure = "unavailable" | "refused" | "tooLong" | "failed";
export type AiResult<T> = ({ ok: true } & T) | { ok: false; reason: AiFailure };

export type AiAvailability = { available: boolean; reason?: IntelligenceUnavailableReason };

export type AiLabel = {
  brand?: string;
  model?: string;
  serial?: string;
  type?: AssetType;
  manufacturedMonth?: number;
  manufacturedYear?: number;
  filterSize?: string;
};

export type AiReceiptItem = { name: string; qty?: number; price?: number; matchesTracked?: string };
export type AiReceipt = { store?: string; date?: string; total?: number; items: AiReceiptItem[] };

export type AiFrequencyUnit = "day" | "week" | "month" | "year";
export type AiAction =
  | {
      kind: "addChore";
      title: string;
      room?: string;
      frequency?: { unit: AiFrequencyUnit; every: number };
      notes?: string;
    }
  | { kind: "logPurchase"; label: string; amount?: number; date?: string }
  | { kind: "completeChore"; title: string };

export type AiTellContext = { rooms: string[]; duties: string[]; supplies: string[] };

let testPlugin: CuidalaIntelligencePlugin | null = null;

/** Test hook: stand in for the native plugin. Pass null to restore. */
export function installIntelligencePluginForTests(plugin: CuidalaIntelligencePlugin | null): void {
  testPlugin = plugin;
}

async function loadPlugin(): Promise<CuidalaIntelligencePlugin | null> {
  if (testPlugin) return testPlugin;
  if (!isNativeIos()) return null;
  const { CuidalaIntelligence } = await import("@/lib/native/cuidala-intelligence");
  return CuidalaIntelligence;
}

// ---- limits (also enforced natively; repeated here because JS trusts nothing) ----
const MAX_LINES = 80;
const MAX_LINE = 160;
const MAX_NAMES = 60;
const MAX_NAME = 80;
const MAX_FIELD = 120;
const MAX_NOTES = 240;
const MAX_TEXT = 600;
const MAX_ITEMS = 40;
const MAX_ACTIONS = 3;
const MAX_MONEY = 1_000_000;

// Record<AssetType, true> makes tsc fail here if AssetType gains a member.
const ASSET_TYPES: Record<AssetType, true> = {
  hvac_system: true,
  water_heater: true,
  furnace: true,
  refrigerator: true,
  dishwasher: true,
  range_oven: true,
  microwave: true,
  washer: true,
  dryer: true,
  garbage_disposal: true,
  water_softener: true,
  garage_door_opener: true,
  roof: true,
  exterior_paint: true,
  interior_paint: true,
  carpet: true,
  hardwood_floor: true,
  windows: true,
  smoke_detector: true,
  sump_pump: true,
  pool_pump: true,
  irrigation_system: true,
  air_purifier: true,
  evaporative_cooler: true,
  hvac: true,
  fridge: true,
  other: true,
};

const REASONS: readonly IntelligenceUnavailableReason[] = [
  "deviceNotEligible",
  "notEnabled",
  "modelNotReady",
  "unsupportedLocale",
  "unavailable",
];
const UNITS: readonly AiFrequencyUnit[] = ["day", "week", "month", "year"];

// ---- tiny validators ----

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Strips control characters, collapses whitespace, clamps. Empty becomes undefined. */
export function cleanText(value: unknown, limit: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit)
    .trim();
  return cleaned || undefined;
}

function cleanList(value: unknown, maxCount: number, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    const cleaned = cleanText(entry, limit);
    if (cleaned) out.push(cleaned);
    if (out.length >= maxCount) break;
  }
  return out;
}

function int(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  return rounded >= min && rounded <= max ? rounded : undefined;
}

function money(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value < 0 || value > MAX_MONEY) return undefined;
  return Math.round(value * 100) / 100;
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealDay(value: string): boolean {
  const match = ISO_DAY.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** A real YYYY-MM-DD between 2000-01-01 and one day after `today`. */
function day(value: unknown, today: string): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!isRealDay(trimmed) || trimmed < "2000-01-01") return undefined;
  if (isRealDay(today)) {
    const limit = new Date(`${today}T00:00:00Z`);
    limit.setUTCDate(limit.getUTCDate() + 1);
    if (trimmed > limit.toISOString().slice(0, 10)) return undefined;
  }
  return trimmed;
}

function matchOf(value: unknown, allowed: string[]): string | undefined {
  const text = cleanText(value, MAX_NAME);
  if (!text) return undefined;
  const lower = text.toLowerCase();
  return allowed.find((name) => name.toLowerCase() === lower);
}

function failureOf(error: unknown): AiFailure {
  const code = isRecord(error) && "code" in error ? String(error.code) : "";
  if (code === "unavailable" || code === "refused" || code === "tooLong") return code;
  return "failed";
}

function todayLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ---- public API ----

/** Whether the on-device model can be used right now. Never throws. */
export async function aiAvailable(): Promise<AiAvailability> {
  try {
    const plugin = await loadPlugin();
    if (!plugin) return { available: false, reason: "deviceNotEligible" };
    const raw: unknown = await plugin.availability();
    if (!isRecord(raw)) return { available: false, reason: "unavailable" };
    if (raw.available === true) return { available: true };
    const reason = REASONS.find((r) => r === raw.reason) ?? "unavailable";
    return { available: false, reason };
  } catch {
    return { available: false, reason: "unavailable" };
  }
}

/** Reads fields off OCR lines. Every field is optional; unknown values are dropped. */
export async function aiStructureLabel(lines: string[]): Promise<AiResult<{ label: AiLabel }>> {
  try {
    const plugin = await loadPlugin();
    if (!plugin) return { ok: false, reason: "unavailable" };
    const clean = cleanList(lines, MAX_LINES, MAX_LINE);
    if (clean.length === 0) return { ok: true, label: {} };
    const raw: unknown = await plugin.structureLabel({ lines: clean });
    return { ok: true, label: validateLabel(raw) };
  } catch (error) {
    return { ok: false, reason: failureOf(error) };
  }
}

export function validateLabel(raw: unknown): AiLabel {
  const label: AiLabel = {};
  if (!isRecord(raw)) return label;
  const brand = cleanText(raw.brand, MAX_FIELD);
  if (brand) label.brand = brand;
  const model = cleanText(raw.model, MAX_FIELD);
  if (model) label.model = model;
  const serial = cleanText(raw.serial, MAX_FIELD);
  if (serial) label.serial = serial;
  if (typeof raw.type === "string" && Object.prototype.hasOwnProperty.call(ASSET_TYPES, raw.type)) {
    label.type = raw.type as AssetType;
  }
  const month = int(raw.manufacturedMonth, 1, 12);
  const year = int(raw.manufacturedYear, 1950, new Date().getFullYear() + 1);
  // A month alone says nothing, so keep it only beside a year.
  if (year !== undefined) {
    label.manufacturedYear = year;
    if (month !== undefined) label.manufacturedMonth = month;
  }
  const filterSize = cleanText(raw.filterSize, 24);
  if (filterSize && /^\d{1,2}(\.\d+)?\s*[x×]\s*\d{1,2}(\.\d+)?\s*[x×]\s*\d{1,2}(\.\d+)?$/i.test(filterSize)) {
    label.filterSize = filterSize.replace(/\s+/g, "").replace("×", "x").toLowerCase();
  }
  return label;
}

/**
 * Reads a receipt. Only the NAMES of tracked supplies are sent to the model, never
 * other household data. `matchesTracked` survives only if it equals one of those names.
 */
export async function aiStructureReceipt(
  lines: string[],
  trackedNames: string[],
): Promise<AiResult<{ receipt: AiReceipt }>> {
  try {
    const plugin = await loadPlugin();
    if (!plugin) return { ok: false, reason: "unavailable" };
    const clean = cleanList(lines, MAX_LINES, MAX_LINE);
    const names = cleanList(trackedNames, MAX_NAMES, MAX_NAME);
    if (clean.length === 0) return { ok: true, receipt: { items: [] } };
    const raw: unknown = await plugin.structureReceipt({ lines: clean, trackedNames: names });
    return { ok: true, receipt: validateReceipt(raw, names, todayLocal()) };
  } catch (error) {
    return { ok: false, reason: failureOf(error) };
  }
}

export function validateReceipt(raw: unknown, trackedNames: string[], today: string): AiReceipt {
  const receipt: AiReceipt = { items: [] };
  if (!isRecord(raw)) return receipt;
  const store = cleanText(raw.store, MAX_FIELD);
  if (store) receipt.store = store;
  const date = day(raw.date, today);
  if (date) receipt.date = date;
  const total = money(raw.total);
  if (total !== undefined) receipt.total = total;
  if (Array.isArray(raw.items)) {
    for (const entry of raw.items) {
      if (!isRecord(entry)) continue;
      const name = cleanText(entry.name, MAX_FIELD);
      if (!name) continue;
      const item: AiReceiptItem = { name };
      const qty = int(entry.qty, 1, 999);
      if (qty !== undefined) item.qty = qty;
      const price = money(entry.price);
      if (price !== undefined) item.price = price;
      const match = matchOf(entry.matchesTracked, trackedNames);
      if (match) item.matchesTracked = match;
      receipt.items.push(item);
      if (receipt.items.length >= MAX_ITEMS) break;
    }
  }
  return receipt;
}

/**
 * Turns one typed sentence into proposed actions. Rooms must match `context.rooms`,
 * completed chores must match `context.duties`; anything else is dropped. The result
 * may be an empty list ("I did not understand"). Nothing is applied here.
 */
export async function aiTellCuidala(
  text: string,
  context: AiTellContext,
  today: string = todayLocal(),
): Promise<AiResult<{ actions: AiAction[] }>> {
  try {
    const plugin = await loadPlugin();
    if (!plugin) return { ok: false, reason: "unavailable" };
    const sentence = cleanText(text, MAX_TEXT);
    if (!sentence) return { ok: true, actions: [] };
    const safeToday = isRealDay(today) ? today : todayLocal();
    const clean: AiTellContext = {
      rooms: cleanList(context?.rooms, MAX_NAMES, MAX_NAME),
      duties: cleanList(context?.duties, MAX_NAMES, MAX_NAME),
      supplies: cleanList(context?.supplies, MAX_NAMES, MAX_NAME),
    };
    const raw: unknown = await plugin.tellCuidala({ text: sentence, context: clean, today: safeToday });
    return { ok: true, actions: validateActions(raw, clean, safeToday) };
  } catch (error) {
    return { ok: false, reason: failureOf(error) };
  }
}

export function validateActions(raw: unknown, context: AiTellContext, today: string): AiAction[] {
  if (!isRecord(raw) || !Array.isArray(raw.actions)) return [];
  const actions: AiAction[] = [];
  for (const entry of raw.actions) {
    if (!isRecord(entry)) continue;
    if (entry.kind === "addChore") {
      const title = cleanText(entry.title, MAX_FIELD);
      if (!title) continue;
      const action: AiAction = { kind: "addChore", title };
      const room = matchOf(entry.room, context.rooms);
      if (room) action.room = room;
      const freq = entry.frequency;
      if (isRecord(freq)) {
        const unit = UNITS.find((u) => u === freq.unit);
        const every = int(freq.every, 1, 36);
        if (unit && every !== undefined) action.frequency = { unit, every };
      }
      const notes = cleanText(entry.notes, MAX_NOTES);
      if (notes) action.notes = notes;
      actions.push(action);
    } else if (entry.kind === "logPurchase") {
      const label = cleanText(entry.label, MAX_FIELD);
      if (!label) continue;
      const action: AiAction = { kind: "logPurchase", label };
      const amount = money(entry.amount);
      if (amount !== undefined) action.amount = amount;
      const date = day(entry.date, today);
      if (date) action.date = date;
      actions.push(action);
    } else if (entry.kind === "completeChore") {
      const title = matchOf(entry.title, context.duties);
      if (title) actions.push({ kind: "completeChore", title });
    }
    // "unknown" and anything unrecognised: dropped.
    if (actions.length >= MAX_ACTIONS) break;
  }
  return actions;
}
