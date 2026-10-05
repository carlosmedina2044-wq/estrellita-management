import { parseStored } from "@/lib/storage/migrate";
import { DEVICE_ONLY_KEYS } from "@/lib/sync/merge";
import { SYNC_COLLECTIONS } from "@/lib/sync/model";
import type { Completion, Duty, Household, SupplyAutomation } from "@/lib/types";

/** Test-only helpers shared by the sync suites. */

export const T0 = Date.parse("2026-09-01T08:00:00.000Z");
export const at = (ms: number) => new Date(ms).toISOString();

/** A loadable, empty, onboarded home. */
export function baseHome(): Household {
  return parseStored(JSON.stringify({ onboarded: true, householdName: "Casa", ownerName: "Ana" }));
}

export function makeDuty(id: string, over: Partial<Duty> = {}): Duty {
  return {
    id,
    title: `Chore ${id}`,
    notes: "",
    room: "whole-home",
    nodeId: "whole-home",
    nodeType: "room",
    audience: "me",
    effort: "small",
    frequency: "weekly",
    kind: "chore",
    weekday: 1,
    monthDay: 1,
    dueDate: null,
    priority: "medium",
    createdAt: at(T0),
    archived: false,
    ...over,
  };
}

export function makeCompletion(id: string, dutyId: string, over: Partial<Completion> = {}): Completion {
  return { id, dutyId, actor: "me", visitId: null, completedAt: at(T0 + 1000), ...over };
}

export function makeSupply(id: string, dutyId: string, over: Partial<SupplyAutomation> = {}): SupplyAutomation {
  return {
    id,
    dutyId,
    linkedDutyIds: [dutyId],
    room: "whole-home",
    nodeId: "whole-home",
    nodeType: "room",
    itemName: "Filter",
    sku: "",
    retailerUrl: "",
    quantity: 1,
    onHand: 1,
    qtyPerOrder: 1,
    reorderAt: 0,
    leadTimeDays: 7,
    installedAt: "",
    lifespanValue: 3,
    lifespanUnit: "months",
    orderByDate: "2026-12-01",
    nextOrderDate: "2026-12-01",
    orderInFlight: false,
    state: "stocked",
    expectedArrivalDate: null,
    createdAt: at(T0),
    ...over,
  };
}

/**
 * What two replicas must agree on: the shared data, in a canonical order, with
 * the per-device fields removed.
 */
export function view(household: Household): unknown {
  const copy = JSON.parse(JSON.stringify(household)) as Record<string, unknown>;
  for (const key of DEVICE_ONLY_KEYS) delete copy[key];
  for (const spec of SYNC_COLLECTIONS) {
    const list = copy[spec.key] as { id: string }[] | undefined;
    if (list) list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  // The app can leave an empty optional list behind; a reload omits it. Same meaning.
  for (const key of ["haulItems", "houseNotes", "checkIns", "tombstones"]) {
    if (Array.isArray(copy[key]) && (copy[key] as unknown[]).length === 0) delete copy[key];
  }
  const tombstones = copy.tombstones as { type: string; id: string }[] | undefined;
  if (tombstones) tombstones.sort((a, b) => (`${a.type}:${a.id}` < `${b.type}:${b.id}` ? -1 : 1));
  return copy;
}

/** Tiny deterministic generator (mulberry32). No library, same sequence everywhere. */
export function prng(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    chance: (p: number) => next() < p,
    shuffle: <T>(items: readonly T[]): T[] => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
}
