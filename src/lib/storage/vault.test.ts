import assert from "node:assert/strict";
import { test } from "node:test";
import { generateRawKey, importRawKey, VAULT_STORAGE_KEY } from "@/lib/crypto";
import {
  flushHousehold,
  getHousehold,
  hydrateHousehold,
  installVaultIOForTests,
  resetVaultForTests,
  updateHousehold,
} from "@/lib/storage/vault";

test("hydrate retries a failed persist instead of dropping in-memory household", async () => {
  resetVaultForTests();
  const key = await importRawKey(generateRawKey());
  const store = new Map<string, string>();
  let failSet = false;
  installVaultIOForTests({
    loadDeviceKey: async () => key,
    createDeviceKey: async () => key,
    loadOrCreateDeviceKey: async () => key,
    deleteDeviceKey: async () => {},
    kvGet: async (name) => store.get(name) ?? null,
    kvSet: async (name, value) => {
      if (failSet) throw new Error("disk full");
      store.set(name, value);
    },
    kvRemove: async (name) => {
      store.delete(name);
    },
  });

  const first = await hydrateHousehold();
  assert.equal(first.ok, true);
  updateHousehold((current) => ({ ...current, householdName: "Kept", onboarded: true }));
  await flushHousehold();
  assert.ok(store.has(VAULT_STORAGE_KEY));

  failSet = true;
  updateHousehold((current) => ({ ...current, householdName: "Unsaved" }));
  await flushHousehold();
  assert.equal(getHousehold().householdName, "Unsaved");

  failSet = false;
  const retried = await hydrateHousehold();
  assert.equal(retried.ok, true);
  assert.equal(getHousehold().householdName, "Unsaved");
  await flushHousehold();
  assert.ok(store.has(VAULT_STORAGE_KEY));
  resetVaultForTests();
});

test("S1: vault present and missing key reports key-mismatch without minting a key", async () => {
  resetVaultForTests();
  const store = new Map<string, string>([[VAULT_STORAGE_KEY, JSON.stringify({
    v: 2,
    alg: "A256GCM",
    iv: "AAAAAAAAAAAA",
    ciphertext: "AQID",
    updatedAt: "2026-01-01T00:00:00.000Z",
  })]]);
  let minted = 0;
  installVaultIOForTests({
    loadDeviceKey: async () => null,
    createDeviceKey: async () => {
      minted += 1;
      throw new Error("must not mint");
    },
    loadOrCreateDeviceKey: async () => {
      minted += 1;
      throw new Error("must not mint");
    },
    deleteDeviceKey: async () => {},
    kvGet: async (name) => store.get(name) ?? null,
    kvSet: async (name, value) => {
      store.set(name, value);
    },
    kvRemove: async (name) => {
      store.delete(name);
    },
  });
  const result = await hydrateHousehold();
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "key-mismatch");
  assert.equal(minted, 0);
  resetVaultForTests();
});

test("S1: vault present and Keychain throw reports unavailable without minting", async () => {
  resetVaultForTests();
  const store = new Map<string, string>([[VAULT_STORAGE_KEY, JSON.stringify({
    v: 2,
    alg: "A256GCM",
    iv: "AAAAAAAAAAAA",
    ciphertext: "AQID",
    updatedAt: "2026-01-01T00:00:00.000Z",
  })]]);
  let minted = 0;
  installVaultIOForTests({
    loadDeviceKey: async () => {
      throw new Error("User interaction is not allowed");
    },
    createDeviceKey: async () => {
      minted += 1;
      throw new Error("must not mint");
    },
    loadOrCreateDeviceKey: async () => {
      minted += 1;
      throw new Error("must not mint");
    },
    deleteDeviceKey: async () => {},
    kvGet: async (name) => store.get(name) ?? null,
    kvSet: async (name, value) => {
      store.set(name, value);
    },
    kvRemove: async (name) => {
      store.delete(name);
    },
  });
  const result = await hydrateHousehold();
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "unavailable");
  assert.equal(minted, 0);
  resetVaultForTests();
});

test("S1: empty first launch does not mint a key until the first write", async () => {
  resetVaultForTests();
  const store = new Map<string, string>();
  const key = await importRawKey(generateRawKey());
  let minted = 0;
  installVaultIOForTests({
    loadDeviceKey: async () => null,
    createDeviceKey: async () => {
      minted += 1;
      return key;
    },
    loadOrCreateDeviceKey: async () => {
      minted += 1;
      return key;
    },
    deleteDeviceKey: async () => {},
    kvGet: async (name) => store.get(name) ?? null,
    kvSet: async (name, value) => {
      store.set(name, value);
    },
    kvRemove: async (name) => {
      store.delete(name);
    },
  });
  const first = await hydrateHousehold();
  assert.equal(first.ok, true);
  assert.equal(minted, 0);
  updateHousehold((current) => ({ ...current, householdName: "New", onboarded: true }));
  await flushHousehold();
  assert.equal(minted, 1);
  assert.ok(store.has(VAULT_STORAGE_KEY));
  resetVaultForTests();
});
