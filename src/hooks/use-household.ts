"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { todayISO } from "@/lib/dates";
import { useNow } from "@/hooks/use-now";
import { sanitizeText, TEXT_LIMITS } from "@/lib/sanitize";
import {
  EMPTY_HOUSEHOLD,
  eraseHousehold,
  exportHouseholdBackup,
  getHousehold,
  getHouseholdLoad,
  getVaultSessionMeta,
  hydrateHousehold,
  importHouseholdBackup,
  isHouseholdSessionUnlocked,
  lockHouseholdSession,
  canUndoLastRestore,
  undoLastRestore,
  subscribeHousehold,
  unlockHousehold,
  updateHousehold,
  type HouseholdLoad,
  type UnlockHouseholdResult,
  type VaultSessionMeta,
} from "@/lib/storage";
import { applyCompletionCost, applyReceivedPrice } from "@/lib/costs";
import { applyPostalCode, isValidUsZip, normalizeUsZip } from "@/lib/climate";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { applyDutySave } from "@/lib/household-update";
import type {
  DutyDraft,
  Household,
  Completion,
  Duty,
  MomentumSettings,
  MorningBriefSettings,
  RestockDigestSettings,
} from "@/lib/types";
import { applyMomentumOnComplete } from "@/lib/momentum";
import { reconcileCareLevel } from "@/lib/care-level";
import type { OnboardingAnswers } from "@/lib/onboarding/generate";
import { fetchForecastFor } from "@/lib/weather/client";
import { generateHomeFromAnswers, seedDutiesForHome } from "@/lib/onboarding/generate";
import { applyRestockPicks, type RestockPick } from "@/lib/onboarding/restock-walk";
import { dutyFromPlaybookTask, PLAYBOOKS, seasonYearFor } from "@/lib/playbooks";
import { dedupePlaybookTasks } from "@/lib/duty-topics";
import { addDays, toISODate } from "@/lib/dates";
import { DEFAULT_RESTOCK_DIGEST } from "@/lib/digest";
import { DEFAULT_MORNING_BRIEF } from "@/lib/morning-brief";
import { requestNotifyPermission } from "@/lib/notifications";
import { rememberRetailerLink } from "@/lib/retailer";
import {
  applyLearnedLeadTime,
  applyCheckin,
  changeArrivalDate,
  consumeLinkedUnit,
  defaultConsumableFields,
  linkedDutyIdsFor,
  markConsumableOrdered,
  neverCameConsumable,
  receiveConsumable,
  restoreLinkedUnit,
  saveRetailerLink,
  stillWaitingConsumable,
  type CheckinLevel,
  type MarkOrderedDetails,
} from "@/lib/restock";
import { tActive } from "@/i18n";
import { tDutyTitle } from "@/i18n/content";
import { hapticDestructive, hapticUndo } from "@/lib/native/haptics";
import { toast } from "sonner";

function uid() {
  return crypto.randomUUID();
}

