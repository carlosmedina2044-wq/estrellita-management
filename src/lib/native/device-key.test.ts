import assert from "node:assert/strict";
import { test } from "node:test";
import { isMissingKeychainItemError } from "@/lib/native/device-key";

test("missing Keychain item is the plugin's does-not-exist rejection", () => {
  assert.equal(isMissingKeychainItemError(new Error("Item with given key does not exist")), true);
  assert.equal(isMissingKeychainItemError("Item with given key does not exist"), true);
});

test("other Keychain errors are not treated as missing", () => {
  assert.equal(isMissingKeychainItemError(new Error("User interaction is not allowed")), false);
  assert.equal(isMissingKeychainItemError(new Error("errSecAuthFailed")), false);
  assert.equal(isMissingKeychainItemError(new Error("The operation couldn’t be completed")), false);
  assert.equal(isMissingKeychainItemError(null), false);
});
