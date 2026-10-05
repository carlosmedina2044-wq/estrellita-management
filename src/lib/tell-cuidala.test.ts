import assert from "node:assert/strict";
import { test } from "node:test";
import { translate } from "@/i18n";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import type { AiAction } from "@/lib/native/intelligence";
import {
  applyTellActions,
  completionTargets,
  describeAction,
  dutyIdByTitle,
  frequencyFor,
  isUsable,
  tellContext,
} from "@/lib/tell-cuidala";
import type { Household } from "@/lib/types";

const NOW = new Date(2026, 9, 4, 12); // a Sunday
const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate("en", key, params);
const money = (v: number) => `$${v}`;

function home(overrides: Partial<Household> = {}): Household {
  return withHouseholdDefaults({
    version: 8,
    householdName: "Test",
    ownerName: "Me",
    cleanerName: "",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: "home",
    floors: [{ id: "main", name: "Main", sortOrder: 0 }],
    rooms: [
      { id: "whole-home", floorId: null, name: "Whole Home", type: "other", sortOrder: 0, system: "whole-home" },
      { id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 1 },
      { id: "garage", floorId: "main", name: "Garage", type: "garage", sortOrder: 2 },
    ],
    assets: [],
    duties: [
      {
        id: "duty0001",
        title: "Wipe counters",
        notes: "",
        room: "kitchen",
        nodeId: "kitchen",
        nodeType: "room",
        audience: "me",
        effort: "small",
        frequency: "daily",
        kind: "chore",
        weekday: 1,
        monthDay: 1,
        dueDate: null,
        priority: "low",
        createdAt: "2026-09-01T00:00:00.000Z",
        archived: false,
      },
    ],
    completions: [],
    visits: [],
    supplyAutomations: [],
    ...overrides,
  });
}

test("frequencies land on the app's cadences, and unknown ones on the closest", () => {
  assert.equal(frequencyFor(undefined), "once");
  assert.equal(frequencyFor({ unit: "month", every: 3 }), "quarterly");
  assert.equal(frequencyFor({ unit: "month", every: 6 }), "semiannual");
  assert.equal(frequencyFor({ unit: "month", every: 12 }), "yearly");
  assert.equal(frequencyFor({ unit: "year", every: 1 }), "yearly");
  assert.equal(frequencyFor({ unit: "week", every: 1 }), "weekly");
  assert.equal(frequencyFor({ unit: "day", every: 1 }), "daily");
  assert.equal(frequencyFor({ unit: "month", every: 1 }), "monthly");
  assert.equal(frequencyFor({ unit: "week", every: 5 }), "monthly");
});

test("the model only ever sees on-screen names", () => {
  const ctx = tellContext(home());
  assert.ok(ctx.rooms.includes("Kitchen"));
  assert.deepEqual(ctx.duties, ["Wipe counters"]);
});

test("adding a chore uses the app's duty save, in the named room", () => {
  const action: AiAction = { kind: "addChore", title: "Change the furnace filter", room: "Garage", frequency: { unit: "month", every: 3 } };
  const next = applyTellActions(home(), [action], NOW);
  const added = next.duties.find((d) => d.title === "Change the furnace filter");
  assert.ok(added);
  assert.equal(added.room, "garage");
  assert.equal(added.nodeId, "garage");
  assert.equal(added.frequency, "quarterly");
  assert.equal(added.kind, "chore");
  assert.equal(added.archived, false);
  assert.equal(next.duties.length, 2);
});

test("a chore with no room goes to Whole Home, and with no frequency is one time, due today", () => {
  const next = applyTellActions(home(), [{ kind: "addChore", title: "Call the plumber" }], NOW);
  const added = next.duties.find((d) => d.title === "Call the plumber")!;
  assert.equal(added.room, "whole-home");
  assert.equal(added.frequency, "once");
  assert.equal(added.dueDate, "2026-10-04");
});

test("logging a purchase records the amount and day; no amount is not usable", () => {
  const next = applyTellActions(home(), [{ kind: "logPurchase", label: "Kitchen sink repair", amount: 180, date: "2026-10-02" }], NOW);
  assert.equal(next.purchases.length, 1);
  assert.equal(next.purchases[0]!.actualCost, 180);
  assert.equal(next.purchases[0]!.label, "Kitchen sink repair");
  assert.ok(next.purchases[0]!.completedAt.startsWith("2026-10-02"));
  assert.equal(isUsable(home(), { kind: "logPurchase", label: "Sink" }), false);
  assert.equal(applyTellActions(home(), [{ kind: "logPurchase", label: "Sink" }], NOW).purchases.length, 0);
});

test("marking done is left to the app's own completion flow", () => {
  const h = home();
  const action: AiAction = { kind: "completeChore", title: "wipe counters" };
  assert.equal(isUsable(h, action), true);
  assert.deepEqual(completionTargets(h, [action, action]), ["duty0001"]);
  assert.equal(applyTellActions(h, [action], NOW).completions.length, 0);
  assert.equal(dutyIdByTitle(h, "Nope"), undefined);
  assert.equal(isUsable(h, { kind: "completeChore", title: "Nope" }), false);
  const archived = home({ duties: h.duties.map((d) => ({ ...d, archived: true })) });
  assert.equal(isUsable(archived, action), false);
});

test("confirm rows read like something you would say", () => {
  const h = home();
  assert.equal(
    describeAction(h, { kind: "addChore", title: "Change the furnace filter", room: "Garage", frequency: { unit: "month", every: 3 } }, t, money),
    "Add chore: Change the furnace filter · every 3 months · Garage",
  );
  assert.equal(describeAction(h, { kind: "addChore", title: "Call the plumber" }, t, money), "Add chore: Call the plumber · one time");
  assert.equal(describeAction(h, { kind: "logPurchase", label: "kitchen sink repair", amount: 180 }, t, money), "Log $180 for kitchen sink repair");
  assert.equal(describeAction(h, { kind: "completeChore", title: "Wipe counters" }, t, money), "Mark Wipe counters done");
});
