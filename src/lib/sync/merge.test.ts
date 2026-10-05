import assert from "node:assert/strict";
import { test } from "node:test";
import { dedupeDuties, describeMerge, mergeHousehold, settleMerge } from "@/lib/sync/merge";
import { stampChanges } from "@/lib/sync/stamp";
import { at, baseHome, makeCompletion, makeDuty, makeSupply, T0, view } from "@/lib/sync/test-helpers";
import { parseStored } from "@/lib/storage/migrate";
import type { Household } from "@/lib/types";

const CTX = { deviceId: "dev-a", now: at(T0 + 86_400_000) };
const merge = (a: Household, b: Household) => mergeHousehold(a, b, CTX);

function edit(home: Household, ms: number, change: (h: Household) => Household): Household {
  return stampChanges(home, change(home), at(T0 + ms));
}

function withBase(...duties: ReturnType<typeof makeDuty>[]): Household {
  const base = { ...baseHome(), duties };
  return stampChanges(baseHome(), base, at(T0));
}

test("migration: an old save gets updatedAt from its own dates, else the epoch, and no sync keys", () => {
  const home = parseStored(
    JSON.stringify({
      version: 8,
      onboarded: true,
      floors: [{ id: "main", name: "Main", sortOrder: 0 }],
      rooms: [{ id: "whole-home", floorId: null, name: "Whole Home", type: "other", sortOrder: 0, system: "whole-home" }],
      duties: [{ id: "duty-0001", title: "Wipe", createdAt: "2026-05-01T00:00:00.000Z" }],
      completions: [{ id: "comp-0001", dutyId: "duty-0001", completedAt: "2026-05-02T00:00:00.000Z" }],
      haulItems: [{ id: "haul-001", name: "Milk", addedAt: "2026-05-03T00:00:00.000Z" }],
      assets: [{ id: "asset-001", roomId: "whole-home", name: "Heater" }],
    }),
  );
  assert.equal(home.version, 9);
  assert.equal(home.duties[0]!.updatedAt, "2026-05-01T00:00:00.000Z");
  assert.equal(home.completions[0]!.updatedAt, "2026-05-02T00:00:00.000Z");
  assert.equal(home.haulItems![0]!.updatedAt, "2026-05-03T00:00:00.000Z");
  assert.equal(home.assets[0]!.updatedAt, "1970-01-01T00:00:00.000Z");
  assert.equal("tombstones" in home, false);
  assert.equal("sync" in home, false);
  assert.equal("profileUpdatedAt" in home, false);
});

test("migration: reloading a migrated home changes nothing (stable, not time-dependent)", () => {
  const once = parseStored(JSON.stringify({ onboarded: true, assets: [{ id: "asset-001", roomId: "whole-home", name: "Heater" }] }));
  const twice = parseStored(JSON.stringify(once));
  assert.equal(JSON.stringify(twice), JSON.stringify(once));
});

test("rule: entities union by id, higher updatedAt wins", () => {
  const base = withBase(makeDuty("duty-0001", { title: "Old" }));
  const a = edit(base, 1000, (h) => ({ ...h, duties: [{ ...h.duties[0]!, title: "From A" }] }));
  const b = edit(base, 2000, (h) => ({ ...h, duties: [{ ...h.duties[0]!, title: "From B" }, makeDuty("duty-0002")] }));
  const m = merge(a, b);
  assert.equal(m.duties.find((d) => d.id === "duty-0001")!.title, "From B");
  assert.equal(m.duties.length, 2);
  assert.equal(merge(b, a).duties.find((d) => d.id === "duty-0001")!.title, "From B");
});

test("rule: an equal stamp is settled by content, the same way from either side", () => {
  const base = withBase(makeDuty("duty-0001"));
  const a = edit(base, 1000, (h) => ({ ...h, duties: [{ ...h.duties[0]!, title: "Alpha" }] }));
  const b = edit(base, 1000, (h) => ({ ...h, duties: [{ ...h.duties[0]!, title: "Bravo" }] }));
  assert.equal(a.duties[0]!.updatedAt, b.duties[0]!.updatedAt);
  assert.equal(merge(a, b).duties[0]!.title, merge(b, a).duties[0]!.title);
});

test("rule: a delete made after an edit wins; an edit made after a delete brings it back", () => {
  const base = withBase(makeDuty("duty-0001"));
  const edited = edit(base, 1000, (h) => ({ ...h, duties: [{ ...h.duties[0]!, title: "Edited" }] }));
  const deletedLater = edit(base, 2000, (h) => ({ ...h, duties: [] }));
  assert.equal(merge(edited, deletedLater).duties.length, 0);
  assert.equal(merge(deletedLater, edited).duties.length, 0);
  assert.equal(merge(deletedLater, edited).tombstones?.length, 1);

  const deletedEarlier = edit(base, 1000, (h) => ({ ...h, duties: [] }));
  const editedLater = edit(base, 2000, (h) => ({ ...h, duties: [{ ...h.duties[0]!, title: "Edited" }] }));
  const back = merge(deletedEarlier, editedLater);
  assert.equal(back.duties[0]!.title, "Edited");
  assert.equal(back.tombstones, undefined, "the stale tombstone is dropped");
  assert.deepEqual(view(back), view(merge(editedLater, deletedEarlier)));
});

