"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { todayISO } from "@/lib/dates";
import { sanitizeText, TEXT_LIMITS } from "@/lib/sanitize";
import {
  EMPTY_HOUSEHOLD,
  eraseHousehold,
  getHousehold,
  hydrateHousehold,
  subscribeHousehold,
  updateHousehold,
  type HouseholdLoad,
} from "@/lib/storage";
import { applyPostalCode, isValidUsZip, normalizeUsZip } from "@/lib/climate";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import type { DutyDraft, Household } from "@/lib/types";
import type { OnboardingAnswers } from "@/lib/onboarding/generate";
import { fetchForecastFor } from "@/lib/weather/client";
import { generateHomeFromAnswers } from "@/lib/onboarding/generate";
import { dutyFromPlaybookTask, PLAYBOOKS } from "@/lib/playbooks";
import { addDays, toISODate } from "@/lib/dates";
import { DEFAULT_RESTOCK_DIGEST } from "@/lib/digest";
import { requestNotifyPermission } from "@/lib/notifications";
import {
  consumeLinkedUnit,
  defaultConsumableFields,
  linkedDutyIdsFor,
  markConsumableOrdered,
  receiveConsumable,
  restoreLinkedUnit,
  saveRetailerLink,
} from "@/lib/restock";
import { DEFAULT_LEAD_TIME_DAYS, DEFAULT_QUANTITY } from "@/lib/supply";
import type { RestockDigestSettings } from "@/lib/types";

function uid() {
  return crypto.randomUUID();
}

