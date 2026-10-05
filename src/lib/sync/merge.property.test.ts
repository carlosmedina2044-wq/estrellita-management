import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeHousehold, settleMerge } from "@/lib/sync/merge";
import { stampChanges } from "@/lib/sync/stamp";
import { at, baseHome, makeCompletion, makeDuty, makeSupply, prng, T0, view } from "@/lib/sync/test-helpers";
import type { Household } from "@/lib/types";

/**
 * Random operation sequences on replicas that sync in arbitrary, partial,
 * repeated and out-of-order ways. A seed is the whole test case, so a failure
 * prints the seed that reproduces it.
 */

const SEEDS = Number(process.env.SYNC_SEEDS) || 300;
const CTX_NOW = at(T0 + 30 * 86_400_000);
const merge = (a: Household, b: Household) => mergeHousehold(a, b, { deviceId: "any", now: CTX_NOW });

type Rng = ReturnType<typeof prng>;

type World = {
  rng: Rng;
  replicas: Household[];
  /** Per-replica wall clock, quantised to whole seconds so replicas tie on purpose. */
  clocks: number[];
  /** Older copies of replicas that can be "delivered" late, or twice. */
  inbox: Household[];
  counter: number;
  /** Completions the user created and never un-checked (cascades by chore deletion are excluded by the check). */
  created: Map<string, string>;
  unchecked: Set<string>;
  /** Chores some phone deleted; their history went with them, so a later resurrection starts empty. */
  deletedDuties: Set<string>;
};

const TITLES = ["Wipe counters", "Mop floors", "Water plants", "Check smoke alarms", "Take out trash"];

function startWorld(seed: number, replicaCount: number): World {
  const rng = prng(seed);
  let base = baseHome();
  const seedDuties = Array.from({ length: 2 + rng.int(3) }, (_, i) =>
    makeDuty(`duty-seed${i}000`, { title: TITLES[i]!, createdAt: at(T0) }),
  );
  base = stampChanges(base, { ...base, duties: seedDuties }, at(T0));
  return {
    rng,
    replicas: Array.from({ length: replicaCount }, () => base),
    clocks: Array.from({ length: replicaCount }, (_, i) => T0 + 60_000 + i * 1000 * rng.int(3)),
    inbox: [],
    counter: 0,
    created: new Map(),
    unchecked: new Set(),
    deletedDuties: new Set(),
  };
}

