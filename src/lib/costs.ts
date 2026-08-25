import { linkedDutyIdsFor } from "@/lib/restock";
import { parseISODate, toISODate } from "@/lib/dates";
import { isQuoteOnlyDuty } from "@/lib/costs/quotes";
import type { Completion, Duty, Household, SupplyAutomation } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;
export const COST_PROMPT_WINDOW_MS = DAY_MS;
export const RECEIVED_PRICE_WINDOW_MS = 30 * DAY_MS;
const MAX_ACTUAL_COST = 100_000;

export function parseCostInput(value: string): number | null {
  const n = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > MAX_ACTUAL_COST) return null;
  return Math.round(n * 100) / 100;
}

export function realCostFor(dutyId: string, completions: Completion[]): number | null {
  const withCost = completions
    .filter((item) => item.dutyId === dutyId && typeof item.actualCost === "number")
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  return withCost[0]?.actualCost ?? null;
}

export function blendedCostFor(
  duty: Pick<Duty, "id" | "estimatedCost" | "caution" | "title">,
  completions: Completion[],
): { cost: number; source: "actual" | "estimate" } | null {
  const actual = realCostFor(duty.id, completions);
  if (actual != null) return { cost: actual, source: "actual" };
  if (duty.estimatedCost != null && duty.estimatedCost > 0) {
    if (isQuoteOnlyDuty(duty)) return null;
    return { cost: duty.estimatedCost, source: "estimate" };
  }
  return null;
}

export function shouldPromptCost(
  completion: Completion,
  duty: Pick<Duty, "kind" | "id">,
  now = new Date(),
  household?: {
    supplyAutomations: Array<Pick<SupplyAutomation, "dutyId" | "linkedDutyIds" | "lastPaidPrice" | "lastPaidAt">>;
  },
): boolean {
  if (duty.kind !== "replacement") return false;
  if (completion.costSkipped === true) return false;
  if (typeof completion.actualCost === "number") return false;
  const completed = Date.parse(completion.completedAt);
  if (!Number.isFinite(completed)) return false;
  if (now.getTime() - completed > COST_PROMPT_WINDOW_MS) return false;
  if (now.getTime() < completed) return false;
  if (household) {
    const automation = household.supplyAutomations.find((item) => linkedDutyIdsFor(item).includes(duty.id));
    if (automation?.lastPaidPrice != null && automation.lastPaidAt) {
      const paidAt = parseISODate(automation.lastPaidAt);
      if (Number.isFinite(paidAt) && now.getTime() - paidAt <= RECEIVED_PRICE_WINDOW_MS) return false;
    }
  }
  return true;
}

export function suggestedCostFor(duty: Duty, household: Household): number | undefined {
  const automation = household.supplyAutomations.find((item) => linkedDutyIdsFor(item).includes(duty.id));
  if (automation?.lastPaidPrice != null) return automation.lastPaidPrice;
  if (automation?.unitCost != null) return automation.unitCost;
  const consumable = household.consumables.find(
    (item) => item.nodeId === duty.nodeId || item.assetId === duty.nodeId,
  );
  return consumable?.lastPaidPrice ?? consumable?.unitCost;
}

function matchingConsumables(household: Household, duty: Duty) {
  return household.consumables.filter(
    (item) => item.nodeId === duty.nodeId || item.assetId === duty.nodeId,
  );
}

export function applyCompletionCost(
  household: Household,
  completionId: string,
  input: { actualCost: number } | { skip: true },
): Household {
  const completion = household.completions.find((item) => item.id === completionId);
  if (!completion) return household;
  const duty = household.duties.find((item) => item.id === completion.dutyId);
  const skip = "skip" in input;
  const actualCost = skip ? undefined : input.actualCost;
  const completions = household.completions.map((item) =>
    item.id === completionId
      ? skip
        ? { ...item, costSkipped: true as const, actualCost: undefined }
        : { ...item, actualCost, costSkipped: undefined }
      : item,
  );
  if (skip || actualCost == null || !duty) {
    return { ...household, completions };
  }
  return {
    ...household,
    completions,
    supplyAutomations: household.supplyAutomations.map((item) =>
      linkedDutyIdsFor(item).includes(duty.id) ? { ...item, lastPaidPrice: actualCost } : item,
    ),
    consumables: matchingConsumables(household, duty).map((item) => ({
      ...item,
      lastPaidPrice: actualCost,
    })).length
      ? household.consumables.map((item) =>
          item.nodeId === duty.nodeId || item.assetId === duty.nodeId
            ? { ...item, lastPaidPrice: actualCost }
            : item,
        )
      : household.consumables,
  };
}

export function applyReceivedPrice(
  household: Household,
  automationId: string,
  actualCost: number,
  now = new Date(),
): Household {
  const automation = household.supplyAutomations.find((item) => item.id === automationId);
  if (!automation) return household;
  const lastPaidAt = toISODate(now);
  return {
    ...household,
    supplyAutomations: household.supplyAutomations.map((item) =>
      item.id === automationId ? { ...item, lastPaidPrice: actualCost, lastPaidAt } : item,
    ),
    consumables: household.consumables.map((item) =>
      item.nodeId === automation.nodeId || item.assetId === automation.nodeId || item.name === automation.itemName
        ? { ...item, lastPaidPrice: actualCost }
        : item,
    ),
  };
}
