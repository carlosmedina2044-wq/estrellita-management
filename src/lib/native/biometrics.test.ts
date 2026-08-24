import assert from "node:assert/strict";
import { test } from "node:test";
import { lockMethodLabel, type LockMethod } from "@/lib/native/lock-labels";

const expected: Record<LockMethod, { noun: string; toggle: string; prompt: string }> = {
  faceId: {
    noun: "Face ID",
    toggle: "Require Face ID",
    prompt: "Use Face ID or your passcode to open today’s list.",
  },
  touchId: {
    noun: "Touch ID",
    toggle: "Require Touch ID",
    prompt: "Use Touch ID or your passcode to open today’s list.",
  },
  passcode: {
    noun: "your passcode",
    toggle: "Require passcode to open",
    prompt: "Enter your passcode to open today’s list.",
  },
  none: {
    noun: "Face ID",
    toggle: "Require Face ID",
    prompt: "Use Face ID or your passcode to open today’s list.",
  },
};

for (const method of Object.keys(expected) as LockMethod[]) {
  test(`lockMethodLabel(${method}) matches the device-copy table`, () => {
    assert.deepEqual(lockMethodLabel(method), expected[method]);
  });
}
