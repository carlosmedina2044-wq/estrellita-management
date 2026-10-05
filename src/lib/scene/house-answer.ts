import type { Completion, Household } from "@/lib/types";

/** The house's answer to one finished chore: which room, and a key that rises
 * per completion so two chores in the same room each get their own flare. */
export type HouseAnswer = {
  roomId: string | null;
  key: number;
  /** This chore was the last one: the day went from open to finished. */
  closesDay?: boolean;
};

/** More new completions than this in one update is a restore, an import or a
 * sync arriving, not somebody ticking things off. The house stays quiet. */
export const MAX_ANSWERED_AT_ONCE = 3;

/**
 * The room a chore belongs to, by the same rule `keptRooms` uses, so the glow
 * lands on the window that is about to light. Resolved against the real room
 * list: a `nodeId` that points at an asset or the whole home returns null and
 * the house answers with a soft wash instead of anchoring nowhere.
 */
export function answerRoomFor(
  household: Pick<Household, "rooms" | "duties">,
  dutyId: string,
): string | null {
  const duty = household.duties.find((item) => item.id === dutyId);
  if (!duty) return null;
  return household.rooms.find((room) => duty.room === room.id || duty.nodeId === room.id)?.id ?? null;
}

/**
 * Which completion, if any, the house should answer after `completions`
 * changed from `before`.
 *
 * Derived from the completion list itself rather than from each screen's tap
 * handler, so a chore ticked from a Today row, a room sheet or the chore
 * detail sheet all get exactly one answer, and none of them has to remember
 * to ask for it. Undo shrinks the list and answers nothing.
 */
export function completionToAnswer(
  before: readonly Completion[],
  after: readonly Completion[],
): Completion | null {
  if (after.length <= before.length) return null;
  const seen = new Set(before.map((item) => item.id));
  const added = after.filter((item) => !seen.has(item.id));
  if (added.length === 0 || added.length > MAX_ANSWERED_AT_ONCE) return null;
  return added[added.length - 1];
}
