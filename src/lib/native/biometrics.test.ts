import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEVICE_OWNER_FALLBACK_TITLE,
  isUnimplementedPluginError,
} from "@/lib/native/biometrics";
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

test("device-owner fallback title is a visible Enter Passcode label", () => {
  assert.equal(DEVICE_OWNER_FALLBACK_TITLE, "Enter Passcode");
  assert.notEqual(DEVICE_OWNER_FALLBACK_TITLE, "");
});

test("unimplemented plugin errors are the only ones that fall through", () => {
  assert.equal(isUnimplementedPluginError({ code: "UNIMPLEMENTED" }), true);
  assert.equal(isUnimplementedPluginError(new Error("UNIMPLEMENTED")), true);
  assert.equal(isUnimplementedPluginError(new Error("Method is not implemented on ios")), true);
  assert.equal(isUnimplementedPluginError({ code: "16" }), false);
  assert.equal(isUnimplementedPluginError(new Error("User canceled")), false);
  assert.equal(isUnimplementedPluginError(null), false);
});
