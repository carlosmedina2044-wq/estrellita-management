import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hapticClose,
  hapticComplete,
  hapticDestructive,
  hapticOrdered,
  hapticPress,
  hapticSuccess,
  hapticTab,
  hapticUndo,
} from "@/lib/native/haptics";

test("haptics are a no-op off native", async () => {
  await assert.doesNotReject(() =>
    Promise.all([
      hapticComplete(),
      hapticSuccess(),
      hapticUndo(),
      hapticOrdered(),
      hapticTab(),
      hapticDestructive(),
      hapticPress(),
      hapticClose(),
    ]),
  );
});
