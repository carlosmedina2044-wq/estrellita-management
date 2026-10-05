import assert from "node:assert/strict";
import { test } from "node:test";
import type { CuidalaIntelligencePlugin } from "@/lib/native/cuidala-intelligence";
import {
  aiAvailable,
  aiStructureLabel,
  aiStructureReceipt,
  aiTellCuidala,
  cleanText,
  installIntelligencePluginForTests,
} from "@/lib/native/intelligence";

test.afterEach(() => installIntelligencePluginForTests(null));

function fake(overrides: Partial<Record<keyof CuidalaIntelligencePlugin, unknown>>): CuidalaIntelligencePlugin {
  const reject = async () => Promise.reject(new Error("not stubbed"));
  return {
    availability: reject,
    structureLabel: reject,
    structureReceipt: reject,
    tellCuidala: reject,
    ...overrides,
  } as unknown as CuidalaIntelligencePlugin;
}

const ctx = { rooms: ["Kitchen", "Garage"], duties: ["Wipe counters", "Change furnace filter"], supplies: ["Dish soap"] };

test("off native everything is unavailable and nothing throws", async () => {
  assert.deepEqual(await aiAvailable(), { available: false, reason: "deviceNotEligible" });
  assert.deepEqual(await aiStructureLabel(["x"]), { ok: false, reason: "unavailable" });
  assert.deepEqual(await aiStructureReceipt(["x"], []), { ok: false, reason: "unavailable" });
  assert.deepEqual(await aiTellCuidala("hi", ctx), { ok: false, reason: "unavailable" });
});

test("availability passes known reasons and sanitises junk", async () => {
  installIntelligencePluginForTests(fake({ availability: async () => ({ available: true }) }));
  assert.deepEqual(await aiAvailable(), { available: true });
  installIntelligencePluginForTests(fake({ availability: async () => ({ available: false, reason: "notEnabled" }) }));
  assert.deepEqual(await aiAvailable(), { available: false, reason: "notEnabled" });
  installIntelligencePluginForTests(fake({ availability: async () => ({ available: false, reason: "lol" }) }));
  assert.deepEqual(await aiAvailable(), { available: false, reason: "unavailable" });
  installIntelligencePluginForTests(fake({ availability: async () => "nope" }));
  assert.deepEqual(await aiAvailable(), { available: false, reason: "unavailable" });
  installIntelligencePluginForTests(fake({ availability: async () => null }));
  assert.deepEqual(await aiAvailable(), { available: false, reason: "unavailable" });
});

test("rejection codes map to stable reasons", async () => {
  for (const code of ["unavailable", "refused", "tooLong"] as const) {
    installIntelligencePluginForTests(
      fake({ structureLabel: async () => Promise.reject(Object.assign(new Error("x"), { code })) }),
    );
    assert.deepEqual(await aiStructureLabel(["a"]), { ok: false, reason: code });
  }
  installIntelligencePluginForTests(fake({ structureLabel: async () => Promise.reject(new Error("boom")) }));
  assert.deepEqual(await aiStructureLabel(["a"]), { ok: false, reason: "failed" });
  installIntelligencePluginForTests(fake({ structureLabel: async () => Promise.reject("weird") }));
  assert.deepEqual(await aiStructureLabel(["a"]), { ok: false, reason: "failed" });
});

