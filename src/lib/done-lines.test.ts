import assert from "node:assert/strict";
import { test } from "node:test";
import { doneLineKey } from "@/lib/done-lines";
import type { HomeRoom } from "@/lib/types";

const rooms: HomeRoom[] = [
  { id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 0 },
  { id: "bath", floorId: "main", name: "Bath", type: "bathroom", sortOrder: 1 },
  { id: "attic", floorId: "main", name: "Attic", type: "attic", sortOrder: 2 },
];

const duty = (room: string) => ({ room, nodeId: room });

test("the last of the day is marked as the last", () => {
  const key = doneLineKey({ duty: duty("kitchen"), rooms, remaining: 0, index: 0 });
  assert.match(key, /^done\.last/);
});

test("the second to last says so", () => {
  assert.equal(doneLineKey({ duty: duty("kitchen"), rooms, remaining: 1, index: 3 }), "done.one");
});

test("a room with a voice of its own uses it", () => {
  assert.match(doneLineKey({ duty: duty("kitchen"), rooms, remaining: 4, index: 0 }), /^done\.kitchen/);
  assert.match(doneLineKey({ duty: duty("bath"), rooms, remaining: 4, index: 0 }), /^done\.bath/);
});

test("a room without one, or no room at all, falls back rather than breaking", () => {
  assert.match(doneLineKey({ duty: duty("attic"), rooms, remaining: 4, index: 0 }), /^done\.generic/);
  assert.match(doneLineKey({ duty: duty("nowhere"), rooms, remaining: 4, index: 0 }), /^done\.generic/);
  assert.match(doneLineKey({ duty: duty("kitchen"), rooms: [], remaining: 4, index: 0 }), /^done\.generic/);
});

test("two chores in a row never say the same thing", () => {
  const first = doneLineKey({ duty: duty("kitchen"), rooms, remaining: 4, index: 7 });
  const second = doneLineKey({ duty: duty("kitchen"), rooms, remaining: 3, index: 8 });
  assert.notEqual(first, second);
});

test("a negative or wild index still lands on a real line", () => {
  for (const index of [-5, -1, 0, 999999]) {
    const key = doneLineKey({ duty: duty("kitchen"), rooms, remaining: 4, index });
    assert.match(key, /^done\.kitchen[12]$/);
  }
});
