import assert from "node:assert/strict";
import { test } from "node:test";
import { answerRoomFor, completionToAnswer, MAX_ANSWERED_AT_ONCE } from "@/lib/scene/house-answer";
import type { Completion } from "@/lib/types";

function done(id: string, dutyId = "d1"): Completion {
  return { id, dutyId, actor: "me", visitId: null, completedAt: "2026-10-04T10:00:00.000Z" };
}

test("one new completion is answered", () => {
  assert.equal(completionToAnswer([done("a")], [done("a"), done("b")])?.id, "b");
});

test("undo, no change and an empty first load answer nothing", () => {
  assert.equal(completionToAnswer([done("a"), done("b")], [done("a")]), null);
  assert.equal(completionToAnswer([done("a")], [done("a")]), null);
  assert.equal(completionToAnswer([], []), null);
});

test("a swapped list of the same length (restore) answers nothing", () => {
  assert.equal(completionToAnswer([done("a")], [done("z")]), null);
});

test("a big arrival (import or restore) is not answered chore by chore", () => {
  const many = Array.from({ length: MAX_ANSWERED_AT_ONCE + 1 }, (_, i) => done(`n${i}`));
  assert.equal(completionToAnswer([], many), null);
});

test("answerRoomFor follows a duty to its room, or to nothing", () => {
  const household = {
    rooms: [{ id: "kitchen" }, { id: "den" }],
    duties: [
      { id: "d1", room: "kitchen", nodeId: "x" },
      { id: "d2", room: "whole-home", nodeId: "den" },
      { id: "d3", room: "whole-home", nodeId: "asset-9" },
    ],
  } as unknown as Parameters<typeof answerRoomFor>[0];
  assert.equal(answerRoomFor(household, "d1"), "kitchen");
  assert.equal(answerRoomFor(household, "d2"), "den");
  assert.equal(answerRoomFor(household, "d3"), null);
  assert.equal(answerRoomFor(household, "missing"), null);
});