export function useHousehold() {
  const [household, setHousehold] = useState<Household>(EMPTY_HOUSEHOLD);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<Exclude<HouseholdLoad, { ok: true }> | null>(null);
  const [legacyLockedVault, setLegacyLockedVault] = useState(false);
  const [pendingUnlock, setPendingUnlock] = useState(false);
  const [sessionMeta, setSessionMeta] = useState<VaultSessionMeta | null>(null);
  const [sessionUnlocked, setSessionUnlocked] = useState(true);
  const [canUndoRestore, setCanUndoRestore] = useState(false);

  const syncFromStore = useCallback(() => {
    const unlocked = isHouseholdSessionUnlocked();
    const load = getHouseholdLoad();
    setHousehold(getHousehold());
    setSessionMeta(getVaultSessionMeta());
    setSessionUnlocked(unlocked);
    setPendingUnlock(!unlocked && Boolean(load?.ok));
    setCanUndoRestore(canUndoLastRestore());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeHousehold(() => {
      if (!cancelled) syncFromStore();
    });

    void (async () => {
      const result = await hydrateHousehold();
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result);
        setPendingUnlock(false);
        setHydrated(true);
        syncFromStore();
        return;
      }
      setLoadError(null);
      setLegacyLockedVault(result.legacyLockedVault);
      setPendingUnlock(Boolean(result.pendingUnlock));
      syncFromStore();
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [syncFromStore]);

  const now = useNow();
  useEffect(() => {
    if (!hydrated || !sessionUnlocked || pendingUnlock) return;
    const current = getHousehold();
    const next = reconcileCareLevel(current, now);
    if (next !== current) updateHousehold(() => next);
  }, [hydrated, sessionUnlocked, pendingUnlock, now]);

  const update = useCallback((updater: (current: Household) => Household) => {
    updateHousehold(updater);
  }, []);

  const completeOnboarding = useCallback(
    (input: { answers: OnboardingAnswers; ownerName?: string }) => {
      const generated = generateHomeFromAnswers(input.answers);
      const now = new Date();
      const seeded = applyRestockPicks(
        withHouseholdDefaults({
          version: 8,
          householdName: sanitizeText(generated.householdName, TEXT_LIMITS.name) || "Home",
          ownerName: sanitizeText(input.ownerName, TEXT_LIMITS.name) || "",
          cleanerName: "",
          onboarded: true,
          mode: "owner",
          activeVisitId: null,
          homeId: generated.homeId,
          homeType: generated.homeType,
          tenure: generated.tenure,
          location: generated.location,
          attributes: generated.attributes,
          floors: generated.floors,
          rooms: generated.rooms,
          assets: generated.assets,
          consumables: generated.consumables,
          duties: seedDutiesForHome(generated, now),
          completions: [],
          visits: [],
          supplyAutomations: [],
          playbookDecisions: generated.seasonalSuggestions
            .filter((item) => item.playbook.id === "new-home")
            .map((item) => ({
              playbookId: item.playbook.id,
              year: new Date().getFullYear(),
              declinedTaskKeys: [],
            })),
          restockDigest: { ...DEFAULT_RESTOCK_DIGEST },
          morningBrief: { ...DEFAULT_MORNING_BRIEF },
          preferredRetailers: input.answers.preferredRetailers ?? [],
          teaching: {
            startedAt: toISODate(new Date()),
            checkedChore: false,
            openedRestock: false,
            setDigestOrZip: Boolean(generated.location.postalCode),
          },
          seenTips: [],
        }),
        input.answers.restockPicks ?? [],
      );
      update(() => seeded);
      setHousehold(getHousehold());
    },
    [update],
  );

  const saveDuty = useCallback(
    (duty: DutyDraft) => {
      update((current) => {
        const next = applyDutySave(current, duty);
        if (
          next.supplyAutomations.length > current.supplyAutomations.length &&
          !current.restockDigest.permissionAsked
        ) {
          void requestNotifyPermission();
        }
        return next;
      });
    },
    [update],
  );

  const markSupplyOrdered = useCallback(
    (id: string, details: MarkOrderedDetails) => {
      update((current) => ({
        ...current,
        supplyAutomations: current.supplyAutomations.map((item) =>
          item.id === id ? markConsumableOrdered(item, details) : item,
        ),
      }));
    },
    [update],
  );

  const markSupplyReceived = useCallback(
    (id: string, qty: number, paid?: number) => {
      update((current) => {
        const received = {
          ...current,
          supplyAutomations: current.supplyAutomations.map((item) =>
            item.id === id ? receiveConsumable(item, qty) : item,
          ),
        };
        return paid != null ? applyReceivedPrice(received, id, paid) : received;
      });
    },
    [update],
  );

  const checkinSupply = useCallback(
    (id: string, level: CheckinLevel) => {
      update((current) => ({
        ...current,
        supplyAutomations: current.supplyAutomations.map((item) =>
          item.id === id ? applyCheckin(item, level, current) : item,
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
        savedRetailerLinks: rememberRetailerLink(current.savedRetailerLinks, url),
      }));
    },
    [update],
  );

  const preferSupplyRetailer = useCallback(
    (id: string, retailer: string) => {
      const value = retailer.trim();
      if (!value) return;
      update((current) => ({
        ...current,
        supplyAutomations: current.supplyAutomations.map((item) =>
          item.id === id ? { ...item, preferredRetailer: value } : item,
        ),
      }));
    },
    [update],
  );

  const stillWaitingSupply = useCallback(
    (id: string) => {
      update((current) => ({
        ...current,
        supplyAutomations: current.supplyAutomations.map((item) =>
          item.id === id ? stillWaitingConsumable(item) : item,
        ),
      }));
    },
    [update],
  );

  const neverCameSupply = useCallback(
    (id: string) => {
      update((current) => ({
        ...current,
        supplyAutomations: current.supplyAutomations.map((item) =>
          item.id === id ? neverCameConsumable(item) : item,
        ),
      }));
    },
    [update],
  );

  const changeSupplyArrival = useCallback(
    (id: string, expectedArrivalDate: string) => {
      const date = expectedArrivalDate.trim();
      if (!date) return;
      update((current) => ({
        ...current,
        supplyAutomations: current.supplyAutomations.map((item) =>
          item.id === id ? changeArrivalDate(item, date) : item,
        ),
      }));
    },
    [update],
  );

  const applySupplyLeadTime = useCallback(
    (id: string, days: number) => {
      update((current) => ({
        ...current,
        supplyAutomations: current.supplyAutomations.map((item) =>
          item.id === id ? applyLearnedLeadTime(item, days) : item,
        ),
      }));
    },
    [update],
  );

  const attachSharedLink = useCallback(
    (url: string, consumableId?: string) => {
      update((current) => {
        const savedRetailerLinks = rememberRetailerLink(current.savedRetailerLinks, url);
        if (consumableId) {
          return {
            ...current,
            supplyAutomations: current.supplyAutomations.map((item) =>
              item.id === consumableId ? saveRetailerLink(item, url) : item,
            ),
            savedRetailerLinks,
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
              itemName: tActive("supply.newItem"),
              retailerUrl: url,
              createdAt: new Date().toISOString(),
            },
          ],
          savedRetailerLinks,
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
        teaching:
          patch.enabled === true || patch.permissionAsked === true
            ? { ...current.teaching, setDigestOrZip: true }
            : current.teaching,
      }));
    },
    [update],
  );

  const updateMorningBrief = useCallback(
    (patch: Partial<MorningBriefSettings>) => {
      update((current) => ({
        ...current,
        morningBrief: { ...current.morningBrief, ...patch },
      }));
    },
    [update],
  );

  const updateMomentum = useCallback(
    (patch: Partial<MomentumSettings>) => {
      update((current) => ({
        ...current,
        momentum: { ...current.momentum, ...patch },
      }));
    },
    [update],
  );

  const restoreDuty = useCallback(
    (duty: Duty, completions: Completion[]) => {
      update((current) => {
        if (current.duties.some((item) => item.id === duty.id)) return current;
        return {
          ...current,
          duties: [...current.duties, duty],
          completions: [
            ...current.completions,
            ...completions.filter((item) => !current.completions.some((existing) => existing.id === item.id)),
          ],
        };
      });
      void hapticUndo();
    },
    [update],
  );

  const deleteDuty = useCallback(
    (id: string) => {
      let removed: Duty | undefined;
      let removedCompletions: Completion[] = [];
      update((current) => {
        removed = current.duties.find((duty) => duty.id === id);
        removedCompletions = current.completions.filter((item) => item.dutyId === id);
        return {
          ...current,
          duties: current.duties.filter((duty) => duty.id !== id),
          completions: current.completions.filter((item) => item.dutyId !== id),
          supplyAutomations: current.supplyAutomations.map((item) => ({
            ...item,
            linkedDutyIds: linkedDutyIdsFor(item).filter((dutyId) => dutyId !== id),
            dutyId: item.dutyId === id ? linkedDutyIdsFor(item).find((dutyId) => dutyId !== id) ?? "" : item.dutyId,
          })),
        };
      });
      if (!removed) return;
      const snapshot = { duty: removed, completions: removedCompletions };
      void hapticDestructive();
      toast.message(tActive("common.deletedName", { name: tDutyTitle(snapshot.duty.title) }), {
        duration: 6000,
        action: {
          label: tActive("common.undo"),
          onClick: () => restoreDuty(snapshot.duty, snapshot.completions),
        },
      });
    },
    [restoreDuty, update],
  );

  const completeDuty = useCallback(
    (dutyId: string) => {
      update((current) => {
        const now = new Date();
        const next: Household = {
          ...current,
          teaching: current.teaching.checkedChore
            ? current.teaching
            : { ...current.teaching, checkedChore: true },
          completions: [
            ...current.completions,
            {
              id: uid(),
              dutyId,
              actor: current.mode === "cleaner" ? "cleaner" : "me",
              visitId: current.activeVisitId,
              completedAt: now.toISOString(),
            },
          ],
          supplyAutomations: current.supplyAutomations.map((item) =>
            linkedDutyIdsFor(item).includes(dutyId) ? consumeLinkedUnit(item) : item,
          ),
        };
        return applyMomentumOnComplete(next, now);
      });
    },
    [update],
  );

  const recordCompletionCost = useCallback(
    (completionId: string, input: { actualCost: number } | { skip: true }) => {
      update((current) => applyCompletionCost(current, completionId, input));
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
      update((current) => ({ ...updater(current), version: 8 }));
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
            : sanitizeText(patch.cleanerName, TEXT_LIMITS.name) || tActive("settings.cleanerFallback"),
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
        return { ok: false as const, error: tActive("settings.zipInvalid") };
      }
      let coords: { lat: number; lng: number; placeName?: string } | undefined;
      try {
        const result = await fetchForecastFor({ postalCode });
        if (result) coords = { lat: result.lat, lng: result.lng, placeName: result.placeName };
      } catch {
        // Climate still persists if weather lookup is offline.
      }
      update((current) => ({
        ...current,
        location: applyPostalCode(current.location, postalCode, coords),
        teaching: { ...current.teaching, setDigestOrZip: true },
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
        const now = new Date();
        const year = seasonYearFor(def, now);
        const titles = new Set(taskTitles ?? def.tasks.map((task) => task.title));
        const dueDate = toISODate(addDays(now, 14));
        const duties = dedupePlaybookTasks(
          def.tasks.filter((task) => titles.has(task.title)),
          current.duties,
        ).map((task) => ({
          id: uid(),
          createdAt: now.toISOString(),
          ...dutyFromPlaybookTask(current, def, task, dueDate),
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
        const def = PLAYBOOKS.find((item) => item.id === playbookId);
        const now = new Date();
        const year = def ? seasonYearFor(def, now) : now.getFullYear();
        return {
          ...current,
          playbookDecisions: [
            ...current.playbookDecisions.filter((item) => !(item.playbookId === playbookId && item.year === year)),
            { playbookId, year, declinedTaskKeys: ["*"], disabled: true },
          ],
        };
      });
    },
    [update],
  );

  const reconsiderPlaybook = useCallback(
    (playbookId: string) => {
      update((current) => {
        const def = PLAYBOOKS.find((item) => item.id === playbookId);
        const now = new Date();
        const year = def ? seasonYearFor(def, now) : now.getFullYear();
        return {
          ...current,
          playbookDecisions: current.playbookDecisions.filter(
            (item) => !(item.playbookId === playbookId && item.year === year),
          ),
        };
      });
    },
    [update],
  );

  const startCleanerVisit = useCallback(() => {
    update((current) => {
      const visit = {
        id: uid(),
        cleanerName: current.cleanerName || tActive("settings.cleanerFallback"),
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
      setPendingUnlock(false);
      syncFromStore();
      return;
    }
    setLoadError(null);
    setLegacyLockedVault(result.legacyLockedVault);
    setPendingUnlock(Boolean(result.pendingUnlock));
    syncFromStore();
  }, [syncFromStore]);

  const unlockSession = useCallback(async (reason?: string): Promise<UnlockHouseholdResult> => {
    const result = await unlockHousehold(reason);
    if (result.ok) {
      setLoadError(null);
      setPendingUnlock(false);
      syncFromStore();
      return result;
    }
    if (
      result.reason === "key-mismatch" ||
      result.reason === "corrupt" ||
      result.reason === "unavailable" ||
      result.reason === "passcode_required"
    ) {
      setLoadError({ ok: false, reason: result.reason });
      setPendingUnlock(false);
    }
    syncFromStore();
    return result;
  }, [syncFromStore]);

  const lockSession = useCallback(() => {
    void lockHouseholdSession().then(() => {
      setPendingUnlock(true);
      syncFromStore();
    });
  }, [syncFromStore]);

  const eraseEverything = useCallback(async () => {
    const result = await eraseHousehold();
    if (result.ok) {
      setLoadError(null);
      setLegacyLockedVault(false);
      setPendingUnlock(false);
      syncFromStore();
    }
    return result;
  }, [syncFromStore]);

  const exportBackup = useCallback(async (passphrase: string) => {
    return exportHouseholdBackup(passphrase);
  }, []);

  const importBackup = useCallback(async (raw: string, passphrase: string) => {
    const result = await importHouseholdBackup(raw, passphrase);
    if (result.ok) {
      setLoadError(null);
      setLegacyLockedVault(false);
      setPendingUnlock(false);
      syncFromStore();
    }
    return result;
  }, [syncFromStore]);

  const undoRestore = useCallback(async () => {
    const result = await undoLastRestore();
    if (result.ok) {
      setLoadError(null);
      setLegacyLockedVault(false);
      setPendingUnlock(false);
      syncFromStore();
    }
    return result;
  }, [syncFromStore]);
  const applyRestockWalk = useCallback(
    (picks: RestockPick[]) => {
      update((current) => applyRestockPicks(current, picks));
    },
    [update],
  );

  const activeDuties = useMemo(
    () => household.duties.filter((duty) => !duty.archived),
    [household.duties],
  );

  return {
    household,
    hydrated,
    loadError,
    legacyLockedVault,
    pendingUnlock,
    sessionMeta,
    sessionUnlocked,
    activeDuties,
    completeOnboarding,
    saveDuty,
    markSupplyOrdered,
    markSupplyReceived,
    checkinSupply,
    saveSupplyLink,
    preferSupplyRetailer,
    stillWaitingSupply,
    neverCameSupply,
    changeSupplyArrival,
    applySupplyLeadTime,
    attachSharedLink,
    updateRestockDigest,
    updateMorningBrief,
    updateMomentum,
    deleteDuty,
    completeDuty,
    recordCompletionCost,
    undoCompletion,
    updateHome,
    savePostalCode,
    updateTree,
    markAssetReplaced,
    acceptPlaybook,
    declinePlaybook,
    reconsiderPlaybook,
    startCleanerVisit,
    endCleanerVisit,
    retryLoad,
    unlockSession,
    lockSession,
    eraseEverything,
    exportBackup,
    importBackup,
    canUndoRestore,
    undoRestore,
    applyRestockWalk,
  };
}
