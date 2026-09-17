import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CATALOG_TOPICS,
  activeTopics,
  dedupePlaybookTasks,
  dutyTopic,
  normalizeTitle,
  splitPlaybookTasks,
} from "@/lib/duty-topics";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { generateHomeFromAnswers, sampleHomeAnswers, seedDutiesForHome } from "@/lib/onboarding/generate";
import { dutyFromPlaybookTask, PLAYBOOKS } from "@/lib/playbooks";
import { WEATHER_TRIGGERS } from "@/lib/weather/provider";
import type { Completion, Duty, Household } from "@/lib/types";

const TOPIC_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function duty(partial: Partial<Duty> & Pick<Duty, "id" | "title">): Duty {
  return {
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
    createdAt: "2026-01-01T00:00:00.000Z",
    archived: false,
    ...partial,
  };
}

function done(dutyId: string, at = "2026-03-01T12:00:00.000Z"): Completion {
  return { id: `c-${dutyId}`, dutyId, actor: "me", visitId: null, completedAt: at };
}

function sampleHome(now: Date): Household {
  const generated = generateHomeFromAnswers(sampleHomeAnswers(), now);
  return withHouseholdDefaults({
    version: 8,
    householdName: generated.householdName,
    ownerName: "",
    cleanerName: "",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: generated.homeId,
    homeType: generated.homeType,
    tenure: generated.tenure,
    location: generated.location,
    attributes: generated.attributes,
    floors: generated.floors,
    rooms: generated.rooms,
    assets: generated.assets,
    consumables: generated.consumables,
    duties: seedDutiesForHome(generated, now),
    completions: [],
    visits: [],
    supplyAutomations: [],
  });
}

test("every playbook and weather-trigger task carries a kebab-case topic", () => {
  const tasks = [
    ...PLAYBOOKS.flatMap((playbook) => playbook.tasks),
    ...WEATHER_TRIGGERS.flatMap((trigger) => trigger.tasks),
  ];
  assert.ok(tasks.length >= 60, `expected the full catalog, saw ${tasks.length} tasks`);
  const untagged = tasks.filter((task) => !task.topic).map((task) => task.title);
  assert.deepEqual(untagged, []);
  for (const task of tasks) {
    assert.match(task.topic as string, TOPIC_ID, `${task.title}: ${task.topic}`);
  }
});

test("a duty created from any seed resolves its topic by title alone", () => {
  assert.equal(dutyTopic({ title: "Clean gutters before freeze" }), "gutters-clear");
  assert.equal(dutyTopic({ title: "Check the sump pump" }), "sump-pump-test");
  assert.equal(dutyTopic({ title: "Replace HVAC filter" }), "hvac-filter");
  assert.equal(dutyTopic({ title: "Something the user typed" }), null);
  assert.ok(Object.keys(CATALOG_TOPICS).length >= 70);
});

test("a live recurring duty holds its topic against a playbook task", () => {
  const existing = [duty({ id: "starter", title: "Replace HVAC filter" })];
  const tasks = [
    { title: "Replace the HVAC filter and record the size.", topic: "hvac-filter" },
    { title: "Label the breaker panel.", topic: "breaker-panel-label" },
  ];
  assert.deepEqual(
    dedupePlaybookTasks(tasks, existing).map((task) => task.title),
    ["Label the breaker panel."],
  );
});

test("an untagged task fails closed on a matching title and passes otherwise", () => {
  const existing = [duty({ id: "sump", title: "Test the sump pump", frequency: "once", dueDate: "2026-04-01" })];
  const { keep, dropped } = splitPlaybookTasks(
    [{ title: "Test the Sump Pump!" }, { title: "Wax the boat" }],
    existing,
  );
  assert.deepEqual(dropped.map((task) => task.title), ["Test the Sump Pump!"]);
  assert.deepEqual(keep.map((task) => task.title), ["Wax the boat"]);
  assert.equal(normalizeTitle("  Test the Sump Pump! "), "test the sump pump");
});

test("an open one-off holds its topic; a completed one releases it for next year", () => {
  const gutters = duty({ id: "g", title: "Clean gutters before freeze", frequency: "once", dueDate: "2026-10-15" });
  const moss = [{ title: "Clear moss and gutters", topic: "gutters-clear" }];
  assert.deepEqual(dedupePlaybookTasks(moss, [gutters]), []);
  assert.deepEqual(dedupePlaybookTasks(moss, [gutters], [done("g")]), moss);
  assert.deepEqual([...activeTopics([gutters], [done("g")])], []);
});

test("within one batch the second task on a topic is dropped", () => {
  const { keep, dropped } = splitPlaybookTasks(
    [
      { title: "Winterize outdoor faucets", topic: "hose-bibs-winterize" },
      { title: "Drain and shut off exterior spigots; store hoses", topic: "hose-bibs-winterize" },
    ],
    [],
  );
  assert.equal(keep.length, 1);
  assert.equal(dropped.length, 1);
});

test("accepting every playbook on the sample home leaves one live duty per topic", () => {
  const now = new Date(2026, 8, 16);
  const household = sampleHome(now);
  const duties: Duty[] = [...household.duties];
  const dueDate = "2026-09-30";
  for (const playbook of PLAYBOOKS) {
    const { keep } = splitPlaybookTasks(playbook.tasks, duties, household.completions);
    for (const task of keep) {
      duties.push({
        id: `${playbook.id}:${task.title}`,
        createdAt: now.toISOString(),
        ...dutyFromPlaybookTask(household, playbook, task, dueDate),
      });
    }
  }
  const counts = new Map<string, number>();
  for (const entry of duties) {
    if (entry.archived) continue;
    const topic = dutyTopic(entry);
    if (!topic) continue;
    counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  const duplicates = [...counts.entries()].filter(([, count]) => count > 1);
  assert.deepEqual(duplicates, []);
  // The real duplicates in the catalog collapse to one each.
  assert.equal(counts.get("hvac-filter"), 1);
  assert.equal(counts.get("gutters-clear"), 1);
  assert.equal(counts.get("hose-bibs-winterize"), 1);
  assert.equal(counts.get("smoke-detectors"), 1);
  assert.equal(counts.get("hvac-service-cooling"), 1);
  assert.equal(counts.get("hvac-service-heating"), 1);
});

test("a tagged task yields to a live duty that carries its exact title under another topic", () => {
  const renamed = duty({ id: "x", title: "Clean gutters before freeze" });
  const tasks = [{ title: "Clean gutters before freeze", topic: "some-other-topic" }];
  assert.deepEqual(dedupePlaybookTasks(tasks, [renamed]), []);
  // Walk duties are in the catalog map, so a playbook filter task sees them.
  assert.equal(dutyTopic({ title: "Replace smoke detector batteries" }), "detector-batteries");
});

