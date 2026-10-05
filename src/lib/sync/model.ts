import { EXTERIOR_ID, WHOLE_HOME_ID } from "@/lib/home-model";
import type { Household, SyncEntityType, SyncTombstone } from "@/lib/types";

/** The shape every synced entity shares. */
export type SyncEntity = { id: string; updatedAt?: string };

export type SyncCollectionKey =
  | "floors"
  | "rooms"
  | "assets"
  | "consumables"
  | "duties"
  | "completions"
  | "purchases"
  | "visits"
  | "supplyAutomations"
  | "houseNotes"
  | "haulItems";

export type SyncCollection = {
  type: SyncEntityType;
  key: SyncCollectionKey;
  /** Sort key that reproduces the order the app appends in; ties break on id. */
  order: (item: never) => string;
};

const pad = (n: unknown) => String(typeof n === "number" ? n : 0).padStart(6, "0");

/** Every collection that syncs, as one entity per record. */
export const SYNC_COLLECTIONS: readonly SyncCollection[] = [
  { type: "floor", key: "floors", order: (i: { sortOrder: number }) => pad(i.sortOrder) },
  { type: "room", key: "rooms", order: (i: { sortOrder: number }) => pad(i.sortOrder) },
  { type: "asset", key: "assets", order: () => "" },
  { type: "consumable", key: "consumables", order: () => "" },
  { type: "duty", key: "duties", order: (i: { createdAt: string }) => i.createdAt },
  { type: "completion", key: "completions", order: (i: { completedAt: string }) => i.completedAt },
  { type: "purchase", key: "purchases", order: (i: { completedAt: string }) => i.completedAt },
  { type: "visit", key: "visits", order: (i: { startedAt: string }) => i.startedAt },
  { type: "supply", key: "supplyAutomations", order: (i: { createdAt: string }) => i.createdAt },
  { type: "houseNote", key: "houseNotes", order: (i: { createdAt: string }) => i.createdAt },
  { type: "haulItem", key: "haulItems", order: (i: { addedAt: string }) => i.addedAt },
] as const;

/** Collections that may be absent on a Household (omitted, not empty, when there is nothing in them). */
export const OPTIONAL_COLLECTIONS: ReadonlySet<SyncCollectionKey> = new Set(["houseNotes", "haulItems"]);

/**
 * The shared "home profile": one logical record, last writer wins as a whole
 * (stamped by `profileUpdatedAt`).
 */
export const PROFILE_KEYS = [
  "householdName",
  "ownerName",
  "cleanerName",
  "homeId",
  "homeType",
  "tenure",
  "location",
  "attributes",
  "homeSpec",
  "bigTicketThreshold",
  "restockSafetyBufferDays",
  "preferredRetailers",
] as const satisfies readonly (keyof Household)[];

export function listOf(household: Household, key: SyncCollectionKey): SyncEntity[] {
  return ((household as unknown as Record<string, unknown>)[key] as SyncEntity[] | undefined) ?? [];
}

export function tombstoneKey(type: SyncEntityType, id: string): string {
  return `${type}:${id}`;
}

/** JSON with sorted keys and no `undefined`: equal content gives an equal string whatever the key order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const name of Object.keys(record).sort()) {
    if (record[name] === undefined) continue;
    parts.push(`${JSON.stringify(name)}:${stableStringify(record[name])}`);
  }
  return `{${parts.join(",")}}`;
}

/** An entity's content with its stamp removed, for "did this really change". */
export function contentOf(entity: SyncEntity): string {
  const { updatedAt: _stamp, ...rest } = entity;
  void _stamp;
  return stableStringify(rest);
}

export const TOMBSTONE_MAX_AGE_MS = 90 * 86_400_000;
export const TOMBSTONE_CAP = 2_000;

/** Drops tombstones older than 90 days, then keeps the newest 2000. Pure and order-independent. */
export function pruneTombstones(tombstones: SyncTombstone[], now: string): SyncTombstone[] {
  const nowMs = Date.parse(now);
  const cutoff = Number.isFinite(nowMs) ? new Date(nowMs - TOMBSTONE_MAX_AGE_MS).toISOString() : "";
  const kept = tombstones.filter((item) => item.deletedAt >= cutoff);
  if (kept.length <= TOMBSTONE_CAP && kept.length === tombstones.length) return tombstones;
  return kept
    .sort((a, b) => {
      if (a.deletedAt !== b.deletedAt) return a.deletedAt < b.deletedAt ? 1 : -1;
      const ka = tombstoneKey(a.type, a.id);
      const kb = tombstoneKey(b.type, b.id);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    })
    .slice(0, TOMBSTONE_CAP);
}

export { EXTERIOR_ID, WHOLE_HOME_ID };
