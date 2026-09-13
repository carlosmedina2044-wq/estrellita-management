import assert from "node:assert/strict";
import { test } from "node:test";
import { linkedDutyIdsFor } from "@/lib/restock";
import type { Completion, Duty, Household } from "@/lib/types";
import { EMPTY_HOUSEHOLD } from "@/lib/storage/migrate";

function removeDuty(current: Household, id: string): {
  next: Household;
  duty?: Duty;
  completions: Completion[];
} {
  const duty = current.duties.find((item) => item.id === id);
  const completions = current.completions.filter((item) => item.dutyId === id);
  return {
    duty,
    completions,
    next: {
      ...current,
      duties: current.duties.filter((item) => item.id !== id),
      completions: current.completions.filter((item) => item.dutyId !== id),
      supplyAutomations: current.supplyAutomations.map((item) => ({
        ...item,
        linkedDutyIds: linkedDutyIdsFor(item).filter((dutyId) => dutyId !== id),
        dutyId: item.dutyId === id ? linkedDutyIdsFor(item).find((dutyId) => dutyId !== id) ?? "" : item.dutyId,
      })),
    },
  };
}

function restoreDuty(current: Household, duty: Duty, completions: Completion[]): Household {
  if (current.duties.some((item) => item.id === duty.id)) return current;
  return {
    ...current,
    duties: [...current.duties, duty],
    completions: [
      ...current.completions,
      ...completions.filter((item) => !current.completions.some((existing) => existing.id === item.id)),
    ],
  };
}

test("deleteDuty / restoreDuty round-trip keeps chore and completions", () => {
  const duty: Duty = {
    id: "d1",
    title: "Wipe counters",
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
    createdAt: "2026-09-01T00:00:00.000Z",
    archived: false,
  };
  const completion: Completion = {
    id: "c1",
    dutyId: "d1",
    actor: "me",
    visitId: null,
    completedAt: "2026-09-08T00:00:00.000Z",
  };
  const start: Household = {
    ...EMPTY_HOUSEHOLD,
    duties: [duty],
    completions: [completion],
  };
  const removed = removeDuty(start, "d1");
  assert.equal(removed.next.duties.length, 0);
  assert.equal(removed.next.completions.length, 0);
  assert.ok(removed.duty);
  const restored = restoreDuty(removed.next, removed.duty!, removed.completions);
  assert.equal(restored.duties.length, 1);
  assert.equal(restored.completions.length, 1);
  assert.equal(restored.duties[0]?.id, "d1");
});
