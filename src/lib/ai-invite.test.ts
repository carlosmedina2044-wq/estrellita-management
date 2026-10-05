import assert from "node:assert/strict";
import { test } from "node:test";
import { aiInviteDismissal, recordAiInviteDismissal, shouldShowAiInvite } from "@/lib/ai-invite";

const day = (iso: string) => new Date(`${iso}T09:00:00`);
const home = (seenTips: string[] = []) => ({ seenTips });

test("shows only when switched off", () => {
  for (const state of ["unknown", "unavailable", "modelNotReady", "available"] as const) {
    assert.equal(shouldShowAiInvite(home(), state, day("2026-10-04")), false, state);
  }
  assert.equal(shouldShowAiInvite(home(), "notEnabled", day("2026-10-04")), true);
});

test("first dismissal hides it for 30 days, then it returns", () => {
  const once = recordAiInviteDismissal(home(["other"]), day("2026-10-04"));
  assert.deepEqual(aiInviteDismissal(once), { count: 1, on: "2026-10-04" });
  assert.equal(shouldShowAiInvite(once, "notEnabled", day("2026-10-04")), false);
  assert.equal(shouldShowAiInvite(once, "notEnabled", day("2026-11-02")), false); // day 29
  assert.equal(shouldShowAiInvite(once, "notEnabled", day("2026-11-03")), true); // day 30
});

test("second dismissal is forever, and keeps one slot in seenTips", () => {
  const once = recordAiInviteDismissal(home(["other"]), day("2026-10-04"));
  const twice = recordAiInviteDismissal(once, day("2026-11-05"));
  assert.deepEqual(aiInviteDismissal(twice), { count: 2, on: "2026-11-05" });
  assert.equal(twice.seenTips.filter((tip) => tip.startsWith("ai-invite:")).length, 1);
  assert.ok(twice.seenTips.includes("other"));
  assert.equal(shouldShowAiInvite(twice, "notEnabled", day("2030-01-01")), false);
});

test("older saves and junk entries read as never dismissed", () => {
  assert.equal(aiInviteDismissal(home(["scan-label-prompt"])), null);
  assert.equal(aiInviteDismissal(home(["ai-invite:x:y"])), null);
  assert.equal(shouldShowAiInvite(home(["ai-invite:x:y"]), "notEnabled", day("2026-10-04")), true);
});