export function useHousehold() {
  const [household, setHousehold] = useState<Household>(EMPTY_HOUSEHOLD);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<Exclude<HouseholdLoad, { ok: true }> | null>(null);
  const [legacyLockedVault, setLegacyLockedVault] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeHousehold(() => {
      if (!cancelled) setHousehold(getHousehold());
    });

    void (async () => {
      const result = await hydrateHousehold();
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result);
        setHydrated(true);
        return;
      }
      setLoadError(null);
      setLegacyLockedVault(result.legacyLockedVault);
      setHousehold(getHousehold());
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const update = useCallback((updater: (current: Household) => Household) => {
    updateHousehold(updater);
  }, []);

  const completeOnboarding = useCallback(
    (input: { answers: OnboardingAnswers; ownerName?: string }) => {
      const generated = generateHomeFromAnswers(input.answers);
      const seasonalDuties = generated.seasonalSuggestions
        .filter((playbook) => playbook.climateZones === "all")
        .flatMap((playbook) =>
          playbook.tasks.map((task) => ({
            id: uid(),
            createdAt: new Date().toISOString(),
            ...dutyFromPlaybookTask(generated, playbook, task, toISODate(addDays(new Date(), 14))),
          })),
        );
      update(() =>
        withHouseholdDefaults({
          version: 7,
          householdName: sanitizeText(generated.householdName, TEXT_LIMITS.name) || "Home",
          ownerName: sanitizeText(input.ownerName, TEXT_LIMITS.name) || "",
          cleanerName: "Cleaner",
          onboarded: true,
          mode: "owner",
          activeVisitId: null,
          homeId: generated.homeId,
          homeType: generated.homeType,
          location: generated.location,
          attributes: generated.attributes,
          floors: generated.floors,
          rooms: generated.rooms,
          assets: generated.assets,
          consumables: generated.consumables,
          duties: [...generated.duties, ...seasonalDuties],
          completions: [],
          visits: [],
          supplyAutomations: [],
          restockDigest: { ...DEFAULT_RESTOCK_DIGEST },
        }),
      );
      setHousehold(getHousehold());
    },
    [update],
  );

  const saveDuty = useCallback(
    (duty: DutyDraft) => {
      update((current) => {
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
                createdAt: new Date().toISOString(),
                archived: false,
              },
            ];

        const existing = current.supplyAutomations.find(
          (item) => item.id === supplyAutomation?.id || linkedDutyIdsFor(item).includes(id),
        );
        const defaults = defaultConsumableFields();
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
                    linkedDutyIds: [...new Set([id, ...(existing?.linkedDutyIds ?? []), ...(supplyAutomation.linkedDutyIds ?? [])])],
                    room: rest.room,
                    nodeId,
                    nodeType,
                    itemName: sanitizeText(supplyAutomation.itemName, TEXT_LIMITS.title) || title,
                    sku: sanitizeText(supplyAutomation.sku ?? existing?.sku, TEXT_LIMITS.sku),
                    retailerUrl: sanitizeText(supplyAutomation.retailerUrl ?? existing?.retailerUrl, TEXT_LIMITS.url),
                    quantity: Math.min(
                      99,
                      Math.max(1, supplyAutomation.qtyPerOrder ?? supplyAutomation.quantity ?? existing?.qtyPerOrder ?? DEFAULT_QUANTITY),
                    ),
                    onHand: Math.max(0, supplyAutomation.onHand ?? existing?.onHand ?? 0),
                    qtyPerOrder: Math.min(
                      99,
                      Math.max(1, supplyAutomation.qtyPerOrder ?? supplyAutomation.quantity ?? existing?.qtyPerOrder ?? DEFAULT_QUANTITY),
                    ),
                    leadTimeDays: Math.min(90, Math.max(0, supplyAutomation.leadTimeDays ?? existing?.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS)),
                    installedAt: supplyAutomation.installedAt ?? existing?.installedAt ?? defaults.installedAt,
                    lifespanValue: Math.max(1, supplyAutomation.lifespanValue ?? existing?.lifespanValue ?? 12),
                    lifespanUnit: supplyAutomation.lifespanUnit ?? existing?.lifespanUnit ?? "months",
                    orderByDate: supplyAutomation.orderByDate ?? existing?.orderByDate ?? defaults.orderByDate,
                    nextOrderDate: supplyAutomation.orderByDate ?? existing?.nextOrderDate ?? defaults.nextOrderDate,
                    orderInFlight: existing?.orderInFlight ?? false,
                    state: existing?.state ?? "stocked",
                    expectedArrivalDate: existing?.expectedArrivalDate ?? null,
                    createdAt: existing?.createdAt ?? new Date().toISOString(),
                  },
                ];
        if (firstConsumable && !current.restockDigest.permissionAsked) {
          void requestNotifyPermission();
        }

        return {
          ...current,
          version: 7,
          duties: nextDuty,
          supplyAutomations,
          restockDigest: firstConsumable
            ? { ...current.restockDigest, permissionAsked: true }
            : current.restockDigest,
        };
      });
    },
    [update],
  );

  const markSupplyOrdered = useCallback(
    (id: string) => {
      update((current) => ({
        ...current,
        supplyAutomations: current.supplyAutomations.map((item) =>
          item.id === id ? markConsumableOrdered(item) : item,
        ),
      }));
    },
    [update],
  );

  const markSupplyReceived = useCallback(
    (id: string, qty: number) => {
      update((current) => ({
        ...current,
        supplyAutomations: current.supplyAutomations.map((item) =>
          item.id === id ? receiveConsumable(item, qty) : item,
        ),
      }));
    },
    [update],
  );

  const saveSupplyLink = useCallback(
    (id: string, url: string) => {
      update((current) => ({
        ...current,
        supplyAutomations: current.supplyAutomations.map((item) =>
          item.id === id ? saveRetailerLink(item, url) : item,
        ),
      }));
    },
    [update],
  );

  const attachSharedLink = useCallback(
    (url: string, consumableId?: string) => {
      update((current) => {
        if (consumableId) {
          return {
            ...current,
            supplyAutomations: current.supplyAutomations.map((item) =>
              item.id === consumableId ? saveRetailerLink(item, url) : item,
            ),
          };
        }
        const defaults = defaultConsumableFields();
        return {
          ...current,
          supplyAutomations: [
            ...current.supplyAutomations,
            {
              ...defaults,
              id: uid(),
              dutyId: "",
              linkedDutyIds: [],
              room: current.rooms.find((room) => !room.system)?.id ?? "kitchen",
              nodeId: current.rooms.find((room) => !room.system)?.id ?? "kitchen",
              nodeType: "room" as const,
              itemName: "New consumable",
              retailerUrl: url,
              createdAt: new Date().toISOString(),
            },
          ],
          restockDigest: current.restockDigest.permissionAsked
            ? current.restockDigest
            : { ...current.restockDigest, permissionAsked: true },
        };
      });
      if (!consumableId) void requestNotifyPermission();
    },
    [update],
  );

  const updateRestockDigest = useCallback(
    (patch: Partial<RestockDigestSettings>) => {
      update((current) => ({
        ...current,
        restockDigest: { ...current.restockDigest, ...patch },
      }));
    },
    [update],
  );

  const deleteDuty = useCallback(
    (id: string) => {
      update((current) => ({
        ...current,
        duties: current.duties.filter((duty) => duty.id !== id),
        completions: current.completions.filter((item) => item.dutyId !== id),
        supplyAutomations: current.supplyAutomations.map((item) => ({
          ...item,
          linkedDutyIds: linkedDutyIdsFor(item).filter((dutyId) => dutyId !== id),
          dutyId: item.dutyId === id ? linkedDutyIdsFor(item).find((dutyId) => dutyId !== id) ?? "" : item.dutyId,
        })),
      }));
    },
    [update],
  );

  const completeDuty = useCallback(
    (dutyId: string) => {
      update((current) => ({
        ...current,
        completions: [
          ...current.completions,
          {
            id: uid(),
            dutyId,
            actor: current.mode === "cleaner" ? "cleaner" : "me",
            visitId: current.activeVisitId,
            completedAt: new Date().toISOString(),
          },
        ],
        supplyAutomations: current.supplyAutomations.map((item) =>
          linkedDutyIdsFor(item).includes(dutyId) ? consumeLinkedUnit(item) : item,
        ),
      }));
    },
    [update],
  );

  const undoCompletion = useCallback(
    (dutyId: string) => {
      update((current) => {
        const latest = [...current.completions].reverse().find((item) => item.dutyId === dutyId);
        if (!latest) return current;
        return {
          ...current,
          completions: current.completions.filter((item) => item.id !== latest.id),
          supplyAutomations: current.supplyAutomations.map((item) =>
            linkedDutyIdsFor(item).includes(dutyId) ? restoreLinkedUnit(item) : item,
          ),
        };
      });
    },
    [update],
  );

  const updateTree = useCallback(
    (updater: (current: Household) => Household) => {
      update((current) => ({ ...updater(current), version: 7 }));
    },
    [update],
  );

  const updateHome = useCallback(
    async (
      patch: Partial<
        Pick<
          Household,
          | "householdName"
          | "ownerName"
          | "cleanerName"
          | "location"
          | "attributes"
          | "lockSettings"
          | "homeType"
        >
      >,
    ) => {
      update((current) => ({
        ...current,
        householdName:
          patch.householdName === undefined
            ? current.householdName
            : sanitizeText(patch.householdName, TEXT_LIMITS.name) || current.householdName,
        ownerName:
          patch.ownerName === undefined
            ? current.ownerName
            : sanitizeText(patch.ownerName, TEXT_LIMITS.name) || current.ownerName,
        cleanerName:
          patch.cleanerName === undefined
            ? current.cleanerName
            : sanitizeText(patch.cleanerName, TEXT_LIMITS.name) || "Cleaner",
        location: patch.location
          ? patch.location.postalCode !== undefined
            ? applyPostalCode(
                current.location,
                patch.location.postalCode,
                patch.location.lat != null && patch.location.lng != null
                  ? { lat: patch.location.lat, lng: patch.location.lng }
                  : undefined,
              )
            : { ...current.location, ...patch.location }
          : current.location,
        attributes: patch.attributes ?? current.attributes,
        lockSettings: patch.lockSettings ?? current.lockSettings,
        homeType: patch.homeType ?? current.homeType,
      }));
    },
    [update],
  );

  const savePostalCode = useCallback(
    async (zip: string) => {
      const postalCode = normalizeUsZip(zip);
      if (!isValidUsZip(postalCode)) {
        return { ok: false as const, error: "Enter a 5-digit US ZIP" };
      }
      let coords: { lat: number; lng: number } | undefined;
      try {
        const result = await fetchForecastFor({ postalCode });
        if (result) coords = { lat: result.lat, lng: result.lng };
      } catch {
        // Climate still persists if weather lookup is offline.
      }
      update((current) => ({
        ...current,
        location: applyPostalCode(current.location, postalCode, coords),
      }));
      return { ok: true as const };
    },
    [update],
  );

  const markAssetReplaced = useCallback(
    (assetId: string) => {
      update((current) => ({
        ...current,
        assets: current.assets.map((asset) =>
          asset.id === assetId ? { ...asset, installDate: todayISO(), condition: "good" as const } : asset,
        ),
      }));
    },
    [update],
  );

  const acceptPlaybook = useCallback(
    (playbookId: string, taskTitles?: string[]) => {
      update((current) => {
        const def = PLAYBOOKS.find((item) => item.id === playbookId);
        if (!def) return current;
        const year = new Date().getFullYear();
        const titles = new Set(taskTitles ?? def.tasks.map((task) => task.title));
        const duties = def.tasks
          .filter((task) => titles.has(task.title))
          .map((task) => ({
            id: uid(),
            createdAt: new Date().toISOString(),
            ...dutyFromPlaybookTask(current, def, task, toISODate(addDays(new Date(), 14))),
          }));
        const declined = def.tasks.filter((task) => !titles.has(task.title)).map((task) => task.title);
        return {
          ...current,
          duties: [...current.duties, ...duties],
          playbookDecisions: [
            ...current.playbookDecisions.filter((item) => !(item.playbookId === playbookId && item.year === year)),
            { playbookId, year, declinedTaskKeys: declined },
          ],
        };
      });
    },
    [update],
  );

  const declinePlaybook = useCallback(
    (playbookId: string) => {
      update((current) => {
        const year = new Date().getFullYear();
        return {
          ...current,
          playbookDecisions: [
            ...current.playbookDecisions.filter((item) => !(item.playbookId === playbookId && item.year === year)),
            { playbookId, year, declinedTaskKeys: ["*"] },
          ],
        };
      });
    },
    [update],
  );

  const startCleanerVisit = useCallback(() => {
    update((current) => {
      const visit = {
        id: uid(),
        cleanerName: current.cleanerName || "Cleaner",
        startedAt: new Date().toISOString(),
        endedAt: null,
      };
      return {
        ...current,
        mode: "cleaner" as const,
        activeVisitId: visit.id,
        visits: [...current.visits, visit],
      };
    });
  }, [update]);

  const endCleanerVisit = useCallback(() => {
    update((latest) => ({
      ...latest,
      mode: "owner",
      activeVisitId: null,
      visits: latest.visits.map((visit) =>
        visit.id === latest.activeVisitId ? { ...visit, endedAt: new Date().toISOString() } : visit,
      ),
    }));
  }, [update]);

  const retryLoad = useCallback(async () => {
    const result = await hydrateHousehold();
    if (!result.ok) {
      setLoadError(result);
      return;
    }
    setLoadError(null);
    setLegacyLockedVault(result.legacyLockedVault);
    setHousehold(getHousehold());
  }, []);

  const eraseEverything = useCallback(async () => {
    await eraseHousehold();
    setLoadError(null);
    setLegacyLockedVault(false);
    setHousehold(getHousehold());
  }, []);

  const activeDuties = useMemo(
    () => household.duties.filter((duty) => !duty.archived),
    [household.duties],
  );

  return {
    household,
    hydrated,
    loadError,
    legacyLockedVault,
    activeDuties,
    completeOnboarding,
    saveDuty,
    markSupplyOrdered,
    markSupplyReceived,
    saveSupplyLink,
    attachSharedLink,
    updateRestockDigest,
    deleteDuty,
    completeDuty,
    undoCompletion,
    updateHome,
    savePostalCode,
    updateTree,
    markAssetReplaced,
    acceptPlaybook,
    declinePlaybook,
    startCleanerVisit,
    endCleanerVisit,
    retryLoad,
    eraseEverything,
  };
}
