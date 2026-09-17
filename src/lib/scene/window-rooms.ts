import type { KeptRoom } from "@/lib/kept-rooms";
import type { PortraitKitEntry, PortraitWindowRect } from "@/lib/scene/portrait";
import type { Duty, HomeRoom, HomeSpec, RoomType } from "@/lib/types";

/** How one window paints: a fresh room, a room nobody has touched in a
 * while, or a room with something due. */
export type WindowState = "lit" | "dim" | "off";

const UPSTAIRS: ReadonlySet<RoomType> = new Set([
  "primary_bedroom",
  "bedroom",
  "bathroom",
  "closet",
  "office",
  "attic",
]);

/** FNV-1a. Only used to break ties the same way every time for one home. */
function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dutyCount(room: HomeRoom, duties: Duty[]): number {
  let count = 0;
  for (const duty of duties) {
    if (duty.archived) continue;
    if (duty.room === room.id || duty.nodeId === room.id) count += 1;
  }
  return count;
}

/** Rooms worth a window, most lived-in first. System rooms never get one. */
export function rankRoomsForWindows(rooms: HomeRoom[], duties: Duty[], seed: number): HomeRoom[] {
  return rooms
    .filter((room) => !room.system)
    .map((room) => ({ room, count: dutyCount(room, duties), tie: hash32(`${room.id}:${seed}`) }))
    .sort(
      (a, b) =>
        b.count - a.count || a.room.sortOrder - b.room.sortOrder || a.tie - b.tie,
    )
    .map((entry) => entry.room);
}

function isUpperWindow(window: PortraitWindowRect, kit: PortraitKitEntry): boolean {
  if (kit.features.storeys < 2) return false;
  const midline = kit.houseBounds.y + kit.houseBounds.h / 2;
  return window.y + window.h / 2 < midline;
}

/**
 * Gives each window of the kit a room. Upper-storey windows prefer bedrooms,
 * bathrooms and the like; ground-floor windows prefer the kitchen, living
 * spaces and laundry. Each room gets at most one window; with more rooms than
 * windows the rooms with the most duties win, with fewer rooms than windows
 * the leftover windows stay unassigned and keep the count rule. Deterministic
 * for one home: ties break on the spec's seed.
 */
export function assignWindowRooms(
  spec: HomeSpec,
  rooms: HomeRoom[],
  duties: Duty[],
  kit: PortraitKitEntry,
): HomeSpec {
  const ranked = rankRoomsForWindows(rooms, duties, spec.seed);
  const ordered = [...kit.windows].sort((a, b) => a.x - b.x || a.y - b.y);
  const upper = ordered.filter((window) => isUpperWindow(window, kit));
  const lower = ordered.filter((window) => !isUpperWindow(window, kit));
  const taken = new Set<string>();
  const assignment = new Map<string, string | null>();
  const pick = (prefer: (room: HomeRoom) => boolean): string | null => {
    const room =
      ranked.find((entry) => !taken.has(entry.id) && prefer(entry)) ??
      ranked.find((entry) => !taken.has(entry.id));
    if (!room) return null;
    taken.add(room.id);
    return room.id;
  };
  for (const window of upper) assignment.set(window.id, pick((room) => UPSTAIRS.has(room.type)));
  for (const window of lower) assignment.set(window.id, pick((room) => !UPSTAIRS.has(room.type)));
  return {
    ...spec,
    windows: kit.windows.map((window) => ({ id: window.id, roomId: assignment.get(window.id) ?? null })),
  };
}

/**
 * True when the stored assignment no longer describes this home: a different
 * kit's windows, a room that was deleted, or nothing assigned while there are
 * rooms to assign. `resolveHomeSpec` reassigns on the fly in that case, so
 * the persisted spec is a cache, never a source of stale windows.
 */
export function needsReassignment(spec: HomeSpec, rooms: HomeRoom[], kit: PortraitKitEntry): boolean {
  if (spec.windows.length !== kit.windows.length) return true;
  const kitIds = new Set(kit.windows.map((window) => window.id));
  if (spec.windows.some((window) => !kitIds.has(window.id))) return true;
  const roomIds = new Set(rooms.map((room) => room.id));
  if (spec.windows.some((window) => window.roomId != null && !roomIds.has(window.roomId))) return true;
  const assignable = rooms.some((room) => !room.system);
  const anyAssigned = spec.windows.some((window) => window.roomId != null);
  return assignable && !anyAssigned && kit.windows.length > 0;
}

/**
 * Per-window paint, in the kit's window order. A window with a room follows
 * that room (fresh lit, due dark, waiting dim); a window without one, or whose
 * room has no chores yet, keeps the old rule of lighting the first `litCount`
 * windows for today's progress.
 */
export function windowStates(
  spec: HomeSpec,
  kit: PortraitKitEntry,
  kept: KeptRoom[],
  litCount: number,
): WindowState[] {
  const byRoom = new Map(kept.map((entry) => [entry.room.id, entry.state]));
  const roomFor = new Map(spec.windows.map((window) => [window.id, window.roomId]));
  return kit.windows.map((window, index) => {
    const roomId = roomFor.get(window.id) ?? null;
    const state = roomId ? byRoom.get(roomId) : undefined;
    if (state === "fresh") return "lit";
    if (state === "due") return "off";
    if (state === "waiting") return "dim";
    return index < litCount ? "lit" : "off";
  });
}

export function litWindowCount(states: WindowState[]): number {
  return states.filter((state) => state !== "off").length;
}
