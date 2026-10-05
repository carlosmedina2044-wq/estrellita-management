import assert from "node:assert/strict";
import { test } from "node:test";
import {
  endEarly,
  extendSession,
  formatCountdown,
  leftCount,
  markDone,
  nextId,
  parseSession,
  reconcileDone,
  pickPowerHour,
  progress,
  remainingMs,
  serializeSession,
  skipChore,
  startSession,
  summarize,
} from "@/lib/power-hour";
import type { Duty } from "@/lib/types";

function duty(id: string, minutes?: number): Duty {
  return {
    id,
    title: id,
    notes: "",
    room: "kitchen",
    nodeId: "kitchen",
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
    estimatedMinutes: minutes,
  };
}

const none = () => false;
const T0 = 1_800_000_000_000;

test("fits the chores to the length, quickest first", () => {
  const open = [duty("a", 20), duty("b", 5), duty("c", 10), duty("d", 8)];
  const plan = pickPowerHour(open, 15, none);
  assert.deepEqual(plan.duties.map((d) => d.id), ["b", "d"]);
  assert.equal(plan.minutes, 13);
});

test("overdue chores come first, then quickest", () => {
  const open = [duty("quick", 2), duty("late-long", 12), duty("late-short", 6)];
  const plan = pickPowerHour(open, 30, (d) => d.id.startsWith("late"));
  assert.deepEqual(plan.duties.map((d) => d.id), ["late-short", "late-long", "quick"]);
});

test("a chore that does not fit is passed over for a smaller one that does", () => {
  const open = [duty("big", 40), duty("small", 5)];
  const plan = pickPowerHour(open, 15, none);
  assert.deepEqual(plan.duties.map((d) => d.id), ["small"]);
});

test("caps at ten and always takes at least one when anything is left", () => {
  const many = Array.from({ length: 14 }, (_, i) => duty(`d${i}`, 1));
  assert.equal(pickPowerHour(many, 45, none).count, 10);
  const plan = pickPowerHour([duty("huge", 90)], 15, none);
  assert.equal(plan.count, 1);
  assert.equal(pickPowerHour([], 30, none).count, 0);
});

test("uses the app's ten-minute fallback when a chore has no estimate", () => {
  assert.equal(pickPowerHour([duty("a"), duty("b"), duty("c"), duty("d")], 30, none).count, 3);
});

test("left, next and progress follow the session", () => {
  const plan = pickPowerHour([duty("a", 5), duty("b", 6), duty("c", 7)], 30, none);
  let s = startSession(plan, 30, T0);
  assert.equal(s.endsAtMs, T0 + 30 * 60_000);
  assert.equal(leftCount(s), 3);
  assert.equal(nextId(s), "a");
  s = markDone(s, "a");
  assert.equal(nextId(s), "b");
  assert.equal(progress(s), 1 / 3);
  s = skipChore(s, "b");
  assert.deepEqual(s.dutyIds, ["a", "c"]);
  assert.equal(leftCount(s), 1);
  assert.equal(progress(s), 0.5);
  // A chore that stopped being open (snoozed, deleted) stops counting as left.
  assert.equal(leftCount(s, new Set<string>()), 0);
  // A chore ticked elsewhere since the start counts as done.
  const elsewhere = reconcileDone(s, [{ dutyId: "c", completedAt: new Date(T0 + 1000).toISOString() }]);
  assert.equal(leftCount(elsewhere), 0);
  assert.equal(reconcileDone(s, [{ dutyId: "c", completedAt: new Date(T0 - 1000).toISOString() }]), s);
});

test("extending adds ten minutes and chores that fit them", () => {
  const plan = pickPowerHour([duty("a", 5)], 15, none);
  const s = startSession(plan, 15, T0);
  const extended = extendSession(s, T0 + 60_000, [duty("a", 5), duty("z", 8), duty("y", 30)], none);
  assert.equal(extended.endsAtMs, s.endsAtMs + 10 * 60_000);
  assert.deepEqual(extended.dutyIds, ["a", "z"]);
});

test("extending never brings back a chore that was skipped", () => {
  let s = startSession(pickPowerHour([duty("a", 5), duty("b", 5)], 15, none), 15, T0);
  s = skipChore(s, "a");
  const extended = extendSession(s, T0 + 1000, [duty("a", 5), duty("b", 5), duty("c", 5)], none);
  assert.deepEqual(extended.dutyIds, ["b", "c"]);
});

test("extending after time is up counts from now", () => {
  const s = startSession(pickPowerHour([duty("a", 5)], 15, none), 15, T0);
  const late = T0 + 20 * 60_000;
  assert.equal(extendSession(s, late).endsAtMs, late + 10 * 60_000);
});

test("ending early stops the clock and summarises", () => {
  let s = startSession(pickPowerHour([duty("a", 5), duty("b", 5)], 30, none), 30, T0);
  s = markDone(s, "a");
  const at = T0 + 12 * 60_000 + 20_000;
  const ended = endEarly(s, at);
  assert.equal(remainingMs(ended, at), 0);
  assert.deepEqual(summarize(ended, at + 99_999), { done: 1, minutes: 12, finishedAll: false });
  assert.equal(summarize(markDone(s, "b"), at).finishedAll, true);
});

test("countdown reads mm:ss and never shows 0:00 early", () => {
  assert.equal(formatCountdown(30 * 60_000), "30:00");
  assert.equal(formatCountdown(61_500), "1:02");
  assert.equal(formatCountdown(400), "0:01");
  assert.equal(formatCountdown(0), "0:00");
});

test("a saved session round-trips and junk is refused", () => {
  const s = startSession(pickPowerHour([duty("a", 5)], 15, none), 15, T0);
  assert.deepEqual(parseSession(serializeSession(s)), s);
  const skipped = skipChore(s, "a");
  assert.deepEqual(parseSession(serializeSession(skipped))?.skippedIds, ["a"]);
  assert.equal(parseSession("nope"), null);
  assert.equal(parseSession(JSON.stringify({ id: 1 })), null);
  assert.equal(parseSession(null), null);
});
