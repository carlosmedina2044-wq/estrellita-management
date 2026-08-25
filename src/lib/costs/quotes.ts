import type { Duty } from "@/lib/types";
import sources from "@/lib/costs/sources.json";

export const COST_SOURCE_LABEL = "national typical, 2026";
export const QUOTE_ONLY = new Set<string>(sources.quoteOnly);

export function isQuoteOnlyDuty(duty: Pick<Duty, "caution" | "title">): boolean {
  if (duty.caution && QUOTE_ONLY.has(duty.caution)) return true;
  return /\b(gas|electrical|roof|structural|pest)\b/i.test(duty.title);
}

export function quoteOnlyLabel(): string {
  return "Get a quote";
}

export function typicalCostFor(key: keyof typeof sources.items): { low: number; typical: number; high: number } {
  return sources.items[key];
}
