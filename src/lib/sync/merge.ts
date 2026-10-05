import { resolveRoomId, systemRooms } from "@/lib/home-model";
import { normalizeConsumable } from "@/lib/restock";
import { bestCount, migrateHousehold } from "@/lib/storage/migrate";
import { stampChanges } from "@/lib/sync/stamp";
import {
  listOf,
  OPTIONAL_COLLECTIONS,
  PROFILE_KEYS,
  pruneTombstones,
  stableStringify,
  SYNC_COLLECTIONS,
  tombstoneKey,
  WHOLE_HOME_ID,
  type SyncCollection,
  type SyncEntity,
} from "@/lib/sync/model";
import { MAX_SAVED_RETAILER_LINKS } from "@/lib/retailer";
import {
  MILESTONE_IDS,
  type Duty,
  type Household,
  type Milestone,
  type PlaybookDecision,
  type SavedRetailerLink,
  type SupplyAutomation,
  type SyncTombstone,
  type WeatherFire,
} from "@/lib/types";

/**
 * Merging two copies of one home. Pure, deterministic and total: it never
 * throws, and the same two inputs give the same output whichever is "local"
 * (apart from the per-device fields, which always keep the local value).
 *
 * The rules are the ones in docs/ICLOUD_SYNC_DESIGN.md, "Data model and merge".
 * Both sides are first passed through the same migration that loads a saved
 * home, so a malformed or older remote is cleaned the way a malformed file is.
 */
export type MergeContext = {
  /** This device. Reserved for the engine; ties are broken by content so the result does not depend on it. */
  deviceId: string;
  /** ISO instant used to prune old tombstones. */
  now: string;
};

/** Fields that belong to one phone and are never taken from the other. */
export const DEVICE_ONLY_KEYS = [
  "lockSettings",
  "restockDigest",
  "morningBrief",
  "eveningNudge",
  "mode",
  "activeVisitId",
  "weatherStatus",
  "householdRole",
  "sync",
] as const satisfies readonly (keyof Household)[];

function clean(household: Household, now: string): Household | null {
  try {
    const parsed = Date.parse(now);
    return migrateHousehold(household as unknown as Record<string, unknown>, {
      now: new Date(Number.isFinite(parsed) ? parsed : 0),
      merging: true,
    });
  } catch {
    return null;
  }
}

/** Greater wins; equal stamps fall back to content so the choice is symmetric. */
function newer(a: SyncEntity, b: SyncEntity): SyncEntity {
  const sa = a.updatedAt ?? "";
  const sb = b.updatedAt ?? "";
  if (sa !== sb) return sa > sb ? a : b;
  return stableStringify(a) >= stableStringify(b) ? a : b;
}

type Count = NonNullable<SyncTombstone["keep"]>;

/**
 * A restock item's stock count merges as a register: the latest count (day,
 * then level) seen on ANY copy wins, including copies that were deleted. That
 * is what keeps the merge associative when an item is deleted on one phone and
 * brought back on another: the count rides on the tombstone while the item is gone.
 */
function countRegister(
  local: SyncEntity[],
  remote: SyncEntity[],
  tombstones: Map<string, SyncTombstone>,
): Map<string, Count> {
  const register = new Map<string, Count>();
  const see = (id: string, count: Count | undefined) => {
    if (!count) return;
    const best = bestCount(register.get(id), count);
    if (best) register.set(id, best);
  };
  for (const item of [...local, ...remote] as SupplyAutomation[]) {
    if (item.lastConfirmedAt) {
      see(item.id, {
        lastConfirmedAt: item.lastConfirmedAt,
        ...(item.lastConfirmedLevel !== undefined ? { lastConfirmedLevel: item.lastConfirmedLevel } : {}),
      });
    }
  }
  for (const tomb of tombstones.values()) if (tomb.type === "supply") see(tomb.id, tomb.keep);
  return register;
}