test("rule: a delete tombstone survives and keeps the item gone on a third phone", () => {
  const base = withBase(makeDuty("duty-0001"));
  const gone = edit(base, 1000, (h) => ({ ...h, duties: [] }));
  const third = merge(base, gone);
  assert.equal(third.duties.length, 0);
  assert.equal(merge(third, base).duties.length, 0);
});

test("rule: completions from two phones are both kept, and a chore's completions go with it", () => {
  const base = withBase(makeDuty("duty-0001"));
  const a = edit(base, 1000, (h) => ({ ...h, completions: [makeCompletion("comp-aaaa1", "duty-0001")] }));
  const b = edit(base, 1500, (h) => ({ ...h, completions: [makeCompletion("comp-bbbb1", "duty-0001")] }));
  assert.equal(merge(a, b).completions.length, 2);

  const without = edit(a, 3000, (h) => ({ ...h, duties: [], completions: [] }));
  const m = merge(without, b);
  assert.equal(m.duties.length, 0);
  assert.equal(m.completions.length, 1, "the merge keeps it: the chore might still be brought back");
  const settled = settleMerge(m, at(T0 + 4000));
  assert.equal(settled.completions.length, 0, "settling removes the history of a chore that is really gone");
  assert.deepEqual(settled.tombstones?.filter((t) => t.type === "completion").map((t) => t.id), ["comp-bbbb1"]);
  assert.equal(merge(settled, b).completions.length, 0, "and it stays removed when the other phone syncs again");
  assert.equal(settleMerge(settled, at(T0 + 5000)), settled, "settling twice is a no-op");
});

test("rule: a chore deleted on one phone and edited later on another comes back with its history", () => {
  const base = edit(withBase(makeDuty("duty-0001")), 500, (h) => ({ ...h, completions: [makeCompletion("comp-aaaa1", "duty-0001")] }));
  const deleted = edit(base, 1000, (h) => ({ ...h, duties: [], completions: [] }));
  const edited = edit(base, 2000, (h) => ({ ...h, duties: [{ ...h.duties[0]!, title: "Back" }] }));
  const m = merge(deleted, edited);
  assert.equal(m.duties[0]!.title, "Back");
  assert.equal(m.completions.length, 1);
  assert.equal(settleMerge(m, at(T0 + 3000)), m);
});

test("rule: un-checking a completion on one phone removes it on the other", () => {
  const base = edit(withBase(makeDuty("duty-0001")), 500, (h) => ({ ...h, completions: [makeCompletion("comp-aaaa1", "duty-0001")] }));
  const undone = edit(base, 1000, (h) => ({ ...h, completions: [] }));
  assert.equal(merge(base, undone).completions.length, 0);
});

test("rule: supplies are last-writer-wins, the newest stock count survives, derived fields are recomputed", () => {
  const duty = makeDuty("duty-0001");
  const base = withBase(duty);
  const seeded = edit(base, 500, (h) => ({ ...h, supplyAutomations: [makeSupply("sup-00001", "duty-0001")] }));
  // A counts stock later, then B changes something else even later.
  const a = edit(seeded, 1000, (h) => ({
    ...h,
    supplyAutomations: [{ ...h.supplyAutomations[0]!, lastConfirmedLevel: 0, lastConfirmedAt: "2026-09-10", flaggedLowAt: "2026-09-10T08:00:00.000Z" }],
  }));
  const b = edit(seeded, 2000, (h) => ({
    ...h,
    supplyAutomations: [{ ...h.supplyAutomations[0]!, leadTimeDays: 30, lastConfirmedLevel: 2, lastConfirmedAt: "2026-09-02", orderInFlight: true, state: "stocked" as const }],
  }));
  const m = merge(a, b).supplyAutomations[0]!;
  assert.equal(m.leadTimeDays, 30, "entity: last writer wins");
  assert.equal(m.lastConfirmedAt, "2026-09-10", "count: greater lastConfirmedAt wins");
  assert.equal(m.lastConfirmedLevel, 0);
  assert.equal(m.state, "ordered", "derived: state follows orderInFlight (normalizeConsumable)");
  assert.deepEqual(view(merge(a, b)), view(merge(b, a)));
});

