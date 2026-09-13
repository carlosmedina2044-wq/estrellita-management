import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isAuthFailedKeyError,
  isMissingKeychainItemError,
  isUserCanceledKeyError,
} from "@/lib/native/device-key";

test("missing Keychain item is the plugin's does-not-exist rejection", () => {
  assert.equal(isMissingKeychainItemError(new Error("Item with given key does not exist")), true);
  assert.equal(isMissingKeychainItemError("Item with given key does not exist"), true);
  assert.equal(isMissingKeychainItemError({ code: "not_found", message: "gone" }), true);
});

test("other Keychain errors are not treated as missing", () => {
  assert.equal(isMissingKeychainItemError(new Error("User interaction is not allowed")), false);
  assert.equal(isMissingKeychainItemError(new Error("errSecAuthFailed")), false);
  assert.equal(isMissingKeychainItemError(new Error("The operation couldn’t be completed")), false);
  assert.equal(isMissingKeychainItemError(null), false);
});

test("cancel is distinct from missing", () => {
  assert.equal(isUserCanceledKeyError(new Error("User canceled authentication")), true);
  assert.equal(isUserCanceledKeyError({ code: "user_canceled", message: "nope" }), true);
  assert.equal(isUserCanceledKeyError(new Error("Item with given key does not exist")), false);
  assert.equal(isMissingKeychainItemError(new Error("User canceled authentication")), false);
});

test("auth failed is distinct from missing and cancel", () => {
  assert.equal(isAuthFailedKeyError(new Error("Authentication failed")), true);
  assert.equal(isAuthFailedKeyError({ code: "auth_failed" }), true);
  assert.equal(isAuthFailedKeyError(new Error("User canceled authentication")), false);
  assert.equal(isMissingKeychainItemError(new Error("Authentication failed")), false);
});
