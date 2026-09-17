import assert from "node:assert/strict";
import { test } from "node:test";
import type { KeptRoom } from "@/lib/kept-rooms";
import { PORTRAIT_MANIFEST } from "@/lib/scene/portrait";
import {
  assignWindowRooms,
  litWindowCount,
  needsReassignment,
  rankRoomsForWindows,
  windowStates,
} from "@/lib/scene/window-rooms";
import type { Duty, HomeRoom, HomeSpec } from "@/lib/types";

function room(id: string, type: HomeRoom["type"], sortOrder: number, system?: HomeRoom["system"]): HomeRoom {
  return { id, floorId: "main", name: id, type, sortOrder, system };
}

function duty(id: string, roomId: string): Duty {
  return {
    id,
    title: id,
    notes: "",
    room: roomId,
    nodeId: roomId,
    nodeType: "room",
    audience: "me",
    effort: "small",
    frequency: "weekly",
    kind: "chore",
    weekday: 1,
    monthDay: 1,
    dueDate: null,
    priority: "medium",
    createdAt: "2026-01-01T00:00:00.000Z",
    archived: false,
  };
}

const ROOMS: HomeRoom[] = [
  room("whole-home", "other", 0, "whole-home"),
  room("exterior", "patio", 1, "exterior"),
  room("kitchen", "kitchen", 2),
  room("living", "living", 3),
  room("bed", "primary_bedroom", 4),
  room("bath", "bathroom", 5),
  room("laundry", "laundry", 6),
];

const DUTIES: Duty[] = [
  duty("k1", "kitchen"),
  duty("k2", "kitchen"),
  duty("k3", "kitchen"),
  duty("l1", "living"),
  duty("l2", "living"),
  duty("b1", "bed"),
  duty("w1", "whole-home"),
  duty("x1", "exterior"),
];

function spec(kitType: HomeSpec["kitType"], seed = 7): HomeSpec {
  return { version: 2, kitType, palette: "classic", windows: [], seed };
}

test("assignment is deterministic and never uses a system room", () => {
  const kit = PORTRAIT_MANIFEST.b; // two storeys, three windows, one upstairs
  const first = assignWindowRooms(spec("b"), ROOMS, DUTIES, kit);
  const second = assignWindowRooms(spec("b"), ROOMS, DUTIES, kit);
  assert.deepEqual(first, second);
  assert.equal(first.windows.length, kit.windows.length);
  for (const window of first.windows) {
    assert.notEqual(window.roomId, "whole-home");
    assert.notEqual(window.roomId, "exterior");
  }
});

test("an upstairs window takes a bedroom or bathroom; ground windows take the busiest ground rooms", () => {
  const kit = PORTRAIT_MANIFEST.b;
  const midline = kit.houseBounds.y + kit.houseBounds.h / 2;
  const assigned = assignWindowRooms(spec("b"), ROOMS, DUTIES, kit);
  const byId = new Map(kit.windows.map((window) => [window.id, window]));
  for (const window of assigned.windows) {
    const rect = byId.get(window.id)!;
    const upper = rect.y + rect.h / 2 < midline;
    if (upper) assert.ok(["bed", "bath"].includes(window.roomId as string), `upper got ${window.roomId}`);
  }
  const assignedIds = assigned.windows.map((window) => window.roomId);
  // Three windows for five rooms: the two busiest ground rooms and one upstairs room.
  assert.ok(assignedIds.includes("kitchen"));
  assert.ok(assignedIds.includes("living"));
  assert.ok(!assignedIds.includes("laundry"));
});

test("fewer rooms than windows leaves the extra windows unassigned", () => {
  const kit = PORTRAIT_MANIFEST.t; // six windows
  const twoRooms = ROOMS.filter((entry) => entry.system || entry.id === "kitchen" || entry.id === "bed");
  const assigned = assignWindowRooms(spec("t"), twoRooms, DUTIES, kit);
  const filled = assigned.windows.filter((window) => window.roomId != null);
  assert.equal(filled.length, 2);
  assert.equal(assigned.windows.length, 6);
});

test("ranking puts the room with the most duties first and breaks ties stably", () => {
  const ranked = rankRoomsForWindows(ROOMS, DUTIES, 7).map((entry) => entry.id);
  assert.deepEqual(ranked.slice(0, 3), ["kitchen", "living", "bed"]);
  assert.deepEqual(rankRoomsForWindows(ROOMS, DUTIES, 7), rankRoomsForWindows(ROOMS, DUTIES, 7));
});

test("needsReassignment detects nothing assigned, a deleted room, and a different kit", () => {
  const kit = PORTRAIT_MANIFEST.b;
  const fresh = spec("b");
  assert.equal(needsReassignment({ ...fresh, windows: kit.windows.map((w) => ({ id: w.id, roomId: null })) }, ROOMS, kit), true);
  const assigned = assignWindowRooms(fresh, ROOMS, DUTIES, kit);
  assert.equal(needsReassignment(assigned, ROOMS, kit), false);
  const withoutKitchen = ROOMS.filter((entry) => entry.id !== "kitchen");
  assert.equal(needsReassignment(assigned, withoutKitchen, kit), true);
  assert.equal(needsReassignment(assigned, ROOMS, PORTRAIT_MANIFEST.t), true);
  // No rooms to assign at all: nothing to do, not a reassignment loop.
  const systemOnly = ROOMS.filter((entry) => entry.system);
  assert.equal(needsReassignment({ ...fresh, windows: kit.windows.map((w) => ({ id: w.id, roomId: null })) }, systemOnly, kit), false);
});

test("window states follow the room, and unmapped windows keep the count rule", () => {
  const kit = PORTRAIT_MANIFEST.t;
  const assigned = assignWindowRooms(spec("t"), ROOMS, DUTIES, kit);
  const kept: KeptRoom[] = [
    { room: ROOMS[2], state: "fresh", lastDoneAt: "2026-09-15T10:00:00.000Z" },
    { room: ROOMS[3], state: "due", lastDoneAt: null },
    { room: ROOMS[4], state: "waiting", lastDoneAt: null },
  ];
  const states = windowStates(assigned, kit, kept, 1);
  const indexOf = (roomId: string) => assigned.windows.findIndex((window) => window.roomId === roomId);
  assert.equal(states[indexOf("kitchen")], "lit");
  assert.equal(states[indexOf("living")], "off");
  assert.equal(states[indexOf("bed")], "dim");
  const unmapped = assigned.windows.map((window, index) => (window.roomId == null ? index : -1)).filter((i) => i >= 0);
  assert.ok(unmapped.length >= 1);
  // The first unmapped window in kit order is lit by the count rule only when its index < litCount.
  for (const index of unmapped) assert.equal(states[index], index < 1 ? "lit" : "off");
  assert.equal(litWindowCount(["lit", "dim", "off"]), 2);
});