test("rule: momentum.bestRun is the max; teaching ORs and keeps the earliest start; onboarded ORs; care stays local", () => {
  const a = { ...baseHome(), onboarded: false, momentum: { enabled: true, bestRun: 4, care: { level: "kept" as const, since: "2026-09-01" } }, teaching: { startedAt: "2026-09-05", checkedChore: true, openedRestock: false, setDigestOrZip: false } };
  const b = { ...baseHome(), onboarded: true, momentum: { enabled: false, bestRun: 9 }, teaching: { startedAt: "2026-09-02", checkedChore: false, openedRestock: true, setDigestOrZip: false } };
  const m = merge(a, b);
  assert.equal(m.momentum.bestRun, 9);
  assert.equal(m.momentum.enabled, true, "enabled is a per-device setting");
  assert.deepEqual(m.momentum.care, a.momentum.care);
  assert.deepEqual(m.teaching, { startedAt: "2026-09-02", checkedChore: true, openedRestock: true, setDigestOrZip: false });
  assert.equal(m.onboarded, true);
});

test("rule: seenTips, milestones, check-ins, weather fires, saved links are unions", () => {
  const a = { ...baseHome(), seenTips: ["x", "y"], checkIns: ["2026-09-01"], milestones: [{ id: "first-close" as const, earnedAt: "2026-09-03T00:00:00.000Z" }], weatherFires: [{ triggerId: "freeze", firedAt: "2026-09-01T00:00:00.000Z" }] };
  const b = { ...baseHome(), seenTips: ["y", "z"], checkIns: ["2026-09-02"], milestones: [{ id: "first-close" as const, earnedAt: "2026-09-02T00:00:00.000Z" }, { id: "first-week" as const, earnedAt: "2026-09-04T00:00:00.000Z" }], weatherFires: [{ triggerId: "freeze", firedAt: "2026-09-01T00:00:00.000Z" }] };
  const m = merge(a, b);
  assert.deepEqual(m.seenTips, ["x", "y", "z"]);
  assert.deepEqual(m.checkIns, ["2026-09-01", "2026-09-02"]);
  assert.deepEqual(m.milestones.map((x) => [x.id, x.earnedAt]), [["first-close", "2026-09-02T00:00:00.000Z"], ["first-week", "2026-09-04T00:00:00.000Z"]]);
  assert.equal(m.weatherFires.length, 1);
});

test("rule: per-device fields keep the local value", () => {
  const a: Household = { ...baseHome(), mode: "cleaner", activeVisitId: "visit-0001", lockSettings: { requireFaceId: false, lockAfter: "15min" }, morningBrief: { enabled: false, hour: 6, weekdaysOnly: true }, sync: { enabled: true, deviceId: "dev-a" } };
  const b: Household = { ...baseHome(), mode: "owner", lockSettings: { requireFaceId: true, lockAfter: "immediate" }, morningBrief: { enabled: true, hour: 9, weekdaysOnly: false }, restockDigest: { enabled: false, weekday: 2, hour: 7, lastSentOn: null, permissionAsked: true }, sync: { enabled: true, deviceId: "dev-b" } };
  const m = merge(a, b);
  assert.equal(m.mode, "cleaner");
  assert.equal(m.activeVisitId, "visit-0001");
  assert.deepEqual(m.lockSettings, a.lockSettings);
  assert.deepEqual(m.morningBrief, a.morningBrief);
  assert.deepEqual(m.restockDigest, a.restockDigest);
  assert.equal(m.sync?.deviceId, "dev-a");
});

test("rule: the home profile is last writer wins as a whole", () => {
  const base = baseHome();
  const a = stampChanges(base, { ...base, householdName: "Casa A" }, at(T0 + 1000));
  const b = stampChanges(base, { ...base, householdName: "Casa B", ownerName: "Beto" }, at(T0 + 2000));
  const m = merge(a, b);
  assert.equal(m.householdName, "Casa B");
  assert.equal(m.ownerName, "Beto");
  assert.equal(m.profileUpdatedAt, at(T0 + 2000));
});

