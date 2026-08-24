import assert from "node:assert/strict";
import { test } from "node:test";
import { EXTERIOR_ID, mapStarterRoom, systemRooms, WHOLE_HOME_ID } from "@/lib/home-model";
import type { HomeRoom } from "@/lib/types";

const rooms: HomeRoom[] = [
  ...systemRooms(),
  { id: "hall", floorId: "main", name: "Hallway", type: "hallway", sortOrder: 2 },
  { id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 3 },
  { id: "dining", floorId: "main", name: "Dining", type: "dining", sortOrder: 4 },
];

test("yard starters attach to Exterior", () => {
  assert.equal(mapStarterRoom(rooms, "lawn"), EXTERIOR_ID);
  assert.equal(mapStarterRoom(rooms, "pool"), EXTERIOR_ID);
  assert.equal(mapStarterRoom(rooms, "shed"), EXTERIOR_ID);
});

test("nook maps to dining when that room exists", () => {
  assert.equal(mapStarterRoom(rooms, "nook"), "dining");
});

test("office without an office room goes to Whole Home", () => {
  assert.equal(mapStarterRoom(rooms, "carlos-office"), WHOLE_HOME_ID);
});