function applyCount(item: SupplyAutomation, count: Count | undefined): SupplyAutomation {
  let merged: SupplyAutomation = { ...item };
  if (count) {
    merged.lastConfirmedAt = count.lastConfirmedAt;
    if (count.lastConfirmedLevel !== undefined) merged.lastConfirmedLevel = count.lastConfirmedLevel;
    else delete merged.lastConfirmedLevel;
  }
  // A later "plenty" check-in lifts a low flag that the count is newer than.
  if (merged.flaggedLowAt && merged.lastConfirmedAt && merged.flaggedLowAt.slice(0, 10) < merged.lastConfirmedAt) {
    delete merged.flaggedLowAt;
  }
  // Derived fields (state, order flag, quantities, link list) come from the
  // app's own rules, not from whichever side was copied.
  merged = normalizeConsumable(merged);
  return merged;
}

function mergeCollection(
  spec: SyncCollection,
  local: SyncEntity[],
  remote: SyncEntity[],
  tombstones: Map<string, SyncTombstone>,
): SyncEntity[] {
  const byId = new Map<string, SyncEntity>();
  for (const item of local) byId.set(item.id, item);
  for (const item of remote) {
    const existing = byId.get(item.id);
    byId.set(item.id, existing ? newer(existing, item) : item);
  }
  const register = spec.type === "supply" ? countRegister(local, remote, tombstones) : null;
  const alive: SyncEntity[] = [];
  for (let item of byId.values()) {
    const tomb = tombstones.get(tombstoneKey(spec.type, item.id));
    // A delete beats an edit only when it came later (and an exact tie goes to the delete).
    if (tomb && tomb.deletedAt >= (item.updatedAt ?? "")) continue;
    if (register) item = applyCount(item as SupplyAutomation, register.get(item.id));
    alive.push(item);
  }
  const order = spec.order as (item: SyncEntity) => string;
  return alive.sort((a, b) => {
    const oa = order(a);
    const ob = order(b);
    if (oa !== ob) return oa < ob ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function unionTombstones(a: SyncTombstone[] | undefined, b: SyncTombstone[] | undefined) {
  const map = new Map<string, SyncTombstone>();
  for (const item of [...(a ?? []), ...(b ?? [])]) {
    const key = tombstoneKey(item.type, item.id);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      continue;
    }
    const later = existing.deletedAt < item.deletedAt ? item : existing;
    const keep = bestCount(existing.keep, item.keep);
    map.set(key, keep ? { ...later, keep } : (({ keep: _k, ...rest }) => (void _k, rest as SyncTombstone))(later));
  }
  return map;
}

function mergeStrings(a: readonly string[] | undefined, b: readonly string[] | undefined): string[] {
  return [...new Set([...(a ?? []), ...(b ?? [])])].sort();
}

function mergeRetailerLinks(a: SavedRetailerLink[], b: SavedRetailerLink[]): SavedRetailerLink[] {
  const map = new Map<string, SavedRetailerLink>();
  for (const link of [...a, ...b]) {
    const existing = map.get(link.url);
    map.set(
      link.url,
      existing
        ? {
            url: link.url,
            lastUsedAt: existing.lastUsedAt >= link.lastUsedAt ? existing.lastUsedAt : link.lastUsedAt,
            useCount: Math.max(existing.useCount, link.useCount),
          }
        : link,
    );
  }
  return [...map.values()]
    .sort((x, y) => (x.lastUsedAt !== y.lastUsedAt ? (x.lastUsedAt < y.lastUsedAt ? 1 : -1) : x.url < y.url ? -1 : 1))
    .slice(0, MAX_SAVED_RETAILER_LINKS);
}

function mergePlaybookDecisions(a: PlaybookDecision[], b: PlaybookDecision[]): PlaybookDecision[] {
  const map = new Map<string, PlaybookDecision>();
  for (const item of [...a, ...b]) {
    const key = `${item.playbookId}|${item.year}`;
    const existing = map.get(key);
    map.set(
      key,
      existing
        ? {
            playbookId: item.playbookId,
            year: item.year,
            declinedTaskKeys: mergeStrings(existing.declinedTaskKeys, item.declinedTaskKeys).slice(0, 200),
            disabled: existing.disabled === true || item.disabled === true,
          }
        : { ...item, declinedTaskKeys: mergeStrings(item.declinedTaskKeys, []) },
    );
  }
  return [...map.keys()].sort().map((key) => map.get(key)!);
}

function mergeWeatherFires(a: WeatherFire[], b: WeatherFire[]): WeatherFire[] {
  const map = new Map<string, WeatherFire>();
  for (const fire of [...a, ...b]) map.set(`${fire.triggerId}|${fire.firedAt}`, fire);
  return [...map.values()]
    .sort((x, y) => (x.firedAt !== y.firedAt ? (x.firedAt < y.firedAt ? -1 : 1) : x.triggerId < y.triggerId ? -1 : 1))
    .slice(-2_000);
}

function mergeMilestones(a: Milestone[], b: Milestone[]): Milestone[] {
  const map = new Map<string, Milestone>();
  for (const item of [...a, ...b]) {
    const existing = map.get(item.id);
    if (!existing || item.earnedAt < existing.earnedAt) map.set(item.id, item);
  }
  return MILESTONE_IDS.filter((id) => map.has(id)).map((id) => map.get(id)!);
}

function earliest(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a <= b ? a : b;
}

/**
 * Pointers that lost their target (a room deleted on the other phone) are
 * pointed at the whole-home room. Nothing a person wrote is ever dropped here.
 */
function repairOrphans(household: Household): Household {
  let { floors, rooms } = household;
  if (floors.length === 0) floors = [{ id: "main", name: "Main", sortOrder: 0, updatedAt: "1970-01-01T00:00:00.000Z" }];
  const missing = systemRooms().filter((room) => !rooms.some((item) => item.system === room.system));
  if (missing.length > 0) {
    rooms = [...missing.map((room) => ({ ...room, updatedAt: "1970-01-01T00:00:00.000Z" })), ...rooms];
  }
  const floorIds = new Set(floors.map((floor) => floor.id));
  rooms = rooms.map((room) =>
    room.floorId !== null && !floorIds.has(room.floorId) ? { ...room, floorId: floors[0]?.id ?? null } : room,
  );
  const roomIds = new Set(rooms.map((room) => room.id));
  const assetIds = new Set(household.assets.map((asset) => asset.id));
  const assets = household.assets.map((asset) =>
    roomIds.has(asset.roomId) ? asset : { ...asset, roomId: WHOLE_HOME_ID },
  );
  const targetExists = (nodeType: string, nodeId: string) =>
    nodeType === "home" ||
    (nodeType === "room" && roomIds.has(nodeId)) ||
    (nodeType === "asset" && assetIds.has(nodeId)) ||
    (nodeType === "floor" && floorIds.has(nodeId));
  const consumables = household.consumables.map((item) =>
    targetExists(item.nodeType, item.nodeId) ? item : { ...item, nodeId: WHOLE_HOME_ID, nodeType: "home" as const },
  );
  const duties: Duty[] = household.duties.map((duty) => {
    if (roomIds.has(duty.room) && targetExists(duty.nodeType, duty.nodeId)) return duty;
    const room = resolveRoomId(rooms, assets, duty.nodeId || duty.room, duty.nodeType || "room", duty.room);
    return room === duty.room ? duty : { ...duty, room };
  });
  const liveDuties = new Set(duties.map((duty) => duty.id));
  const supplyAutomations: SupplyAutomation[] = household.supplyAutomations.map((item) => {
    let next = item;
    // A restock item follows the chores it is linked to: if the one it was
    // anchored to was deleted on the other phone it moves to a linked chore
    // that is still there. With none left it stays, untouched, until
    // `settleMerge` removes it as a recorded local edit (dropping it here would
    // make the merge forget it and break associativity).
    if (!liveDuties.has(item.dutyId)) {
      const linked = item.linkedDutyIds.filter((id) => liveDuties.has(id));
      if (linked.length > 0) next = { ...next, dutyId: linked[0]!, linkedDutyIds: linked };
    }
    if (liveDuties.has(next.dutyId) && (!roomIds.has(next.room) || !targetExists(next.nodeType, next.nodeId))) {
      const room = resolveRoomId(rooms, assets, next.nodeId || next.room, next.nodeType || "room", next.room);
      if (room !== next.room) next = { ...next, room };
    }
    return next;
  });
  const houseNotes = household.houseNotes?.map((note) => {
    if (!note.roomId || roomIds.has(note.roomId)) return note;
    const { roomId: _gone, ...rest } = note;
    void _gone;
    return rest;
  });
  const result: Household = { ...household, floors, rooms, assets, consumables, duties, supplyAutomations };
  if (houseNotes) result.houseNotes = houseNotes;
  return result;
}

export function mergeHousehold(local: Household, remote: Household, ctx: MergeContext): Household {
  const a = clean(local, ctx.now);
  const b = clean(remote, ctx.now);
  if (!a) return local;
  if (!b) return a;

  const tombstones = unionTombstones(a.tombstones, b.tombstones);
  const counts = countRegister(a.supplyAutomations, b.supplyAutomations, tombstones);
  const result: Record<string, unknown> = { ...a, version: 9 };

  for (const spec of SYNC_COLLECTIONS) {
    const merged = mergeCollection(spec, listOf(a, spec.key), listOf(b, spec.key), tombstones);
    if (merged.length === 0 && OPTIONAL_COLLECTIONS.has(spec.key)) delete result[spec.key];
    else result[spec.key] = merged;
  }

  // Tombstones that still matter: the entity is gone, or the delete is the later write.
  const survivors: SyncTombstone[] = [];
  const present = new Map<string, string>();
  for (const spec of SYNC_COLLECTIONS) {
    for (const item of result[spec.key] === undefined ? [] : (result[spec.key] as SyncEntity[])) {
      present.set(tombstoneKey(spec.type, item.id), item.updatedAt ?? "");
    }
  }
  for (const [key, tomb] of tombstones) {
    const stamp = present.get(key);
    if (stamp !== undefined && tomb.deletedAt < stamp) continue;
    if (tomb.type === "supply") {
      const best = counts.get(tomb.id);
      survivors.push(best ? { ...tomb, keep: best } : tomb);
    } else survivors.push(tomb);
  }
  const kept = pruneTombstones(survivors, ctx.now);
  if (kept.length > 0) result.tombstones = kept;
  else delete result.tombstones;

  // Home profile: one record, last writer wins as a whole.
  const profileOf = (household: Household) => {
    const out: Record<string, unknown> = {};
    for (const name of PROFILE_KEYS) out[name] = household[name];
    return out;
  };
  const stampA = a.profileUpdatedAt ?? "";
  const stampB = b.profileUpdatedAt ?? "";
  const profileWinner =
    stampA !== stampB
      ? stampA > stampB
        ? a
        : b
      : stableStringify(profileOf(a)) >= stableStringify(profileOf(b))
        ? a
        : b;
  for (const name of PROFILE_KEYS) {
    const value = profileWinner[name];
    if (value === undefined) delete result[name];
    else result[name] = value;
  }
  const profileStamp = profileWinner.profileUpdatedAt;
  if (profileStamp) result.profileUpdatedAt = profileStamp;
  else delete result.profileUpdatedAt;

  // Rainy-day fund: last writer wins.
  if (a.maintenanceFund && b.maintenanceFund) {
    result.maintenanceFund = newer(
      a.maintenanceFund as unknown as SyncEntity,
      b.maintenanceFund as unknown as SyncEntity,
    );
  } else if (a.maintenanceFund ?? b.maintenanceFund) {
    result.maintenanceFund = a.maintenanceFund ?? b.maintenanceFund;
  }

  result.savedRetailerLinks = mergeRetailerLinks(a.savedRetailerLinks, b.savedRetailerLinks);
  result.playbookDecisions = mergePlaybookDecisions(a.playbookDecisions, b.playbookDecisions);
  result.weatherFires = mergeWeatherFires(a.weatherFires, b.weatherFires);
  result.seenTips = mergeStrings(a.seenTips, b.seenTips).slice(0, 32);
  result.milestones = mergeMilestones(a.milestones, b.milestones);
  const checkIns = mergeStrings(a.checkIns, b.checkIns).slice(-400);
  if (checkIns.length > 0) result.checkIns = checkIns;
  else delete result.checkIns;

  result.onboarded = a.onboarded || b.onboarded;
  result.teaching = {
    startedAt: earliest(a.teaching.startedAt, b.teaching.startedAt),
    checkedChore: a.teaching.checkedChore || b.teaching.checkedChore,
    openedRestock: a.teaching.openedRestock || b.teaching.openedRestock,
    setDigestOrZip: a.teaching.setDigestOrZip || b.teaching.setDigestOrZip,
  };
  // Care is recomputed by the app from the merged completions; only the best run is shared.
  result.momentum = { ...a.momentum, bestRun: Math.max(a.momentum.bestRun, b.momentum.bestRun) };

  // Per-device fields keep this phone's value (already in `a`).
  return repairOrphans(result as unknown as Household);
}

/**
 * Run once after applying a merge result (as a normal, stamped local edit):
 * removes completions whose chore is gone and restock items whose every chore
 * is gone, recording each removal so it stays removed on every phone.
 *
 * It is separate from `mergeHousehold` on purpose. A merge must keep the
 * orphan, because a chore deleted on one phone and edited later on another
 * comes back, and its history should come back with it; only once the copies
 * agree is "the chore is really gone" known.
 */
export function settleMerge(household: Household, now: string): Household {
  const live = new Set(household.duties.map((duty) => duty.id));
  const completions = household.completions.filter((item) => live.has(item.dutyId));
  const supplyAutomations = household.supplyAutomations.filter((item) => live.has(item.dutyId));
  if (completions.length === household.completions.length && supplyAutomations.length === household.supplyAutomations.length) {
    return household;
  }
  return stampChanges(household, { ...household, completions, supplyAutomations }, now);
}

export type MergeCounts = {
  duties: number;
  completions: number;
  supplies: number;
  assets: number;
  rooms: number;
  notes: number;
  haulItems: number;
};

export type MergeDescription = {
  localCounts: MergeCounts;
  remoteCounts: MergeCounts;
  /** What the combined home would hold. */
  mergedCounts: MergeCounts;
  /** Chores that exist only on one side (by id). */
  onlyLocalDuties: number;
  onlyRemoteDuties: number;
  sharedDuties: number;
  /** Chores the combine step would fold together (same title, room and cadence). */
  likelyDuplicateDuties: number;
  /** True when the two homes share no chore, room or note: probably two different homes, not two copies of one. */
  looksLikeDifferentHomes: boolean;
};

function countsOf(household: Household): MergeCounts {
  return {
    duties: household.duties.length,
    completions: household.completions.length,
    supplies: household.supplyAutomations.length,
    assets: household.assets.length,
    rooms: household.rooms.filter((room) => !room.system).length,
    notes: household.houseNotes?.length ?? 0,
    haulItems: household.haulItems?.length ?? 0,
  };
}

/** What the "combine or replace" sheet needs to show. Pure; never throws. */
export function describeMerge(local: Household, remote: Household): MergeDescription {
  const now = new Date(0).toISOString();
  const a = clean(local, now) ?? local;
  const b = clean(remote, now) ?? remote;
  const merged = dedupeDuties(mergeHousehold(a, b, { deviceId: "", now }), now);
  const localIds = new Set(a.duties.map((duty) => duty.id));
  const remoteIds = new Set(b.duties.map((duty) => duty.id));
  const shared = [...localIds].filter((id) => remoteIds.has(id)).length;
  const sharedRooms = a.rooms.filter((room) => !room.system && b.rooms.some((other) => other.id === room.id)).length;
  const sharedNotes = (a.houseNotes ?? []).filter((note) => (b.houseNotes ?? []).some((other) => other.id === note.id)).length;
  const bothEmpty = a.duties.length === 0 && b.duties.length === 0;
  return {
    localCounts: countsOf(a),
    remoteCounts: countsOf(b),
    mergedCounts: countsOf(merged.household),
    onlyLocalDuties: localIds.size - shared,
    onlyRemoteDuties: remoteIds.size - shared,
    sharedDuties: shared,
    likelyDuplicateDuties: merged.removedIds.length,
    looksLikeDifferentHomes: !bothEmpty && shared === 0 && sharedRooms === 0 && sharedNotes === 0,
  };
}

function dutyKey(duty: Duty): string {
  const title = duty.title.toLowerCase().replace(/\s+/g, " ").trim();
  return `${title}|${duty.room}|${duty.frequency}|${duty.kind}`;
}

/**
 * Folds together chores that are the same chore: same title (ignoring case and
 * spacing), room, cadence and kind. Meant for the one-off "combine both homes"
 * step, not for every sync: two homes set up separately each have their own
 * "Wipe counters". The earliest one is kept; the others' completions, restock
 * links and purchases are re-pointed at it, and the removed ones get tombstones
 * so they stay gone on every phone. Nothing is deleted without a stand-in.
 */
export function dedupeDuties(
  household: Household,
  now: string,
): { household: Household; removedIds: string[] } {
  const groups = new Map<string, Duty[]>();
  for (const duty of household.duties) {
    const key = dutyKey(duty);
    groups.set(key, [...(groups.get(key) ?? []), duty]);
  }
  const keeperOf = new Map<string, string>();
  const rolled = new Map<string, number>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ordered = [...group].sort((x, y) =>
      x.createdAt !== y.createdAt ? (x.createdAt < y.createdAt ? -1 : 1) : x.id < y.id ? -1 : 1,
    );
    const keeper = ordered[0]!;
    for (const other of ordered.slice(1)) {
      keeperOf.set(other.id, keeper.id);
      rolled.set(keeper.id, (rolled.get(keeper.id) ?? 0) + (other.rolledCompletions ?? 0));
    }
  }
  if (keeperOf.size === 0) return { household, removedIds: [] };
  const target = (id: string) => keeperOf.get(id) ?? id;
  const next: Household = {
    ...household,
    duties: household.duties
      .filter((duty) => !keeperOf.has(duty.id))
      .map((duty) => {
        const extra = rolled.get(duty.id);
        return extra ? { ...duty, rolledCompletions: (duty.rolledCompletions ?? 0) + extra } : duty;
      }),
    completions: household.completions.map((item) =>
      keeperOf.has(item.dutyId) ? { ...item, dutyId: target(item.dutyId) } : item,
    ),
    purchases: household.purchases.map((item) =>
      item.dutyId && keeperOf.has(item.dutyId) ? { ...item, dutyId: target(item.dutyId) } : item,
    ),
    supplyAutomations: household.supplyAutomations.map((item) => {
      const touches = keeperOf.has(item.dutyId) || item.linkedDutyIds.some((id) => keeperOf.has(id));
      if (!touches) return item;
      return {
        ...item,
        dutyId: target(item.dutyId),
        linkedDutyIds: [...new Set(item.linkedDutyIds.map(target))],
      };
    }),
  };
  return { household: stampChanges(household, next, now), removedIds: [...keeperOf.keys()].sort() };
}