test("label: good output passes, bad fields are dropped", async () => {
  installIntelligencePluginForTests(
    fake({
      structureLabel: async () => ({
        brand: "  Rheem\u0000 ",
        model: "XG40T06",
        serial: 12345,
        type: "water_heater",
        manufacturedMonth: 3,
        manufacturedYear: 2014,
        filterSize: "16 X 25 x1",
        extra: "ignored",
      }),
    }),
  );
  assert.deepEqual(await aiStructureLabel(["RHEEM"]), {
    ok: true,
    label: {
      brand: "Rheem",
      model: "XG40T06",
      type: "water_heater",
      manufacturedMonth: 3,
      manufacturedYear: 2014,
      filterSize: "16x25x1",
    },
  });
  installIntelligencePluginForTests(
    fake({
      structureLabel: async () => ({
        type: "toaster",
        manufacturedMonth: 13,
        manufacturedYear: 1800,
        filterSize: "big",
        brand: "",
      }),
    }),
  );
  assert.deepEqual(await aiStructureLabel(["RHEEM"]), { ok: true, label: {} });
  // A month with no year is meaningless, so it is dropped.
  installIntelligencePluginForTests(fake({ structureLabel: async () => ({ manufacturedMonth: 5 }) }));
  assert.deepEqual(await aiStructureLabel(["x"]), { ok: true, label: {} });
});

test("label: malformed top-level shapes become an empty label", async () => {
  for (const bad of [null, undefined, "x", 4, [], [1]]) {
    installIntelligencePluginForTests(fake({ structureLabel: async () => bad }));
    assert.deepEqual(await aiStructureLabel(["x"]), { ok: true, label: {} });
  }
});

test("label: empty input skips the model", async () => {
  let called = false;
  installIntelligencePluginForTests(fake({ structureLabel: async () => ((called = true), {}) }));
  assert.deepEqual(await aiStructureLabel(["  ", "\n"]), { ok: true, label: {} });
  assert.equal(called, false);
});

test("receipt: only tracked names are sent, matches must be exact, numbers clamped", async () => {
  let sent: unknown;
  installIntelligencePluginForTests(
    fake({
      structureReceipt: async (options: unknown) => {
        sent = options;
        return {
          store: "Home Depot",
          date: "2026-10-01",
          total: 64.119,
          items: [
            { name: "DW PODS 60CT", qty: 1, price: 9, matchesTracked: "dish soap" },
            { name: "FILTER", price: -5, matchesTracked: "Invented thing" },
            { name: "NaN item", price: Number.NaN, qty: 0 },
            { name: "", price: 3 },
            "junk",
            null,
          ],
        };
      },
    }),
  );
  const result = await aiStructureReceipt(["HOME DEPOT", "TOTAL 64.12"], ["Dish soap", "Furnace filter"]);
  assert.deepEqual(sent, { lines: ["HOME DEPOT", "TOTAL 64.12"], trackedNames: ["Dish soap", "Furnace filter"] });
  assert.deepEqual(result, {
    ok: true,
    receipt: {
      store: "Home Depot",
      date: "2026-10-01",
      total: 64.12,
      items: [
        { name: "DW PODS 60CT", qty: 1, price: 9, matchesTracked: "Dish soap" },
        { name: "FILTER" },
        { name: "NaN item" },
      ],
    },
  });
});

test("receipt: bad dates, huge totals and a bad items field are dropped", async () => {
  for (const date of ["2026-02-30", "10/01/2026", "1999-12-31", "2999-01-01", 20261001, null]) {
    installIntelligencePluginForTests(fake({ structureReceipt: async () => ({ date, total: 1e12, items: "nope" }) }));
    assert.deepEqual(await aiStructureReceipt(["x"], []), { ok: true, receipt: { items: [] } });
  }
});

test("receipt: item list is capped", async () => {
  const items = Array.from({ length: 200 }, (_, i) => ({ name: `Item ${i}` }));
  installIntelligencePluginForTests(fake({ structureReceipt: async () => ({ items }) }));
  const result = await aiStructureReceipt(["x"], []);
  assert.equal(result.ok && result.receipt.items.length, 40);
});