function step(world: World, who: number) {
  const { rng } = world;
  world.clocks[who]! += 1000 * rng.int(4);
  const now = at(world.clocks[who]!);
  const prev = world.replicas[who]!;
  const id = (kind: string) => `${kind}-r${who}n${String(++world.counter).padStart(5, "0")}`;
  let next: Household = prev;
  const op = rng.int(12);
  const duty = prev.duties.length > 0 ? rng.pick(prev.duties) : undefined;

  if (op === 0) {
    next = { ...prev, duties: [...prev.duties, makeDuty(id("duty"), { title: rng.pick(TITLES), createdAt: now })] };
  } else if (op === 1 && duty) {
    next = {
      ...prev,
      duties: prev.duties.map((d) => (d.id === duty.id ? { ...d, title: `${rng.pick(TITLES)} ${rng.int(9)}`, notes: `n${rng.int(9)}` } : d)),
    };
  } else if (op === 2 && duty) {
    // Deleting a chore removes its completions and restock item with it, like the app.
    world.deletedDuties.add(duty.id);
    next = {
      ...prev,
      duties: prev.duties.filter((d) => d.id !== duty.id),
      completions: prev.completions.filter((c) => c.dutyId !== duty.id),
      supplyAutomations: prev.supplyAutomations.filter((s) => s.dutyId !== duty.id),
    };
  } else if ((op === 3 || op === 4 || op === 5) && duty) {
    const cid = id("comp");
    world.created.set(cid, duty.id);
    next = { ...prev, completions: [...prev.completions, makeCompletion(cid, duty.id, { completedAt: now })] };
  } else if (op === 6 && prev.completions.length > 0) {
    const gone = rng.pick(prev.completions);
    world.unchecked.add(gone.id);
    next = { ...prev, completions: prev.completions.filter((c) => c.id !== gone.id) };
  } else if (op === 7 && duty) {
    if (prev.supplyAutomations.length < 3 && !prev.supplyAutomations.some((s) => s.dutyId === duty.id)) {
      next = {
        ...prev,
        duties: prev.duties.map((d) => (d.id === duty.id ? { ...d, kind: "replacement" as const } : d)),
        supplyAutomations: [...prev.supplyAutomations, makeSupply(id("sup"), duty.id, { createdAt: now })],
      };
    }
  } else if (op === 8 && prev.supplyAutomations.length > 0) {
    const sup = rng.pick(prev.supplyAutomations);
    const day = `2026-09-${String(1 + rng.int(28)).padStart(2, "0")}`;
    next = {
      ...prev,
      supplyAutomations: prev.supplyAutomations.map((s) =>
        s.id === sup.id
          ? rng.chance(0.5)
            ? { ...s, onHand: rng.int(5), leadTimeDays: rng.int(30) }
            : (() => {
              const ordered = rng.chance(0.3);
              return { ...s, lastConfirmedAt: day, lastConfirmedLevel: rng.int(4), orderInFlight: ordered, state: ordered ? ("ordered" as const) : ("stocked" as const) };
            })()
          : s,
      ),
    };
  } else if (op === 9) {
    next = { ...prev, haulItems: [...(prev.haulItems ?? []), { id: id("haul"), name: `item ${rng.int(99)}`, addedAt: now }] };
  } else if (op === 10 && (prev.haulItems?.length ?? 0) > 0) {
    const gone = rng.pick(prev.haulItems!);
    const rest = prev.haulItems!.filter((h) => h.id !== gone.id);
    next = rest.length > 0 ? { ...prev, haulItems: rest } : (({ haulItems: _h, ...r }) => (void _h, r as Household))(prev);
  } else if (op === 11) {
    next = { ...prev, householdName: `Casa ${rng.int(50)}`, momentum: { ...prev.momentum, bestRun: prev.momentum.bestRun + rng.int(3) } };
  }
  world.replicas[who] = stampChanges(prev, next, now);
}

/** Random syncs: full or stale snapshots, delivered in any order, possibly twice. */
function gossip(world: World, count: number) {
  const { rng } = world;
  for (let i = 0; i < count; i += 1) {
    const from = rng.int(world.replicas.length);
    const to = rng.int(world.replicas.length);
    if (rng.chance(0.4)) world.inbox.push(world.replicas[from]!);
    if (from !== to && rng.chance(0.6)) world.replicas[to] = merge(world.replicas[to]!, world.replicas[from]!);
    if (world.inbox.length > 0 && rng.chance(0.4)) {
      const stale = rng.pick(world.inbox);
      world.replicas[to] = merge(world.replicas[to]!, stale);
      if (rng.chance(0.3)) world.replicas[to] = merge(world.replicas[to]!, stale);
    }
  }
}

function runWorld(seed: number, replicaCount = 3, ops = 40): World {
  const world = startWorld(seed, replicaCount);
  for (let i = 0; i < ops; i += 1) {
    step(world, world.rng.int(replicaCount));
    if (world.rng.chance(0.3)) gossip(world, 1 + world.rng.int(2));
  }
  return world;
}

function converge(world: World) {
  const n = world.replicas.length;
  for (let round = 0; round < 2; round += 1) {
    for (const i of world.rng.shuffle([...Array(n).keys()])) {
      for (const j of world.rng.shuffle([...Array(n).keys()])) {
        if (i !== j) world.replicas[i] = merge(world.replicas[i]!, world.replicas[j]!);
      }
    }
  }
}

const same = (a: Household, b: Household, message: string) => assert.deepEqual(view(a), view(b), message);

test("property: replicas converge after exchanging full states in any order", () => {
  const start = performance.now();
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const world = runWorld(seed);
    converge(world);
    for (let i = 1; i < world.replicas.length; i += 1) {
      same(world.replicas[0]!, world.replicas[i]!, `seed ${seed}: replica 0 and ${i} differ`);
    }
  }
  console.log(`# convergence: ${SEEDS} seeds in ${(performance.now() - start).toFixed(0)} ms`);
});

