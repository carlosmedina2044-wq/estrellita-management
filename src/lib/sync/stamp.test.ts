import assert from "node:assert/strict";
import { test } from "node:test";
import { stampChanges, nextStamp } from "@/lib/sync/stamp";
import { pruneTombstones, TOMBSTONE_CAP } from "@/lib/sync/model";
import { at, baseHome, makeCompletion, makeDuty, T0 } from "@/lib/sync/test-helpers";
import type { Household } from "@/lib/types";

const NOW = at(T0 + 10_000);

function withDuties(...duties: ReturnType<typeof makeDuty>[]): Household {
  return { ...baseHome(), duties };
}

test("stamp: an unchanged household comes back as the same object", () => {
  const home = withDuties(makeDuty("duty-0001"));
  assert.equal(stampChanges(home, home, NOW), home);
  const touched = { ...home, householdName: home.householdName };
  assert.equal(stampChanges(home, touched, NOW), touched);
});

test("stamp: rebuilding arrays and objects with the same content changes nothing", () => {
  const home = withDuties(makeDuty("duty-0001", { updatedAt: at(T0) }));
  const rebuilt: Household = { ...home, duties: home.duties.map((duty) => ({ ...duty })), rooms: [...home.rooms] };
  const out = stampChanges(home, rebuilt, NOW);
  assert.equal(out.duties[0], home.duties[0], "keeps prev's object, stamp and all");
  assert.equal(JSON.stringify(out), JSON.stringify(home));
  assert.equal(out.tombstones, undefined);
  assert.equal(out.profileUpdatedAt, undefined);
});

test("stamp: unchanged entities stay byte-identical when a sibling changes", () => {
  const a = makeDuty("duty-0001", { updatedAt: at(T0) });
  const b = makeDuty("duty-0002", { updatedAt: at(T0) });
  const prev = withDuties(a, b);
  const next = { ...prev, duties: [a, { ...b, title: "Renamed" }] };
  const out = stampChanges(prev, next, NOW);
  assert.equal(out.duties[0], a);
  assert.equal(out.duties[1]!.updatedAt, NOW);
  assert.equal(out.duties[1]!.title, "Renamed");
});

test("stamp: an added entity gets updatedAt = now", () => {
  const prev = withDuties();
  const next = { ...prev, duties: [makeDuty("duty-0001")] };
  assert.equal(stampChanges(prev, next, NOW).duties[0]!.updatedAt, NOW);
});

test("stamp: removed entities leave a tombstone; the cascade of a chore's completions does not", () => {
  const duty = makeDuty("duty-0001", { updatedAt: at(T0) });
  const done = makeCompletion("comp-0001", "duty-0001", { updatedAt: at(T0) });
  const other = makeCompletion("comp-0002", "duty-0002", { updatedAt: at(T0) });
  const prev: Household = { ...withDuties(duty, makeDuty("duty-0002", { updatedAt: at(T0) })), completions: [done, other] };

  const uncheck = stampChanges(prev, { ...prev, completions: [done] }, NOW);
  assert.deepEqual(uncheck.tombstones, [{ type: "completion", id: "comp-0002", deletedAt: NOW }]);

  const gone = stampChanges(
    prev,
    { ...prev, duties: [prev.duties[1]!], completions: [other] },
    NOW,
  );
  assert.deepEqual(gone.tombstones, [{ type: "duty", id: "duty-0001", deletedAt: NOW }]);
});

test("stamp: re-adding an id removes its tombstone", () => {
  const duty = makeDuty("duty-0001", { updatedAt: at(T0) });
  const prev: Household = {
    ...withDuties(),
    tombstones: [{ type: "duty", id: "duty-0001", deletedAt: at(T0 + 500) }],
  };
  const out = stampChanges(prev, { ...prev, duties: [duty] }, NOW);
  assert.equal(out.tombstones, undefined);
  assert.equal(out.duties[0]!.updatedAt, NOW);
});

test("stamp: the clock never runs behind what is already stored", () => {
  const future = at(T0 + 3_600_000);
  const prev = withDuties(makeDuty("duty-0001", { updatedAt: future }));
  const next = { ...prev, duties: [...prev.duties, makeDuty("duty-0002")] };
  const out = stampChanges(prev, next, NOW);
  assert.equal(out.duties[1]!.updatedAt, at(T0 + 3_600_001));
  assert.equal(nextStamp("not a date", prev), at(T0 + 3_600_001));
});

test("stamp: a profile edit stamps profileUpdatedAt, other fields do not", () => {
  const prev = baseHome();
  const renamed = stampChanges(prev, { ...prev, householdName: "Nueva casa" }, NOW);
  assert.equal(renamed.profileUpdatedAt, NOW);
  const other = stampChanges(prev, { ...prev, mode: "cleaner" }, NOW);
  assert.equal(other.profileUpdatedAt, undefined);
  assert.equal(other.tombstones, undefined);
});

test("stamp: tombstones are pruned after 90 days and capped at 2000", () => {
  const old = { type: "duty" as const, id: "old-duty-1", deletedAt: at(T0 - 91 * 86_400_000) };
  const recent = { type: "duty" as const, id: "new-duty-1", deletedAt: at(T0 - 1000) };
  assert.deepEqual(pruneTombstones([old, recent], at(T0)), [recent]);
  const many = Array.from({ length: TOMBSTONE_CAP + 50 }, (_, i) => ({
    type: "duty" as const,
    id: `duty-${String(i).padStart(5, "0")}`,
    deletedAt: at(T0 - i * 1000),
  }));
  const kept = pruneTombstones(many, at(T0));
  assert.equal(kept.length, TOMBSTONE_CAP);
  assert.equal(kept[0]!.id, "duty-00000");
});

test("stamp: cost on a large household is small", () => {
  const duties = Array.from({ length: 5000 }, (_, i) => makeDuty(`duty-${String(i).padStart(5, "0")}`, { updatedAt: at(T0) }));
  const completions = Array.from({ length: 20000 }, (_, i) =>
    makeCompletion(`comp-${String(i).padStart(6, "0")}`, duties[i % 5000]!.id, { updatedAt: at(T0) }),
  );
  const prev: Household = { ...baseHome(), duties, completions };
  const next = { ...prev, completions: [...completions, makeCompletion("comp-new-001", duties[0]!.id)] };
  const start = performance.now();
  for (let i = 0; i < 20; i += 1) stampChanges(prev, next, NOW);
  const perCall = (performance.now() - start) / 20;
  console.log(`# stampChanges at 5k duties / 20k completions: ${perCall.toFixed(2)} ms per call`);
  assert.ok(perCall < 50, `too slow: ${perCall}ms`);
});
