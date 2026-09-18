import assert from "node:assert/strict";
import { test } from "node:test";
import { bestCareLevel, paletteLocks, paletteLocksAtLevel, unlockedPalettes } from "@/lib/scene/unlocks";
import type { CareState, Household } from "@/lib/types";

function home(care: CareState | undefined, history: CareState[] = []): Household {
  return {
    rooms: [],
    duties: [],
    completions: [],
    milestones: [],
    momentum: { enabled: true, bestRun: 0, care, careHistory: history },
  } as unknown as Household;
}

const at = (level: CareState["level"]): CareState => ({ level, since: "2026-01-01" });

test("a new home starts with one colour and the rest named", () => {
  const locks = paletteLocksAtLevel("settling-in");
  assert.deepEqual(
    locks.map((entry) => [entry.palette, entry.unlocked, entry.needs]),
    [
      ["classic", true, null],
      ["terracotta", false, "kept"],
      ["slate", false, "well-kept"],
    ],
  );
});

test("colours open as the care level climbs", () => {
  assert.deepEqual(unlockedPalettes(home(at("kept"))), ["classic", "terracotta"]);
  assert.deepEqual(unlockedPalettes(home(at("well-kept"))), ["classic", "terracotta", "slate"]);
  assert.deepEqual(unlockedPalettes(home(at("loved"))), ["classic", "terracotta", "slate"]);
});

test("an unlock survives the level falling back", () => {
  // Reached "cared-for" once, since dropped to "kept".
  const dropped = home(at("kept"), [at("well-kept"), at("cared-for")]);
  assert.equal(bestCareLevel(dropped), "cared-for");
  assert.deepEqual(unlockedPalettes(dropped), ["classic", "terracotta", "slate"]);
});

test("a colour already worn is never taken away", () => {
  const fresh = home(at("settling-in"));
  const locks = paletteLocks(fresh, new Date(), "slate");
  assert.equal(locks.find((entry) => entry.palette === "slate")?.unlocked, true);
  // The one it did not choose stays shut, so the ladder is still visible.
  assert.equal(locks.find((entry) => entry.palette === "terracotta")?.unlocked, false);
});
