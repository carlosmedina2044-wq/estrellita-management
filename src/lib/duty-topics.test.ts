import assert from "node:assert/strict";
import { test } from "node:test";
import { activeTopics, dedupePlaybookTasks, dutyTopic, STARTER_TOPICS } from "@/lib/duty-topics";
import type { Duty } from "@/lib/types";

function duty(partial: Partial<Duty> & Pick<Duty, "title">): Duty {
  return {
    id: "d1",
    notes: "",
    room: "kitchen",
    nodeId: "kitchen",
    nodeType: "room",
    audience: "me",
    effort: "small",
    frequency: "monthly",
    kind: "chore",
    weekday: 0,
    monthDay: 1,
    dueDate: null,
    priority: "medium",
    createdAt: "2026-09-13T00:00:00.000Z",
    archived: false,
    ...partial,
  };
}

test("STARTER_TOPICS maps seed titles including colliding playbook topics", () => {
  assert.equal(STARTER_TOPICS["Test smoke detectors"], "smoke-detectors");
  assert.equal(STARTER_TOPICS["Clean dryer vent"], "dryer-vent");
  assert.equal(STARTER_TOPICS["Clean fridge coils"], "fridge-coils");
  assert.equal(STARTER_TOPICS["Replace HVAC filter"], "hvac-filter");
});

test("dutyTopic prefers explicit task.topic over the starter map", () => {
  assert.equal(
    dutyTopic(duty({ title: "Test smoke detectors" }), { title: "Test smoke and CO detectors", topic: "smoke-detectors" }),
    "smoke-detectors",
  );
  assert.equal(
    dutyTopic(duty({ title: "Unrelated custom chore" }), { topic: "hvac-filter" }),
    "hvac-filter",
  );
});

test("dutyTopic falls back to the starter map and does not fuzzy-match", () => {
  assert.equal(dutyTopic(duty({ title: "Test smoke detectors" })), "smoke-detectors");
  assert.equal(dutyTopic(duty({ title: "Test smoke and CO detectors" })), null);
  assert.equal(dutyTopic(duty({ title: "Test smoke detectors extra" })), null);
});

test("activeTopics keeps non-archived recurring duties only", () => {
  const topics = activeTopics([
    duty({ title: "Test smoke detectors", frequency: "monthly" }),
    duty({ id: "d2", title: "Clean dryer vent", frequency: "once" }),
    duty({ id: "d3", title: "Replace HVAC filter", archived: true }),
    duty({ id: "d4", title: "Custom chore" }),
  ]);
  assert.deepEqual([...topics], ["smoke-detectors"]);
});

test("dedupePlaybookTasks drops a tagged task when a recurring duty already covers the topic", () => {
  const kept = dedupePlaybookTasks(
    [
      { title: "Test smoke and CO detectors", topic: "smoke-detectors" },
      { title: "Flush the water heater" },
      { title: "Replace the HVAC filter and record the size.", topic: "hvac-filter" },
    ],
    [duty({ title: "Test smoke detectors", frequency: "monthly" })],
  );
  assert.deepEqual(
    kept.map((task) => task.title),
    ["Flush the water heater", "Replace the HVAC filter and record the size."],
  );
});

test("dedupePlaybookTasks keeps a tagged task when the existing cover is archived or once", () => {
  const kept = dedupePlaybookTasks(
    [{ title: "Clean dryer vent", topic: "dryer-vent" }],
    [
      duty({ title: "Clean dryer vent", frequency: "once" }),
      duty({ id: "d2", title: "Clean dryer vent", frequency: "quarterly", archived: true }),
    ],
  );
  assert.equal(kept.length, 1);
});
