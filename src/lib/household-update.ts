import { sanitizeText, TEXT_LIMITS } from "@/lib/sanitize";
import { rememberRetailerLink } from "@/lib/retailer";
import {
  DEFAULT_REORDER_AT,
  defaultConsumableFields,
  linkedDutyIdsFor,
  reorderAtFor,
} from "@/lib/restock";
import { DEFAULT_LEAD_TIME_DAYS, DEFAULT_QUANTITY } from "@/lib/supply";
import type { DutyDraft, Household } from "@/lib/types";

function uid() {
  return crypto.randomUUID();
}

/**
 * Merges a duty (and optional restock/consumable) into the household.
 * New restock items must not assume "installed today" — that pushed the first
 * order months out, so the add looked like it never stuck.
 */
export function applyDutySave(current: Household, duty: DutyDraft, now = new Date()): Household {
  const { supplyAutomation, ...rest } = duty;
  const id = rest.id ?? uid();
  const kind = rest.kind ?? (supplyAutomation ? "replacement" : "chore");
  const title = sanitizeText(rest.title, TEXT_LIMITS.title);
  const notes = sanitizeText(rest.notes, TEXT_LIMITS.notes);
  const nodeId = rest.nodeId || rest.room;
  const nodeType = rest.nodeType || "room";
  const nextDuty = rest.id
    ? current.duties.map((existing) =>
        existing.id === id
          ? {
              ...existing,
              ...rest,
              title,
              notes,
              nodeId,
              nodeType,
              id: existing.id,
              kind,
              createdAt: existing.createdAt,
              archived: existing.archived,
            }
          : existing,
      )
    : [
        ...current.duties,
        {
          ...rest,
          title,
          notes,
          nodeId,
          nodeType,
          id,
          kind,
          createdAt: now.toISOString(),
          archived: false,
        },
      ];

  const existing = current.supplyAutomations.find(
    (item) => item.id === supplyAutomation?.id || linkedDutyIdsFor(item).includes(id),
  );
  const defaults = defaultConsumableFields(now);
  const without = current.supplyAutomations.filter((item) => item !== existing);
  const firstConsumable = !existing && Boolean(supplyAutomation);
  const supplyAutomations =
    supplyAutomation === undefined
      ? current.supplyAutomations
      : supplyAutomation === null
        ? without
        : [
            ...without,
            {
              ...defaults,
              ...existing,
              id: supplyAutomation.id ?? existing?.id ?? uid(),
              dutyId: existing?.dutyId ?? id,
              linkedDutyIds: [
                ...new Set([id, ...(existing?.linkedDutyIds ?? []), ...(supplyAutomation.linkedDutyIds ?? [])]),
              ],
              room: rest.room,
              nodeId,
              nodeType,
              itemName: sanitizeText(supplyAutomation.itemName, TEXT_LIMITS.title) || title,
              sku: sanitizeText(supplyAutomation.sku ?? existing?.sku, TEXT_LIMITS.sku),
              sizeSpec:
                sanitizeText(
                  supplyAutomation.sizeSpec !== undefined ? supplyAutomation.sizeSpec : existing?.sizeSpec,
                  TEXT_LIMITS.sizeSpec,
                ) || undefined,
              retailerUrl: sanitizeText(supplyAutomation.retailerUrl ?? existing?.retailerUrl, TEXT_LIMITS.url),
              quantity: Math.min(
                99,
                Math.max(
                  1,
                  supplyAutomation.qtyPerOrder ??
                    supplyAutomation.quantity ??
                    existing?.qtyPerOrder ??
                    DEFAULT_QUANTITY,
                ),
              ),
              onHand: Math.max(0, supplyAutomation.onHand ?? existing?.onHand ?? 0),
              reorderAt: reorderAtFor({
                reorderAt: supplyAutomation.reorderAt ?? existing?.reorderAt ?? DEFAULT_REORDER_AT,
              }),
              qtyPerOrder: Math.min(
                99,
                Math.max(
                  1,
                  supplyAutomation.qtyPerOrder ??
                    supplyAutomation.quantity ??
                    existing?.qtyPerOrder ??
                    DEFAULT_QUANTITY,
                ),
              ),
              leadTimeDays: Math.min(
                90,
                Math.max(0, supplyAutomation.leadTimeDays ?? existing?.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS),
              ),
              installedAt: supplyAutomation.installedAt ?? existing?.installedAt ?? "",
              lifespanValue: Math.max(1, supplyAutomation.lifespanValue ?? existing?.lifespanValue ?? 12),
              lifespanUnit: supplyAutomation.lifespanUnit ?? existing?.lifespanUnit ?? "months",
              orderByDate: supplyAutomation.orderByDate ?? existing?.orderByDate ?? defaults.orderByDate,
              nextOrderDate: supplyAutomation.orderByDate ?? existing?.nextOrderDate ?? defaults.nextOrderDate,
              orderInFlight: existing?.orderInFlight ?? false,
              state: existing?.state ?? "stocked",
              expectedArrivalDate: existing?.expectedArrivalDate ?? null,
              createdAt: existing?.createdAt ?? now.toISOString(),
              preferredRetailer: supplyAutomation.preferredRetailer ?? existing?.preferredRetailer,
              unitCost: supplyAutomation.unitCost ?? existing?.unitCost,
            },
          ];

  const savedUrl =
    supplyAutomation && supplyAutomation !== null
      ? sanitizeText(supplyAutomation.retailerUrl ?? existing?.retailerUrl, TEXT_LIMITS.url)
      : "";

  return {
    ...current,
    version: 8,
    duties: nextDuty,
    supplyAutomations,
    savedRetailerLinks: savedUrl
      ? rememberRetailerLink(current.savedRetailerLinks ?? [], savedUrl, now)
      : current.savedRetailerLinks ?? [],
    restockDigest: firstConsumable
      ? { ...current.restockDigest, permissionAsked: true }
      : current.restockDigest,
  };
}
