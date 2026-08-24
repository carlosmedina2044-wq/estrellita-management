import assert from "node:assert/strict";
import { test } from "node:test";
import {
  blendedCostFor,
  realCostFor,
  shouldPromptCost,
} from "@/lib/costs";
import { parseStored } from "@/lib/storage";
import type { Completion, Duty } from "@/lib/types";

function duty(partial: Partial<Duty> & Pick<Duty, "id">): Duty {
  return {
    title: "Replace filter",
    notes: "",
    room: "hvac",
    nodeId: "hvac",
    nodeType: "room",
    audience: "me",
    effort: "small",
    frequency: "quarterly",
    kind: "replacement",
    weekday: 0,
    monthDay: 1,
    dueDate: null,
    priority: "medium",
    createdAt: "2026-08-01T00:00:00.000Z",
    archived: false,
    estimatedCost: 40,
    ...partial,
  };
}

function completion(partial: Partial<Completion> & Pick<Completion, "id" | "dutyId">): Completion {
  return {
    actor: "me",
    visitId: null,
    completedAt: "2026-08-24T12:00:00.000Z",
    ...partial,
  };
}

test("blend prefers the latest actual and falls back to the estimate", () => {
  const filter = duty({ id: "duty-cost1" });
  const older = completion({
    id: "comp-old1",
    dutyId: "duty-cost1",
    actualCost: 18,
    completedAt: "2026-08-01T12:00:00.000Z",
  });
  const newer = completion({
    id: "comp-new1",
    dutyId: "duty-cost1",
    actualCost: 24.99,
    completedAt: "2026-08-20T12:00:00.000Z",
  });
  assert.equal(realCostFor("duty-cost1", [older, newer]), 24.99);
  assert.deepEqual(blendedCostFor(filter, [older, newer]), { cost: 24.99, source: "actual" });
  assert.deepEqual(blendedCostFor(filter, []), { cost: 40, source: "estimate" });
  assert.equal(blendedCostFor(duty({ id: "duty-none", estimatedCost: undefined }), []), null);
});

test("shouldPromptCost is replacement-only, skip-sticky, and 24-hour windowed", () => {
  const now = new Date("2026-08-24T12:00:00.000Z");
  const recent = completion({ id: "comp-ask1", dutyId: "duty-cost1", completedAt: "2026-08-24T01:00:00.000Z" });
  const replacement = duty({ id: "duty-cost1" });
  const chore = duty({ id: "duty-chore", kind: "chore" });
  assert.equal(shouldPromptCost(recent, replacement, now), true);
  assert.equal(shouldPromptCost(recent, chore, now), false);
  assert.equal(shouldPromptCost({ ...recent, costSkipped: true }, replacement, now), false);
  assert.equal(shouldPromptCost({ ...recent, actualCost: 12 }, replacement, now), false);
  const stale = completion({
    id: "comp-old2",
    dutyId: "duty-cost1",
    completedAt: "2026-08-20T12:00:00.000Z",
  });
  assert.equal(shouldPromptCost(stale, replacement, now), false);
});

test("restored old completions do not prompt", () => {
  const now = new Date("2026-08-24T12:00:00.000Z");
  const backup = completion({
    id: "comp-bak1",
    dutyId: "duty-cost1",
    completedAt: "2025-01-01T12:00:00.000Z",
  });
  assert.equal(shouldPromptCost(backup, duty({ id: "duty-cost1" }), now), false);
});

test("migrateCompletion round-trips actualCost and costSkipped and rejects bad numbers", () => {
  const household = parseStored(
    JSON.stringify({
      onboarded: true,
      duties: [{ id: "duty-0006", title: "Replace filter", room: "kitchen", kind: "replacement", createdAt: "2026-08-01T00:00:00.000Z" }],
      completions: [
        {
          id: "comp0001",
          dutyId: "duty-0006",
          actor: "me",
          completedAt: "2026-08-24T12:00:00.000Z",
          actualCost: 24.999,
        },
        {
          id: "comp0002",
          dutyId: "duty-0006",
          actor: "me",
          completedAt: "2026-08-23T12:00:00.000Z",
          costSkipped: true,
        },
        {
          id: "comp0003",
          dutyId: "duty-0006",
          actor: "me",
          completedAt: "2026-08-22T12:00:00.000Z",
          actualCost: -4,
        },
        {
          id: "comp0004",
          dutyId: "duty-0006",
          actor: "me",
          completedAt: "2026-08-21T12:00:00.000Z",
          actualCost: Number.NaN,
        },
        {
          id: "comp0005",
          dutyId: "duty-0006",
          actor: "me",
          completedAt: "2026-08-20T12:00:00.000Z",
          actualCost: 1_000_001,
        },
      ],
    }),
  );
  assert.equal(household.completions.find((item) => item.id === "comp0001")?.actualCost, 25);
  assert.equal(household.completions.find((item) => item.id === "comp0002")?.costSkipped, true);
  assert.equal(household.completions.find((item) => item.id === "comp0003")?.actualCost, undefined);
  assert.equal(household.completions.find((item) => item.id === "comp0004")?.actualCost, undefined);
  assert.equal(household.completions.find((item) => item.id === "comp0005")?.actualCost, undefined);
});