test("rule: a deleted room reattaches its duties, assets and notes to the whole home; nothing is dropped", () => {
  const room = { id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen" as const, sortOrder: 5, updatedAt: at(T0) };
  const base = stampChanges(
    baseHome(),
    {
      ...baseHome(),
      rooms: [...baseHome().rooms, room],
      assets: [{ id: "asset-001", roomId: "kitchen", name: "Oven", type: "range_oven" as const }],
      duties: [makeDuty("duty-0001", { room: "kitchen", nodeId: "kitchen" })],
      houseNotes: [{ id: "note-0001", roomId: "kitchen", title: "Breaker", body: "", kind: "breaker" as const, createdAt: at(T0) }],
    },
    at(T0),
  );
  const deleted = edit(base, 1000, (h) => ({ ...h, rooms: h.rooms.filter((r) => r.id !== "kitchen") }));
  const m = merge(deleted, base);
  assert.equal(m.rooms.some((r) => r.id === "kitchen"), false);
  assert.equal(m.duties[0]!.room, "whole-home");
  assert.equal(m.assets[0]!.roomId, "whole-home");
  assert.equal(m.houseNotes![0]!.roomId, undefined);
  assert.deepEqual(view(m), view(merge(base, deleted)));
});

test("totality: malformed or older remotes never throw", () => {
  const local = withBase(makeDuty("duty-0001"));
  const junk = [
    null,
    undefined,
    {},
    { duties: "nope", tombstones: 7, sync: "x" },
    { duties: [null, 3, { id: "bad" }], completions: [{ id: "x" }], version: 99 },
    { tombstones: [{ type: "bogus", id: 1 }, { type: "duty", id: "duty-0001", deletedAt: "never" }] },
  ];
  for (const remote of junk) {
    const out = merge(local, remote as unknown as Household);
    assert.equal(out.duties.some((d) => d.id === "duty-0001"), true);
  }
  assert.doesNotThrow(() => merge(junk[0] as unknown as Household, local));
});

test("old remotes (no stamps, version 8) lose to a later local edit", () => {
  const local = edit(withBase(makeDuty("duty-0001")), 5000, (h) => ({ ...h, duties: [{ ...h.duties[0]!, title: "New title" }] }));
  const old = JSON.parse(JSON.stringify(local)) as Record<string, unknown>;
  old.version = 8;
  for (const duty of old.duties as Record<string, unknown>[]) {
    delete duty.updatedAt;
    duty.title = "Stale title";
  }
  assert.equal(merge(local, old as unknown as Household).duties[0]!.title, "New title");
});

test("dedupeDuties folds identical chores, re-points links, tombstones the extras", () => {
  const a = makeDuty("duty-aaaa1", { title: "Wipe counters", createdAt: at(T0), rolledCompletions: 1 });
  const b = makeDuty("duty-bbbb1", { title: "  wipe  COUNTERS ", createdAt: at(T0 + 5000), rolledCompletions: 2 });
  const c = makeDuty("duty-cccc1", { title: "Wipe counters", frequency: "monthly" });
  const home: Household = {
    ...baseHome(),
    duties: [a, b, c],
    completions: [makeCompletion("comp-aaaa1", "duty-bbbb1")],
    supplyAutomations: [makeSupply("sup-00001", "duty-bbbb1")],
  };
  const out = dedupeDuties(home, at(T0 + 10_000));
  assert.deepEqual(out.removedIds, ["duty-bbbb1"]);
  assert.deepEqual(out.household.duties.map((d) => d.id), ["duty-aaaa1", "duty-cccc1"]);
  assert.equal(out.household.duties[0]!.rolledCompletions, 3);
  assert.equal(out.household.completions[0]!.dutyId, "duty-aaaa1");
  assert.equal(out.household.supplyAutomations[0]!.dutyId, "duty-aaaa1");
  assert.deepEqual(out.household.tombstones, [{ type: "duty", id: "duty-bbbb1", deletedAt: at(T0 + 10_000) }]);
  assert.equal(dedupeDuties(out.household, at(T0 + 20_000)).removedIds.length, 0);
});

test("describeMerge reports both sides, the overlap and the combined size", () => {
  const shared = makeDuty("duty-0001");
  const a: Household = { ...baseHome(), duties: [shared, makeDuty("duty-aaaa1", { title: "Mop" })], completions: [makeCompletion("comp-aaaa1", "duty-0001")] };
  const b: Household = { ...baseHome(), duties: [shared, makeDuty("duty-bbbb1", { title: "Mop" })] };
  const d = describeMerge(a, b);
  assert.equal(d.localCounts.duties, 2);
  assert.equal(d.remoteCounts.duties, 2);
  assert.equal(d.sharedDuties, 1);
  assert.equal(d.onlyLocalDuties, 1);
  assert.equal(d.mergedCounts.duties, 2, "the two Mops are one chore once combined");
  assert.equal(d.likelyDuplicateDuties, 1);
  assert.equal(d.looksLikeDifferentHomes, false);
  const strangers = describeMerge({ ...baseHome(), duties: [makeDuty("duty-aaaa1")] }, { ...baseHome(), duties: [makeDuty("duty-bbbb1", { title: "Other" })] });
  assert.equal(strangers.looksLikeDifferentHomes, true);
});

test("merge(a, a) leaves the shared data as it was", () => {
  const home = edit(withBase(makeDuty("duty-0001")), 1000, (h) => ({ ...h, completions: [makeCompletion("comp-aaaa1", "duty-0001")], haulItems: [{ id: "haul-001", name: "Milk", addedAt: at(T0) }] }));
  assert.deepEqual(view(merge(home, home)), view(home));
});
