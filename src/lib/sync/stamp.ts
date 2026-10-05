import type { Household, SyncEntityType, SyncTombstone } from "@/lib/types";
import {
  contentOf,
  listOf,
  pruneTombstones,
  PROFILE_KEYS,
  stableStringify,
  SYNC_COLLECTIONS,
  tombstoneKey,
  type SyncCollectionKey,
  type SyncEntity,
} from "@/lib/sync/model";

/** True when this household has switched sync on. The only gate the write path checks. */
export function isSyncActive(household: Pick<Household, "sync">): boolean {
  return household.sync?.enabled === true;
}

function maxStamp(household: Household): number {
  let max = 0;
  const see = (value: string | undefined) => {
    if (!value) return;
    const time = Date.parse(value);
    if (time > max) max = time;
  };
  for (const spec of SYNC_COLLECTIONS) for (const item of listOf(household, spec.key)) see(item.updatedAt);
  for (const item of household.tombstones ?? []) see(item.deletedAt);
  see(household.profileUpdatedAt);
  return max;
}

/**
 * The next hybrid-logical-clock value: the wall clock, but never earlier than
 * anything already in either state plus one millisecond. A phone whose clock
 * runs behind therefore still orders its own edits after what it has seen.
 */
export function nextStamp(now: string, ...states: Household[]): string {
  let seen = 0;
  for (const state of states) seen = Math.max(seen, maxStamp(state));
  const wall = Date.parse(now);
  const ms = Math.max(Number.isFinite(wall) ? wall : 0, seen + 1);
  return new Date(ms).toISOString();
}

type CollectionDiff = {
  key: SyncCollectionKey;
  type: SyncEntityType;
  list: SyncEntity[];
  /** Ids added or edited in this write (they need a stamp). */
  touched: Set<string>;
  added: Set<string>;
  removed: SyncEntity[];
  /** True when `list` differs from `next[key]` only by reusing prev's objects for unchanged items. */
  swapped: boolean;
};

function diffCollection(prev: Household, next: Household, spec: (typeof SYNC_COLLECTIONS)[number]): CollectionDiff | null {
  const before = listOf(prev, spec.key);
  const after = listOf(next, spec.key);
  if (before === after) return null;
  const prevById = new Map<string, SyncEntity>();
  for (const item of before) prevById.set(item.id, item);
  const touched = new Set<string>();
  const added = new Set<string>();
  const seen = new Set<string>();
  let swapped = false;
  const list = after.map((item) => {
    seen.add(item.id);
    const old = prevById.get(item.id);
    if (!old) {
      touched.add(item.id);
      added.add(item.id);
      return item;
    }
    if (old === item) return item;
    if (contentOf(old) === contentOf(item)) {
      swapped = true;
      return old;
    }
    touched.add(item.id);
    return item;
  });
  const removed = before.filter((item) => !seen.has(item.id));
  if (touched.size === 0 && removed.length === 0 && !swapped) return null;
  return { key: spec.key, type: spec.type, list, touched, added, removed, swapped };
}

function profileChanged(prev: Household, next: Household): boolean {
  for (const name of PROFILE_KEYS) {
    const a = prev[name];
    const b = next[name];
    if (a === b) continue;
    if (stableStringify(a) !== stableStringify(b)) return true;
  }
  return false;
}

/**
 * Compares the household before and after a local edit and records what moved,
 * so a later merge can tell an edit from an old copy:
 *
 * - added or edited entity: `updatedAt` becomes the next clock value
 * - removed entity: a tombstone `{ type, id, deletedAt }` is appended (a
 *   completion removed only because its chore was removed gets none; the chore's
 *   tombstone covers it)
 * - an id that comes back: its tombstone is removed
 * - anything untouched: returned as the very same object, byte for byte
 *
 * Pure. Returns `next` itself when nothing synced changed. `deviceId` is accepted
 * for the engine's benefit; ties are broken by content, not by device (see the
 * P1 notes in docs/ICLOUD_SYNC_DESIGN.md).
 */
export function stampChanges(prev: Household, next: Household, now: string, deviceId?: string): Household {
  void deviceId;
  if (prev === next) return next;

  const diffs: CollectionDiff[] = [];
  for (const spec of SYNC_COLLECTIONS) {
    const diff = diffCollection(prev, next, spec);
    if (diff) diffs.push(diff);
  }
  const profile = profileChanged(prev, next);
  const hasStampWork = profile || diffs.some((diff) => diff.touched.size > 0 || diff.removed.length > 0);

  if (!hasStampWork) {
    if (diffs.length === 0) return next;
    const patch: Record<string, unknown> = {};
    for (const diff of diffs) patch[diff.key] = diff.list;
    return { ...next, ...patch } as Household;
  }

  const stamp = nextStamp(now, prev, next);
  const patch: Record<string, unknown> = {};
  const removedDutyIds = new Set<string>();
  for (const diff of diffs) {
    if (diff.type === "duty") for (const item of diff.removed) removedDutyIds.add(item.id);
  }

  let tombstones: SyncTombstone[] = next.tombstones ?? prev.tombstones ?? [];
  const tombstoneTouched = { value: false };
  const revived = new Set<string>();
  const fresh: SyncTombstone[] = [];

  for (const diff of diffs) {
    patch[diff.key] = diff.list.map((item) =>
      diff.touched.has(item.id) ? { ...item, updatedAt: stamp } : item,
    );
    for (const id of diff.touched) revived.add(tombstoneKey(diff.type, id));
    for (const gone of diff.removed) {
      if (diff.type === "completion") {
        const dutyId = (gone as unknown as { dutyId?: string }).dutyId;
        if (dutyId && removedDutyIds.has(dutyId)) continue;
      }
      const count = diff.type === "supply" ? (gone as unknown as { lastConfirmedAt?: string; lastConfirmedLevel?: number }) : undefined;
      fresh.push({
        type: diff.type,
        id: gone.id,
        deletedAt: stamp,
        ...(count?.lastConfirmedAt
          ? {
              keep: {
                lastConfirmedAt: count.lastConfirmedAt,
                ...(count.lastConfirmedLevel !== undefined ? { lastConfirmedLevel: count.lastConfirmedLevel } : {}),
              },
            }
          : {}),
      });
    }
  }

  if (revived.size > 0 || fresh.length > 0) {
    const freshKeys = new Set(fresh.map((item) => tombstoneKey(item.type, item.id)));
    const kept = tombstones.filter((item) => {
      const key = tombstoneKey(item.type, item.id);
      if (freshKeys.has(key)) return false;
      return !revived.has(key);
    });
    tombstones = [...kept, ...fresh];
    tombstoneTouched.value = true;
  }
  const pruned = pruneTombstones(tombstones, stamp);
  if (pruned !== tombstones) {
    tombstones = pruned;
    tombstoneTouched.value = true;
  }

  const result: Record<string, unknown> = { ...next, ...patch };
  if (tombstoneTouched.value) {
    if (tombstones.length > 0) result.tombstones = tombstones;
    else delete result.tombstones;
  } else if (next.tombstones === undefined && prev.tombstones !== undefined) {
    result.tombstones = prev.tombstones;
  }
  if (profile) result.profileUpdatedAt = stamp;
  return result as Household;
}
