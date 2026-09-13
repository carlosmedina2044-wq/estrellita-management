import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hapticComplete,
  hapticDestructive,
  hapticOrdered,
  hapticTab,
  hapticUndo,
} from "@/lib/native/haptics";

test("haptics are a no-op off native", async () => {
  await assert.doesNotReject(() =>
    Promise.all([hapticComplete(), hapticUndo(), hapticOrdered(), hapticTab(), hapticDestructive()]),
  );
});
