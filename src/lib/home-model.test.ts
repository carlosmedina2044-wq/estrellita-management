import assert from "node:assert/strict";
import { test } from "node:test";
import { migrateRoom } from "@/lib/house";
import {
  deleteRoomFromHousehold,
  ensureHomeTree,
  EXTERIOR_ID,
  systemRooms,
  WHOLE_HOME_ID,
} from "@/lib/home-model";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import type { HomeRoom, Household } from "@/lib/types";

const rooms: HomeRoom[] = [
  ...systemRooms(),
  { id: "hall", floorId: "main", name: "Hallway", type: "hallway", sortOrder: 2 },
  { id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 3 },
];

function household(overrides: Partial<Household> = {}): Household {
  return withHouseholdDefaults({
    version: 7,
    householdName: "Test",
    ownerName: "",
    cleanerName: "Cleaner",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: "home",
    floors: [{ id: "main", name: "Main", sortOrder: 0 }],
    rooms,
    assets: [],
    duties: [],
    completions: [],
    visits: [],
    supplyAutomations: [],
    ...overrides,
  });
}

test("legacy room ids map to generic rooms, never to a specific house", () => {
  assert.equal(migrateRoom("lawn"), EXTERIOR_ID);
  assert.equal(migrateRoom("pool"), EXTERIOR_ID);
  assert.equal(migrateRoom("whole-home"), WHOLE_HOME_ID);
  assert.equal(migrateRoom("kitchen"), "kitchen");
  assert.equal(migrateRoom("not valid!"), WHOLE_HOME_ID);
});

test("ensureHomeTree adds system rooms when missing", () => {
  const home = household({ rooms: [rooms[2]!, rooms[3]!] });
  const fixed = ensureHomeTree(home);
  assert.ok(fixed.rooms.some((room) => room.system === "whole-home"));
  assert.ok(fixed.rooms.some((room) => room.system === "exterior"));
});

test("deleting a room can reassign its duties", () => {
  const home = household({
    duties: [
      {
        id: "d1",
        title: "Sweep",
        notes: "",
        room: "hall",
        nodeId: "hall",
        nodeType: "room",
        audience: "me",
        effort: "small",
        frequency: "weekly",
        kind: "chore",
        weekday: 0,
        monthDay: 1,
        dueDate: null,
        priority: "low",
        createdAt: new Date().toISOString(),
        archived: false,
      },
    ],
  });
  const next = deleteRoomFromHousehold(home, "hall", { action: "reassign", toRoomId: "kitchen" });
  assert.equal(next.rooms.some((room) => room.id === "hall"), false);
  assert.equal(next.duties[0]?.room, "kitchen");
  const dropped = deleteRoomFromHousehold(home, "hall", { action: "delete" });
  assert.equal(dropped.duties.length, 0);
});
