import assert from "node:assert/strict";
import { test } from "node:test";
import { rankKits } from "@/lib/scene/infer-kit";
import { KIT_TYPES } from "@/lib/types";
import type { OnboardingAnswers } from "@/lib/onboarding/generate";

function answers(partial: Partial<OnboardingAnswers>): OnboardingAnswers {
  return {
    homeType: "house",
    location: {},
    nickname: "Casa",
    ...partial,
  };
}

test("rankKits returns every kit type exactly once", () => {
  const ranked = rankKits(answers({}));
  assert.deepEqual([...ranked].sort(), [...KIT_TYPES].sort());
  assert.equal(new Set(ranked).size, KIT_TYPES.length);
});

test("a compact apartment ranks a single-storey compact kit above a wide two-storey one", () => {
  const ranked = rankKits(answers({ homeType: "apartment", floors: 1, bedrooms: 1 }));
  assert.ok(ranked.indexOf("q") < ranked.indexOf("n"), "expected kit q (1-storey, compact) before kit n (2-storey, wide)");
});

test("a large house ranks a wide two-storey kit above a compact single-storey one", () => {
  const ranked = rankKits(answers({ homeType: "house", floors: 2, bedrooms: 4 }));
  assert.ok(ranked.indexOf("n") < ranked.indexOf("q"), "expected kit n (2-storey, wide) before kit q (1-storey, compact)");
});