test("tell: valid actions pass, rooms and completions must match the household", async () => {
  installIntelligencePluginForTests(
    fake({
      tellCuidala: async () => ({
        actions: [
          {
            kind: "addChore",
            title: "Change furnace filter",
            room: "garage",
            frequency: { unit: "month", every: 3 },
            notes: "16x25x1",
          },
          { kind: "addChore", title: "Mow", room: "Moon", frequency: { unit: "decade", every: 1 } },
          { kind: "logPurchase", label: "Plumber", amount: 180, date: "2026-10-03" },
          { kind: "completeChore", title: "wipe counters" },
          { kind: "completeChore", title: "Invented chore" },
          { kind: "unknown" },
        ],
      }),
    }),
  );
  const result = await aiTellCuidala("stuff", ctx, "2026-10-04");
  assert.deepEqual(result, {
    ok: true,
    actions: [
      {
        kind: "addChore",
        title: "Change furnace filter",
        room: "Garage",
        frequency: { unit: "month", every: 3 },
        notes: "16x25x1",
      },
      { kind: "addChore", title: "Mow" },
      { kind: "logPurchase", label: "Plumber", amount: 180, date: "2026-10-03" },
      // capped at 3 actions, so the completion is cut
    ],
  });
});

test("tell: completion survives when it fits the cap", async () => {
  installIntelligencePluginForTests(
    fake({ tellCuidala: async () => ({ actions: [{ kind: "completeChore", title: "wipe counters" }] }) }),
  );
  assert.deepEqual(await aiTellCuidala("did the counters", ctx, "2026-10-04"), {
    ok: true,
    actions: [{ kind: "completeChore", title: "Wipe counters" }],
  });
});

test("tell: malformed output yields no actions, never a throw", async () => {
  const bads: unknown[] = [
    null,
    "x",
    {},
    { actions: "x" },
    { actions: [null, 3, "a", [], { kind: 7 }, { kind: "addChore" }, { kind: "addChore", title: " " }] },
    { actions: [{ kind: "logPurchase", label: "x".repeat(500), amount: -1, date: "tomorrow" }] },
  ];
  for (const bad of bads.slice(0, 5)) {
    installIntelligencePluginForTests(fake({ tellCuidala: async () => bad }));
    assert.deepEqual(await aiTellCuidala("x", ctx, "2026-10-04"), { ok: true, actions: [] });
  }
  installIntelligencePluginForTests(fake({ tellCuidala: async () => bads[5] }));
  const result = await aiTellCuidala("x", ctx, "2026-10-04");
  assert.ok(result.ok);
  assert.deepEqual(result.actions, [{ kind: "logPurchase", label: "x".repeat(120) }]);
});

test("tell: future dates beyond tomorrow are dropped; bad today falls back", async () => {
  installIntelligencePluginForTests(
    fake({ tellCuidala: async () => ({ actions: [{ kind: "logPurchase", label: "Pizza", date: "2026-10-09" }] }) }),
  );
  assert.deepEqual(await aiTellCuidala("x", ctx, "2026-10-04"), {
    ok: true,
    actions: [{ kind: "logPurchase", label: "Pizza" }],
  });
  assert.equal((await aiTellCuidala("x", ctx, "garbage")).ok, true);
});

test("tell: empty text skips the model, context is cleaned before sending", async () => {
  const seen: { calls: { text: string; context: typeof ctx }[] } = { calls: [] };
  installIntelligencePluginForTests(
    fake({
      tellCuidala: async (options: unknown) => {
        seen.calls.push(options as (typeof seen.calls)[number]);
        return { actions: [] };
      },
    }),
  );
  assert.deepEqual(await aiTellCuidala("   ", ctx), { ok: true, actions: [] });
  assert.equal(seen.calls.length, 0);
  await aiTellCuidala("a\u0007b\n\nc", { rooms: ["Kitchen", 5 as unknown as string], duties: [], supplies: [] }, "2026-10-04");
  assert.equal(seen.calls[0]?.text, "a b c");
  assert.deepEqual(seen.calls[0]?.context.rooms, ["Kitchen"]);
});

test("cleanText strips controls, collapses space and clamps", () => {
  assert.equal(cleanText("  a\u0000\tb \n c  ", 10), "a b c");
  assert.equal(cleanText("abcdef", 3), "abc");
  assert.equal(cleanText("\u0001", 5), undefined);
  assert.equal(cleanText(7, 5), undefined);
});
