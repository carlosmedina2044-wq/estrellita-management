import assert from "node:assert/strict";
import { test } from "node:test";
import { setActiveAppLocale } from "@/i18n";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import type { Completion, Duty, Household } from "@/lib/types";
import { widgetSnapshotFor } from "@/lib/widget-snapshot";

function duty(partial: Partial<Duty> & Pick<Duty, "title">): Duty {
  return {
    id: "d1",
    notes: "",
    room: "kitchen",
    nodeId: "kitchen",
    nodeType: "room",
    audience: "me",
    effort: "small",
    frequency: "daily",
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

function completion(partial: Partial<Completion> = {}): Completion {
  return {
    id: "c1",
    dutyId: "d1",
    actor: "me",
    visitId: null,
    completedAt: "2026-09-13T12:00:00.000Z",
    ...partial,
  };
}

function household(overrides: Partial<Household> = {}): Household {
  return withHouseholdDefaults({
    version: 8,
    householdName: "Casa",
    ownerName: "Me",
    cleanerName: "Ana",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: "home",
    floors: [{ id: "main", name: "Main", sortOrder: 0 }],
    rooms: [{ id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 0 }],
    assets: [],
    duties: [],
    completions: [],
    visits: [],
    supplyAutomations: [],
    ...overrides,
  });
}

test.afterEach(() => {
  setActiveAppLocale("en");
});

test("widgetSnapshotFor counts open and done duties and keeps three titles", () => {
  const now = new Date(2026, 8, 13, 15, 0, 0);
  const home = household({
    duties: [
      duty({ id: "open-a", title: "Wipe counters", effort: "large" }),
      duty({ id: "open-b", title: "Clean bathrooms", effort: "medium" }),
      duty({ id: "open-c", title: "Take out trash", effort: "small" }),
      duty({ id: "open-d", title: "Vacuum floors", effort: "small" }),
      duty({ id: "done-a", title: "Tidy the living room", effort: "small" }),
    ],
    completions: [
      completion({
        id: "done",
        dutyId: "done-a",
        completedAt: new Date(2026, 8, 13, 9, 0, 0).toISOString(),
      }),
    ],
  });
  const snap = widgetSnapshotFor(home, now);
  assert.equal(snap.dueCount, 4);
  assert.equal(snap.doneCount, 1);
  assert.equal(snap.updatedAt, now.toISOString());
  assert.deepEqual(snap.titles, ["Wipe counters", "Clean bathrooms", "Take out trash"]);
  assert.equal(snap.dueLabel, "4 due");
  assert.equal(snap.doneLabel, "1 done");
  assert.equal(snap.emptyLabel, "All clear");
  assert.equal(snap.runLength, 0);
  assert.equal(snap.dayFraction, 0.2);
  assert.equal(snap.careLabel, "Settling in");
  assert.equal(snap.runLabel, "");
});

test("widgetSnapshotFor omits titles when privateNotifications is on", () => {
  const now = new Date(2026, 8, 13, 15, 0, 0);
  const doneHome = household({
    restockDigest: {
      enabled: true,
      weekday: 0,
      hour: 9,
      lastSentOn: null,
      permissionAsked: false,
      privateNotifications: true,
    },
    duties: [
      duty({ id: "open-a", title: "Wipe counters" }),
      duty({ id: "done-a", title: "Clean bathrooms" }),
    ],
    completions: [
      completion({
        id: "done",
        dutyId: "done-a",
        completedAt: new Date(2026, 8, 13, 8, 0, 0).toISOString(),
      }),
    ],
  });
  const snap = widgetSnapshotFor(doneHome, now);
  assert.equal(snap.dueCount, 1);
  assert.equal(snap.doneCount, 1);
  assert.deepEqual(snap.titles, []);
});

test("widgetSnapshotFor localizes seed titles at snapshot time", () => {
  setActiveAppLocale("es");
  const now = new Date(2026, 8, 13, 15, 0, 0);
  const home = household({
    duties: [duty({ id: "open-a", title: "Clean bathrooms" })],
  });
  const snap = widgetSnapshotFor(home, now);
  assert.deepEqual(snap.titles, ["Limpiar baños"]);
});

test("widgetSnapshotFor is empty when nothing is due or done", () => {
  const now = new Date(2026, 8, 13, 15, 0, 0);
  const snap = widgetSnapshotFor(household(), now);
  assert.equal(snap.dueCount, 0);
  assert.equal(snap.doneCount, 0);
  assert.deepEqual(snap.titles, []);
  assert.equal(snap.dueLabel, "0 due");
  assert.equal(snap.doneLabel, "0 done");
  assert.equal(snap.emptyLabel, "All clear");
  assert.equal(snap.dayFraction, 0);
  assert.equal(snap.careLabel, "Settling in");
  // A clear day counts toward the closed-day run.
  assert.equal(snap.runLength, 1);
  assert.equal(snap.runLabel, "Day 1");
});

test("widgetSnapshotFor clears momentum fields when momentum is off", () => {
  const now = new Date(2026, 8, 13, 15, 0, 0);
  const snap = widgetSnapshotFor(
    household({
      momentum: { enabled: false, bestRun: 0 },
      duties: [duty({ id: "open-a", title: "Wipe counters" })],
    }),
    now,
  );
  assert.equal(snap.dueCount, 1);
  assert.equal(snap.runLength, 0);
  assert.equal(snap.dayFraction, 0);
  assert.equal(snap.careLabel, "");
  assert.equal(snap.runLabel, "");
});

test("widgetSnapshotFor carries the house: kit, palette, season, window paint, layer files and phase times", () => {
  const snapshot = widgetSnapshotFor(
    household({ duties: [duty({ title: "Wipe counters" })] }),
    new Date(2026, 8, 17, 10),
  );
  assert.equal(snapshot.kitType, "a");
  assert.equal(snapshot.palette, "classic");
  assert.equal(snapshot.season, "autumn");
  assert.equal(snapshot.windowStates.split(",").length, 3);
  assert.ok(snapshot.windowStates.split(",").every((state) => ["lit", "dim", "off"].includes(state)));
  assert.equal(snapshot.layerFiles.length, 7);
  assert.ok(snapshot.layerFiles.every((file) => file.startsWith("/portraits/") && file.endsWith(".webp")));
  assert.equal(snapshot.phaseTimes.length, 6);
  // Fallback sun (no coordinates): dawn starts 40 minutes before a 06:30 sunrise.
  assert.equal(snapshot.phaseTimes[0], 390 - 40);
  for (let i = 1; i < snapshot.phaseTimes.length; i += 1) assert.ok(snapshot.phaseTimes[i] >= snapshot.phaseTimes[i - 1]);
});

