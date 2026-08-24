import { applyCompletionCost, applyReceivedPrice } from "@/lib/costs";
import { addCalendarMonths, parseISODate, toISODate } from "@/lib/dates";
import { catalogEntry, normalizeAssetType } from "@/lib/asset-catalog";
import { conditionFactor } from "@/lib/forecast";
import type { Household, LaborKind, Purchase, PurchaseKind } from "@/lib/types";

export function parseBudgetMoney(value: string, max = 5_000_000): number | null {
  const n = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.round(n * 100) / 100;
}

function uid() {
  return crypto.randomUUID();
}

function isoFromDateInput(value: string, fallback = new Date()): string {
  const time = parseISODate(value);
  if (!Number.isFinite(time)) return fallback.toISOString();
  return new Date(time).toISOString();
}

export type LogPurchaseInput = {
  actualCost: number;
  completedOn: string;
  label: string;
  kind: PurchaseKind;
  dutyId?: string;
  assetId?: string;
  automationId?: string;
  laborKind?: LaborKind;
  notes?: string;
  plannedCost?: number;
  replacedAsset?: boolean;
};

export function applySetMaintenanceFund(
  household: Household,
  patch: { balance?: number; monthlyContribution?: number | null },
  now = new Date(),
): Household {
  const current = household.maintenanceFund;
  const balance = patch.balance ?? current?.balance;
  if (balance == null || !Number.isFinite(balance) || balance < 0) return household;
  const contribution =
    patch.monthlyContribution === null
      ? undefined
      : (patch.monthlyContribution ?? current?.monthlyContribution);
  return {
    ...household,
    maintenanceFund: {
      balance: Math.round(balance * 100) / 100,
      updatedAt: now.toISOString(),
      monthlyContribution:
        contribution != null && Number.isFinite(contribution) && contribution >= 0
          ? Math.round(contribution * 100) / 100
          : undefined,
    },
  };
}

export function applySetHomeValue(household: Household, value: number | null): Household {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return { ...household, homeValueEstimate: undefined };
  }
  return { ...household, homeValueEstimate: Math.round(value) };
}

export function applySetBigTicketThreshold(household: Household, value: number): Household {
  if (!Number.isFinite(value) || value < 50) return household;
  return { ...household, bigTicketThreshold: Math.min(50_000, Math.round(value)) };
}

export function replacementDueDate(asset: Household["assets"][number], now = new Date()): Date {
  const catalog = catalogEntry(normalizeAssetType(asset.type));
  const lifeYears = asset.expectedLifeYears ?? catalog.defaultLifeYears;
  const installed = asset.installDate ? new Date(parseISODate(asset.installDate)) : now;
  const end = addCalendarMonths(installed, Math.round(lifeYears * 12 * conditionFactor(asset.condition)));
  if (asset.deferredUntil) {
    const deferred = new Date(parseISODate(asset.deferredUntil));
    if (deferred.getTime() > end.getTime()) return deferred;
  }
  return end;
}

export function applyDeferAsset(
  household: Household,
  assetId: string,
  months: 6 | 12,
  reason?: string,
  now = new Date(),
): Household {
  const asset = household.assets.find((item) => item.id === assetId);
  if (!asset) return household;
  const base = new Date(Math.max(now.getTime(), replacementDueDate(asset, now).getTime()));
  const deferredUntil = toISODate(addCalendarMonths(base, months));
  const note = reason?.trim();
  return {
    ...household,
    assets: household.assets.map((item) =>
      item.id === assetId
        ? { ...item, deferredUntil, deferReason: note ? note.slice(0, 500) : undefined }
        : item,
    ),
  };
}

export function applyReplaceAsset(
  household: Household,
  input: {
    assetId: string;
    actualCost: number;
    replacedOn: string;
    laborKind?: LaborKind;
    notes?: string;
    plannedCost?: number;
  },
  now = new Date(),
): Household {
  const asset = household.assets.find((item) => item.id === input.assetId);
  if (!asset) return household;
  const purchase: Purchase = {
    id: uid(),
    completedAt: isoFromDateInput(input.replacedOn, now),
    actualCost: input.actualCost,
    label: `${asset.name} replacement`,
    kind: "replacement",
    assetId: asset.id,
    laborKind: input.laborKind,
    notes: input.notes?.trim() || undefined,
    plannedCost: input.plannedCost,
  };
  return {
    ...household,
    assets: household.assets.map((item) =>
      item.id === asset.id
        ? {
            ...item,
            installDate: input.replacedOn,
            purchasePrice: input.actualCost,
            replacementCostEstimate: input.actualCost,
            condition: "good" as const,
            deferredUntil: undefined,
            deferReason: undefined,
          }
        : item,
    ),
    purchases: [...(household.purchases ?? []), purchase],
  };
}

export function applyLogPurchase(household: Household, input: LogPurchaseInput, now = new Date()): Household {
  if (input.kind === "replacement" && input.assetId && input.replacedAsset !== false) {
    return applyReplaceAsset(
      household,
      {
        assetId: input.assetId,
        actualCost: input.actualCost,
        replacedOn: input.completedOn,
        laborKind: input.laborKind,
        notes: input.notes,
        plannedCost: input.plannedCost,
      },
      now,
    );
  }

  const purchase: Purchase = {
    id: uid(),
    completedAt: isoFromDateInput(input.completedOn, now),
    actualCost: input.actualCost,
    label: input.label,
    kind: input.kind,
    dutyId: input.dutyId,
    assetId: input.assetId,
    automationId: input.automationId,
    laborKind: input.laborKind,
    notes: input.notes?.trim() || undefined,
    plannedCost: input.plannedCost,
  };

  let next: Household = {
    ...household,
    purchases: [...(household.purchases ?? []), purchase],
  };

  if (input.automationId) {
    next = applyReceivedPrice(next, input.automationId, input.actualCost, now);
  } else if (input.kind === "consumable") {
    next = {
      ...next,
      consumables: next.consumables.map((item) => {
        const matchAsset = Boolean(input.assetId) && item.assetId === input.assetId;
        const matchName = item.name === input.label;
        return matchAsset || matchName
          ? { ...item, lastPaidPrice: input.actualCost, lastReplacedAt: input.completedOn }
          : item;
      }),
    };
  }

  if (input.dutyId) {
    const completionId = uid();
    next = {
      ...next,
      completions: [
        ...next.completions,
        {
          id: completionId,
          dutyId: input.dutyId,
          actor: "me",
          visitId: null,
          completedAt: purchase.completedAt,
        },
      ],
    };
    next = applyCompletionCost(next, completionId, { actualCost: input.actualCost });
  }

  return next;
}
