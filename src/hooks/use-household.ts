"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { todayISO } from "@/lib/dates";
import { sanitizeText, TEXT_LIMITS } from "@/lib/sanitize";
import {
  EMPTY_HOUSEHOLD,
  getGate,
  getHousehold,
  getVaultId,
  hydrateHouseholdFromStorage,
  joinRemoteHousehold,
  resetHousehold,
  subscribeHousehold,
  unlockHousehold,
  updateHousehold,
  wrapHousehold,
  type Gate,
  type HouseholdLoad,
} from "@/lib/storage";
import { treeFromDraft, type HomeTreeDraft } from "@/lib/home-model";
import { applyPostalCode, isValidUsZip, normalizeUsZip } from "@/lib/climate";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import type { Account, DutyDraft, Household } from "@/lib/types";
import type { StarterDuty } from "@/lib/constants";
import type { OnboardingAnswers } from "@/lib/onboarding/generate";
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
  const [gate, setGate] = useState<Gate>("empty");
  const [vaultId, setVaultId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<Exclude<HouseholdLoad, { ok: true }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeHousehold(() => {
      if (!cancelled) {
        setHousehold(getHousehold());
        setGate(getGate());
        setVaultId(getVaultId());
      }
    });

    void (async () => {
      const result = await hydrateHouseholdFromStorage();
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result);
        setHydrated(true);
        return;
      }
      setLoadError(null);
      setGate(result.gate);
      setVaultId(getVaultId());
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
    async (input: {
      householdName?: string;
      ownerName?: string;
      cleanerName?: string;
      ownerPin?: string;
      starters?: StarterDuty[];
      tree?: HomeTreeDraft;
      answers?: OnboardingAnswers;
      account?: Account;
      vaultSecret?: string;
    }) => {
      const generated = input.answers ? generateHomeFromAnswers(input.answers) : null;
      // Temporary: skip hashing / wrapping with an owner PIN so first paint is never gated.
      const tree = generated
        ? {
            homeId: generated.homeId,
            floors: generated.floors,
            rooms: generated.rooms,
            assets: generated.assets,
          }
        : input.tree
          ? treeFromDraft({ ...input.tree, homeName: input.householdName || input.answers?.nickname || "Home" })
          : treeFromDraft({
              homeName: input.householdName || "Home",
              floors: [],
              rooms: [],
            });
      const seasonalDuties =
        generated?.seasonalSuggestions
          .filter((playbook) => playbook.climateZones === "all")
          .flatMap((playbook) =>
            playbook.tasks.map((task) => ({
              id: uid(),
              createdAt: new Date().toISOString(),
              ...dutyFromPlaybookTask(generated, playbook, task, toISODate(addDays(new Date(), 14))),
            })),
          ) ?? [];
      update(() =>
        withHouseholdDefaults({
          version: 7,
          householdName:
            sanitizeText(generated?.householdName ?? input.householdName, TEXT_LIMITS.name) || "Home",
          ownerName: sanitizeText(input.ownerName, TEXT_LIMITS.name) || "Me",
          cleanerName: sanitizeText(input.cleanerName, TEXT_LIMITS.name) || "Cleaner",
          ownerPin: "",
          onboarded: true,
          mode: "owner",
          activeVisitId: null,
          homeId: tree.homeId,
          homeType: generated?.homeType ?? "house",
          location: generated?.location ?? {},
          attributes: generated?.attributes,
          floors: tree.floors,
          rooms: tree.rooms,
          assets: generated?.assets ?? tree.assets,
          consumables: generated?.consumables ?? [],
          duties: generated
            ? [...generated.duties, ...seasonalDuties]
            : (input.starters ?? []).map((starter) => ({
                id: uid(),
                title: sanitizeText(starter.title, TEXT_LIMITS.title),
                notes: "",
                room: starter.room,
                nodeId: starter.room,
                nodeType: "room" as const,
                audience: starter.audience,
                effort: starter.effort,
                frequency: starter.frequency,
                kind: "chore" as const,
                weekday: starter.weekday,
                monthDay: starter.monthDay,
                dueDate: starter.frequency === "once" ? todayISO() : null,
                priority: starter.priority,
                createdAt: new Date().toISOString(),
                archived: false,
                origin: "starter" as const,
              })),
          completions: [],
          visits: [],
          supplyAutomations: [],
          account: input.account ?? { providers: [] },
          restockDigest: { ...DEFAULT_RESTOCK_DIGEST },
        }),
      );
      setGate(getGate());
      setVaultId(getVaultId());
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
                    asin: sanitizeText(supplyAutomation.asin ?? existing?.asin, TEXT_LIMITS.asin),
                    amazonProductUrl: sanitizeText(
                      supplyAutomation.retailerUrl ??
                        supplyAutomation.amazonProductUrl ??
                        existing?.retailerUrl ??
                        existing?.amazonProductUrl,
                      TEXT_LIMITS.url,
                    ),
                    amazonOneClick: false,
                    amazonNotes: sanitizeText(
                      supplyAutomation.amazonNotes ?? existing?.amazonNotes,
                      TEXT_LIMITS.notes,
                    ),
                    retailerUrl: sanitizeText(
                      supplyAutomation.retailerUrl ??
                        supplyAutomation.amazonProductUrl ??
                        existing?.retailerUrl ??
                        existing?.amazonProductUrl,
                      TEXT_LIMITS.url,
                    ),
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
              amazonProductUrl: url,
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
          | "ownerPin"
          | "location"
          | "attributes"
          | "lockSettings"
          | "account"
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
        account: patch.account ?? current.account,
        homeType: patch.homeType ?? current.homeType,
      }));
      setVaultId(getVaultId());
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
        const response = await fetch(`/api/weather?zip=${encodeURIComponent(postalCode)}`, {
          cache: "no-store",
        });
        if (response.ok) {
          const payload = (await response.json()) as { lat?: number; lng?: number };
          if (typeof payload.lat === "number" && typeof payload.lng === "number") {
            coords = { lat: payload.lat, lng: payload.lng };
          }
        }
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

  const endCleanerVisit = useCallback(async (_pin: string) => {
    // Temporary: owner PIN is disabled — end the visit without asking for one.
    update((latest) => ({
      ...latest,
      mode: "owner",
      activeVisitId: null,
      visits: latest.visits.map((visit) =>
        visit.id === latest.activeVisitId ? { ...visit, endedAt: new Date().toISOString() } : visit,
      ),
    }));
    return true;
  }, [update]);

  const retryLoad = useCallback(async () => {
    const result = await hydrateHouseholdFromStorage();
    if (!result.ok) {
      setLoadError(result);
      return;
    }
    setLoadError(null);
    setGate(result.gate);
    setVaultId(getVaultId());
    setHousehold(getHousehold());
  }, []);

  const startFresh = useCallback(() => {
    resetHousehold();
    setLoadError(null);
    setGate("empty");
    setVaultId(null);
    setHousehold(getHousehold());
  }, []);

  const unlock = useCallback(async (secret: string) => {
    const ok = await unlockHousehold(secret);
    if (ok) {
      setGate(getGate());
      setVaultId(getVaultId());
      setHousehold(getHousehold());
    }
    return ok;
  }, []);

  const wrap = useCallback(async (secret: string) => {
    const ok = await wrapHousehold(secret);
    if (ok) {
      setGate(getGate());
      setVaultId(getVaultId());
      setHousehold(getHousehold());
    }
    return ok;
  }, []);

  const joinRemote = useCallback(async (id: string, secret: string) => {
    const ok = await joinRemoteHousehold(id, secret);
    if (ok) {
      setGate(getGate());
      setVaultId(getVaultId());
      setHousehold(getHousehold());
    }
    return ok;
  }, []);

  const activeDuties = useMemo(
    () => household.duties.filter((duty) => !duty.archived),
    [household.duties],
  );

  return {
    household,
    hydrated,
    gate,
    vaultId,
    loadError,
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
    startFresh,
    unlock,
    wrap,
    joinRemote,
  };
}