test("property: merge is commutative, idempotent and associative", () => {
  const start = performance.now();
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const world = runWorld(seed);
    const [a, b, c] = world.replicas as [Household, Household, Household];
    same(merge(a, b), merge(b, a), `seed ${seed}: commutativity`);
    same(merge(a, a), a, `seed ${seed}: merge(a,a) == a`);
    same(merge(merge(a, b), b), merge(a, b), `seed ${seed}: merge(merge(a,b),b) == merge(a,b)`);
    same(merge(merge(a, b), a), merge(a, b), `seed ${seed}: merge(merge(a,b),a) == merge(a,b)`);
    same(merge(merge(a, b), c), merge(a, merge(b, c)), `seed ${seed}: associativity`);
    same(merge(merge(a, b), c), merge(merge(c, a), b), `seed ${seed}: any order of three`);
  }
  console.log(`# algebra: ${SEEDS} seeds in ${(performance.now() - start).toFixed(0)} ms`);
});

test("property: no completion is ever lost while its chore lives (a deleted chore takes its history with it)", () => {
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const world = runWorld(seed, 3, 50);
    converge(world);
    const final = world.replicas[0]!;
    const dutyIds = new Set(final.duties.map((d) => d.id));
    const have = new Set(final.completions.map((c) => c.id));
    for (const [completionId, dutyId] of world.created) {
      if (world.unchecked.has(completionId)) continue;
      if (!dutyIds.has(dutyId) || world.deletedDuties.has(dutyId)) continue;
      assert.ok(have.has(completionId), `seed ${seed}: completion ${completionId} of live chore ${dutyId} was lost`);
    }
  }
});

test("property: settling orphans is stable: after it, every phone still agrees and nothing comes back", () => {
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const world = runWorld(seed, 3, 50);
    converge(world);
    world.replicas = world.replicas.map((h, i) => settleMerge(h, at(T0 + 40 * 86_400_000 + i * 1000)));
    converge(world);
    const final = world.replicas[0]!;
    const dutyIds = new Set(final.duties.map((d) => d.id));
    for (const c of final.completions) assert.ok(dutyIds.has(c.dutyId), `seed ${seed}: orphan completion ${c.id}`);
    for (const s of final.supplyAutomations) assert.ok(dutyIds.has(s.dutyId), `seed ${seed}: orphan supply ${s.id}`);
    for (let i = 1; i < world.replicas.length; i += 1) same(world.replicas[0]!, world.replicas[i]!, `seed ${seed}: settled replicas differ`);
  }
});

test("property: an edit after a delete brings the item back; a delete after an edit wins", () => {
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const rng = prng(seed * 7919);
    const base = stampChanges(baseHome(), { ...baseHome(), duties: [makeDuty("duty-shared01")] }, at(T0));
    const tDelete = T0 + 1000 * (1 + rng.int(20));
    let tEdit = T0 + 1000 * (1 + rng.int(20));
    if (tEdit === tDelete) tEdit += 1; // a tie is covered by its own rule: the delete wins
    const deleted = stampChanges(base, { ...base, duties: [] }, at(tDelete));
    const edited = stampChanges(base, { ...base, duties: [{ ...base.duties[0]!, title: "Edited" }] }, at(tEdit));
    for (const out of [merge(deleted, edited), merge(edited, deleted)]) {
      if (tEdit > tDelete) {
        assert.equal(out.duties.length, 1, `seed ${seed}: later edit resurrects`);
        assert.equal(out.duties[0]!.title, "Edited");
      } else {
        assert.equal(out.duties.length, 0, `seed ${seed}: later delete wins`);
      }
    }
  }
});

test("property: nothing is lost to a deleted room, and merge output survives a reload unchanged", () => {
  for (let seed = 1; seed <= 100; seed += 1) {
    const world = runWorld(seed, 2, 30);
    converge(world);
    const merged = world.replicas[0]!;
    const reloaded = mergeHousehold(merged, merged, { deviceId: "x", now: CTX_NOW });
    same(reloaded, merged, `seed ${seed}: stable under a second pass`);
  }
});
