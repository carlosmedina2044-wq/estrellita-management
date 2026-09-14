import assert from "node:assert/strict";
import { test } from "node:test";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { cadenceDays, keptRooms, wholeHouseKept } from "@/lib/kept-rooms";
import type { Completion, Duty, Household } from "@/lib/types";

function duty(partial: Partial<Duty> & Pick<Duty, "title" | "room">): Duty {
  return {
    id: partial.id ?? partial.room,
    notes: "",
    nodeId: partial.room,
    nodeType: "room",
    audience: "me",
    effort: "small",
    frequency: "weekly",
    kind: "chore",
    weekday: 0,
    monthDay: 1,
    dueDate: null,
    priority: "medium",
    createdAt: "2026-09-01T00:00:00.000Z",
    archived: false,
    ...partial,
  };
}

function household(overrides: Partial<Household> = {}): Household {
  return withHouseholdDefaults({
    version: 8,
    householdName: "Casa",
    ownerName: "Me",
    cleanerName: "",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: "home",
    floors: [{ id: "main", name: "Main", sortOrder: 0 }],
    rooms: [
      { id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 0 },
      { id: "bath", floorId: "main", name: "Bath", type: "bathroom", sortOrder: 1 },
      { id: "sys", floorId: "main", name: "Systems", type: "other", sortOrder: 2, system: "whole-home" },
    ],
    assets: [],
    duties: [],
    completions: [],
    visits: [],
    supplyAutomations: [],
    ...overrides,
  });
}

test("cadenceDays covers frequencies", () => {
  assert.equal(cadenceDays("daily"), 1);
  assert.equal(cadenceDays("once"), null);
});

test("keptRooms due beats fresh and skips empty/system rooms", () => {
  const today = new Date(2026, 8, 13);
  const kitchenDuty = duty({ id: "k", title: "Wipe", room: "kitchen", frequency: "daily" });
  const bathDuty = duty({ id: "b", title: "Clean", room: "bath", frequency: "monthly", monthDay: 1 });
  const home = household({
    duties: [kitchenDuty, bathDuty],
    completions: [
      {
        id: "c1",
        dutyId: "b",
        actor: "me",
        visitId: null,
        completedAt: new Date(2026, 8, 12, 12).toISOString(),
      } satisfies Completion,
    ],
  });
  const rooms = keptRooms(home, today);
  assert.equal(rooms.length, 2);
  assert.equal(rooms.find((r) => r.room.id === "kitchen")?.state, "due");
  assert.equal(rooms.find((r) => r.room.id === "bath")?.state, "fresh");
  assert.equal(wholeHouseKept(rooms, home, today), false);
});
