import type { MessageKey } from "@/i18n";
import type { Duty, HomeRoom, RoomType } from "@/lib/types";

/** Which pool a room draws from. Rooms that read the same way share one. */
const ROOM_POOL: Partial<Record<RoomType, MessageKey[]>> = {
  kitchen: ["done.kitchen1", "done.kitchen2"],
  bathroom: ["done.bath1", "done.bath2"],
  primary_bedroom: ["done.bedroom1", "done.bedroom2"],
  bedroom: ["done.bedroom1", "done.bedroom2"],
  living: ["done.living1", "done.living2"],
  dining: ["done.living1", "done.living2"],
  office: ["done.living1", "done.living2"],
  laundry: ["done.laundry1", "done.laundry2"],
  garage: ["done.outside1", "done.outside2"],
  patio: ["done.outside1", "done.outside2"],
};

const GENERIC: MessageKey[] = ["done.generic1", "done.generic2", "done.generic3", "done.generic4"];
const LAST: MessageKey[] = ["done.last1", "done.last2", "done.last3"];

/**
 * What the house says back when something is ticked off.
 *
 * Completing a chore used to produce a haptic and a toast of the chore's own
 * title read back at you — the app acknowledged the tap without ever
 * responding to it. This is the house answering, in its own voice, in the same
 * beat as the window lighting and the ring moving.
 *
 * `index` rotates the pool so two chores in a row never say the same thing;
 * pass something that changes per completion, such as how many are on record.
 */
export function doneLineKey(args: {
  duty: Pick<Duty, "room" | "nodeId">;
  rooms: HomeRoom[];
  /** How many are still open after this one. */
  remaining: number;
  index: number;
}): MessageKey {
  const { duty, rooms, remaining, index } = args;
  const pick = (pool: MessageKey[]) => pool[((index % pool.length) + pool.length) % pool.length];
  // The last of the day hands off to the closing ceremony, so it only has to
  // mark the moment, not celebrate it twice.
  if (remaining <= 0) return pick(LAST);
  if (remaining === 1) return "done.one";
  const room = rooms.find((entry) => entry.id === duty.room || entry.id === duty.nodeId);
  const pool = room && !room.system ? ROOM_POOL[room.type] : undefined;
  return pick(pool ?? GENERIC);
}
