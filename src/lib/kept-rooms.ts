import { weekRange } from "@/lib/dates";
import { completionsInRange, todaysOpenDuties } from "@/lib/duties";
import type { IllustrationName } from "@/lib/illustrations";
import type { Duty, HomeRoom, Household, RoomType } from "@/lib/types";

const TYPE_TO_TILE: Partial<Record<RoomType, IllustrationName>> = {
  kitchen: "room-kitchen",
  living: "room-living",
  dining: "room-living",
  primary_bedroom: "room-bedroom",
  bedroom: "room-bedroom",
  bathroom: "room-bath",
  office: "room-living",
  laundry: "room-laundry",
  patio: "room-outdoors",
};

export type RoomKeptState = "fresh" | "due" | "waiting";

export type KeptRoom = {
  room: HomeRoom;
  state: RoomKeptState;
  lastDoneAt: string | null;
};

export function cadenceDays(frequency: Duty["frequency"]): number | null {
  switch (frequency) {
    case "daily":
      return 1;
    case "weekly":
      return 7;
    case "monthly":
      return 31;
    case "quarterly":
      return 92;
    case "yearly":
      return 366;
    case "once":
      return null;
  }
}

export function roomTileFor(room: HomeRoom): IllustrationName {
  if (room.system) return "sys-hvac";
  return TYPE_TO_TILE[room.type] ?? "sys-hvac";
}

function shortestCadence(duties: Duty[]): number | null {
  let shortest: number | null = null;
  for (const duty of duties) {
    const days = cadenceDays(duty.frequency);
    if (days == null) continue;
    shortest = shortest == null ? days : Math.min(shortest, days);
  }
  return shortest;
}

export function keptRooms(household: Household, now = new Date()): KeptRoom[] {
  const openIds = new Set(todaysOpenDuties(household, now).map((duty) => duty.id));
  const result: KeptRoom[] = [];
  for (const room of household.rooms) {
    if (room.system) continue;
    const duties = household.duties.filter(
      (duty) => !duty.archived && (duty.room === room.id || duty.nodeId === room.id),
    );
    if (duties.length === 0) continue;
    const due = duties.some((duty) => openIds.has(duty.id));
    let lastDoneAt: string | null = null;
    for (const item of household.completions) {
      if (!duties.some((duty) => duty.id === item.dutyId)) continue;
      if (!lastDoneAt || item.completedAt > lastDoneAt) lastDoneAt = item.completedAt;
    }
    let state: RoomKeptState = "waiting";
    if (due) state = "due";
    else if (lastDoneAt) {
      const cadence = shortestCadence(duties);
      if (cadence != null) {
        const ageMs = now.getTime() - new Date(lastDoneAt).getTime();
        if (ageMs <= cadence * 86_400_000) state = "fresh";
      }
    }
    result.push({ room, state, lastDoneAt });
  }
  return result;
}

export function wholeHouseKept(rooms: KeptRoom[], household: Household, now: Date): boolean {
  if (rooms.length === 0) return false;
  if (rooms.some((room) => room.state === "due")) return false;
  const { start } = weekRange(now);
  const weekDone = new Set(
    completionsInRange(household.completions, start, now).map((item) => item.dutyId),
  );
  return rooms.every((entry) => {
    const duties = household.duties.filter(
      (duty) =>
        !duty.archived && (duty.room === entry.room.id || duty.nodeId === entry.room.id),
    );
    return duties.some((duty) => weekDone.has(duty.id));
  });
}
