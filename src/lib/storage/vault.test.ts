import assert from "node:assert/strict";
import { test } from "node:test";
import { decryptJson, encryptJson, generateRawKey, importRawKey, parseEnvelopeJson, PREVIOUS_VAULT_KEY, VAULT_STORAGE_KEY } from "@/lib/crypto";
import { sealBackup } from "@/lib/backup";
import {
  eraseHousehold,
  flushHousehold,
  getHousehold,
  getHouseholdLoad,
  hydrateHousehold,
  importHouseholdBackup,
  installVaultIOForTests,
  isHouseholdSessionUnlocked,
  lockHouseholdSession,
  canUndoLastRestore,
  undoLastRestore,
  QUARANTINED_VAULT_KEY,
  RESTORE_SNAPSHOT_KEY_PREFIX,
  resetVaultForTests,
  unlockHousehold,
  updateHousehold,
  resyncNotifications,
} from "@/lib/storage/vault";
import { DeviceKeyError } from "@/lib/native/device-key";

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

const UNREADABLE_VAULT = JSON.stringify({
  v: 2,
  alg: "A256GCM",
  iv: "AAAAAAAAAAAA",
  ciphertext: "AQID",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

test("S1b: import after key-mismatch quarantines the old vault, mints a key, and persists", async () => {
  resetVaultForTests();
  const store = new Map<string, string>([[VAULT_STORAGE_KEY, UNREADABLE_VAULT]]);
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
  const load = await hydrateHousehold();
  assert.equal(load.ok, false);
  if (!load.ok) assert.equal(load.reason, "key-mismatch");

  const file = await sealBackup(
    JSON.stringify({
      onboarded: true,
      householdName: "Restored Home",
      mode: "cleaner",
      activeVisitId: "visit-old",
    }),
    "correct horse",
  );
  const result = await importHouseholdBackup(file, "correct horse");
  assert.equal(result.ok, true);
  assert.equal(minted, 1);
  assert.equal(store.get(QUARANTINED_VAULT_KEY), UNREADABLE_VAULT);
  assert.notEqual(store.get(VAULT_STORAGE_KEY), UNREADABLE_VAULT);
  assert.ok(store.has(VAULT_STORAGE_KEY));
  assert.equal(store.has(PREVIOUS_VAULT_KEY), false);
  assert.equal(getHousehold().householdName, "Restored Home");
  assert.equal(getHousehold().mode, "owner");
  assert.equal(getHousehold().activeVisitId, null);
  const after = getHouseholdLoad();
  assert.ok(after?.ok);
  resetVaultForTests();
});

test("S1c: import when persist fails reports ok:false", async () => {
  resetVaultForTests();
  const store = new Map<string, string>([[VAULT_STORAGE_KEY, UNREADABLE_VAULT]]);
  const key = await importRawKey(generateRawKey());
  installVaultIOForTests({
    loadDeviceKey: async () => null,
    createDeviceKey: async () => key,
    loadOrCreateDeviceKey: async () => key,
    deleteDeviceKey: async () => {},
    kvGet: async (name) => store.get(name) ?? null,
    kvSet: async (name, value) => {
      if (name === VAULT_STORAGE_KEY && store.has(QUARANTINED_VAULT_KEY)) {
        throw new Error("disk full");
      }
      store.set(name, value);
    },
    kvRemove: async (name) => {
      store.delete(name);
    },
  });
  const load = await hydrateHousehold();
  assert.equal(load.ok, false);
  if (!load.ok) assert.equal(load.reason, "key-mismatch");

  const file = await sealBackup(JSON.stringify({ householdName: "Unsaved" }), "correct horse");
  const result = await importHouseholdBackup(file, "correct horse");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /couldn’t be saved to this iPhone/i);
  }
  const after = getHouseholdLoad();
  assert.equal(after?.ok, false);
  if (after && !after.ok) assert.equal(after.reason, "key-mismatch");
  resetVaultForTests();
});

test("import resets cleaner visit state", async () => {
  resetVaultForTests();
  const store = new Map<string, string>();
  const key = await importRawKey(generateRawKey());
  installVaultIOForTests({
    loadDeviceKey: async () => key,
    createDeviceKey: async () => key,
    loadOrCreateDeviceKey: async () => key,
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
  updateHousehold((current) => ({ ...current, householdName: "Before", onboarded: true }));
  await flushHousehold();

  const file = await sealBackup(
    JSON.stringify({
      onboarded: false,
      householdName: "Cleaner phone",
      mode: "cleaner",
      activeVisitId: "visit-open",
    }),
    "correct horse",
  );
  const result = await importHouseholdBackup(file, "correct horse");
  assert.equal(result.ok, true);
  const household = getHousehold();
  assert.equal(household.mode, "owner");
  assert.equal(household.activeVisitId, null);
  assert.equal(household.onboarded, true);
  assert.equal(household.householdName, "Cleaner phone");
  resetVaultForTests();
});

test("S1d: sample-home persist quarantines a stale vault when Keychain is empty", async () => {
  resetVaultForTests();
  const store = new Map<string, string>([[VAULT_STORAGE_KEY, UNREADABLE_VAULT]]);
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

  const load = await hydrateHousehold();
  assert.equal(load.ok, false);
  if (!load.ok) assert.equal(load.reason, "key-mismatch");
  assert.equal(minted, 0);

  updateHousehold((current) => ({ ...current, householdName: "Sample Home", onboarded: true }));
  await flushHousehold();

  assert.equal(minted, 1);
  assert.equal(store.get(QUARANTINED_VAULT_KEY), UNREADABLE_VAULT);
  assert.notEqual(store.get(VAULT_STORAGE_KEY), UNREADABLE_VAULT);
  assert.ok(store.has(VAULT_STORAGE_KEY));
  assert.equal(getHousehold().householdName, "Sample Home");
  assert.equal(getHousehold().onboarded, true);
  resetVaultForTests();
});

test("S1e: persist reuses a device key that can open the existing vault", async () => {
  resetVaultForTests();
  const key = await importRawKey(generateRawKey());
  const store = new Map<string, string>([
    [VAULT_STORAGE_KEY, JSON.stringify(await encryptJson(key, JSON.stringify({ householdName: "Kept", onboarded: true })))],
  ]);
  let minted = 0;
  installVaultIOForTests({
    loadDeviceKey: async () => key,
    createDeviceKey: async () => {
      minted += 1;
      throw new Error("must not mint over a readable vault");
    },
    loadOrCreateDeviceKey: async () => {
      minted += 1;
      throw new Error("must not mint over a readable vault");
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

  updateHousehold((current) => ({ ...current, householdName: "Updated", onboarded: true }));
  await flushHousehold();

  assert.equal(minted, 0);
  assert.equal(store.has(QUARANTINED_VAULT_KEY), false);
  const envelope = parseEnvelopeJson(store.get(VAULT_STORAGE_KEY) ?? "");
  assert.ok(envelope);
  assert.match(await decryptJson(key, envelope), /"householdName":"Updated"/);
  assert.equal(getHousehold().householdName, "Updated");
  resetVaultForTests();
});

test("S1g: first persist reuses leftover Keychain when no vault exists", async () => {
  resetVaultForTests();
  const store = new Map<string, string>();
  const key = await importRawKey(generateRawKey());
  let minted = 0;
  installVaultIOForTests({
    loadDeviceKey: async () => key,
    createDeviceKey: async () => {
      minted += 1;
      throw new Error("must not mint over leftover Keychain");
    },
    loadOrCreateDeviceKey: async () => key,
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
  updateHousehold((current) => ({ ...current, householdName: "Sample Home", onboarded: true }));
  await flushHousehold();

  assert.equal(minted, 0);
  const envelope = parseEnvelopeJson(store.get(VAULT_STORAGE_KEY) ?? "");
  assert.ok(envelope);
  assert.match(await decryptJson(key, envelope), /"householdName":"Sample Home"/);
  resetVaultForTests();
});

test("S1f: persist refuses to mint when Keychain throws and a vault exists", async () => {
  resetVaultForTests();
  const store = new Map<string, string>([[VAULT_STORAGE_KEY, UNREADABLE_VAULT]]);
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

  updateHousehold((current) => ({ ...current, householdName: "Unsaved", onboarded: true }));
  await flushHousehold();

  assert.equal(minted, 0);
  assert.equal(store.get(VAULT_STORAGE_KEY), UNREADABLE_VAULT);
  assert.equal(store.has(QUARANTINED_VAULT_KEY), false);
  resetVaultForTests();
});

test("erase returns ok:false and keeps memory when kvRemove throws", async () => {
  resetVaultForTests();
  const store = new Map<string, string>();
  const key = await importRawKey(generateRawKey());
  installVaultIOForTests({
    loadDeviceKey: async () => key,
    createDeviceKey: async () => key,
    loadOrCreateDeviceKey: async () => key,
    deleteDeviceKey: async () => {},
    kvGet: async (name) => store.get(name) ?? null,
    kvSet: async (name, value) => {
      store.set(name, value);
    },
    kvRemove: async () => {
      throw new Error("kv locked");
    },
  });
  const first = await hydrateHousehold();
  assert.equal(first.ok, true);
  updateHousehold((current) => ({ ...current, householdName: "Keep me", onboarded: true }));
  await flushHousehold();
  const result = await eraseHousehold();
  assert.equal(result.ok, false);
  assert.equal(getHousehold().householdName, "Keep me");
  resetVaultForTests();
});

test("unlock-before-decrypt: interactive hydrate does not load the device key", async () => {
  resetVaultForTests();
  const key = await importRawKey(generateRawKey());
  const sealed = JSON.stringify(
    await encryptJson(key, JSON.stringify({ householdName: "Secret Home", onboarded: true })),
  );
  const store = new Map<string, string>([[VAULT_STORAGE_KEY, sealed]]);
  let loads = 0;
  installVaultIOForTests({
    requiresInteractiveUnlock: () => true,
    loadDeviceKey: async () => {
      loads += 1;
      return key;
    },
    createDeviceKey: async () => key,
    loadOrCreateDeviceKey: async () => key,
    deleteDeviceKey: async () => {},
    kvGet: async (name) => store.get(name) ?? null,
    kvSet: async (name, value) => {
      store.set(name, value);
    },
    kvRemove: async (name) => {
      store.delete(name);
    },
  });

  const pending = await hydrateHousehold();
  assert.equal(pending.ok, true);
  if (pending.ok) assert.equal(pending.pendingUnlock, true);
  assert.equal(loads, 0);
  assert.equal(isHouseholdSessionUnlocked(), false);
  assert.notEqual(getHousehold().householdName, "Secret Home");

  const unlocked = await unlockHousehold("Unlock Cuidala");
  assert.equal(unlocked.ok, true);
  assert.equal(loads, 1);
  assert.equal(isHouseholdSessionUnlocked(), true);
  assert.equal(getHousehold().householdName, "Secret Home");
  resetVaultForTests();
});

test("lock clears CryptoKey session and plaintext; unlock restores", async () => {
  resetVaultForTests();
  const key = await importRawKey(generateRawKey());
  const sealed = JSON.stringify(
    await encryptJson(key, JSON.stringify({ householdName: "Locked Home", onboarded: true })),
  );
  const store = new Map<string, string>([[VAULT_STORAGE_KEY, sealed]]);
  installVaultIOForTests({
    requiresInteractiveUnlock: () => true,
    loadDeviceKey: async () => key,
    createDeviceKey: async () => key,
    loadOrCreateDeviceKey: async () => key,
    deleteDeviceKey: async () => {},
    kvGet: async (name) => store.get(name) ?? null,
    kvSet: async (name, value) => {
      store.set(name, value);
    },
    kvRemove: async (name) => {
      store.delete(name);
    },
  });

  await hydrateHousehold();
  assert.equal((await unlockHousehold()).ok, true);
  assert.equal(getHousehold().householdName, "Locked Home");

  await lockHouseholdSession();
  assert.equal(isHouseholdSessionUnlocked(), false);
  assert.notEqual(getHousehold().householdName, "Locked Home");
  assert.ok(store.has(VAULT_STORAGE_KEY));

  assert.equal((await unlockHousehold()).ok, true);
  assert.equal(getHousehold().householdName, "Locked Home");
  resetVaultForTests();
});

test("resyncNotifications no-ops while locked", async () => {
  resetVaultForTests();
  const key = await importRawKey(generateRawKey());
  const sealed = JSON.stringify(
    await encryptJson(key, JSON.stringify({ householdName: "Locked Home", onboarded: true })),
  );
  const store = new Map<string, string>([[VAULT_STORAGE_KEY, sealed]]);
  installVaultIOForTests({
    requiresInteractiveUnlock: () => true,
    loadDeviceKey: async () => key,
    createDeviceKey: async () => key,
    loadOrCreateDeviceKey: async () => key,
    deleteDeviceKey: async () => {},
    kvGet: async (name) => store.get(name) ?? null,
    kvSet: async (name, value) => {
      store.set(name, value);
    },
    kvRemove: async (name) => {
      store.delete(name);
    },
  });

  await hydrateHousehold();
  assert.equal((await unlockHousehold()).ok, true);
  assert.equal(await resyncNotifications(), true);

  await lockHouseholdSession();
  assert.equal(isHouseholdSessionUnlocked(), false);
  assert.equal(await resyncNotifications(), false);
  resetVaultForTests();
});

test("write then lock flushes persist before clearing the key", async () => {
  resetVaultForTests();
  const key = await importRawKey(generateRawKey());
  let loadCalls = 0;
  const store = new Map<string, string>([
    [
      VAULT_STORAGE_KEY,
      JSON.stringify(await encryptJson(key, JSON.stringify({ householdName: "Before", onboarded: true }))),
    ],
  ]);
  installVaultIOForTests({
    requiresInteractiveUnlock: () => true,
    loadDeviceKey: async () => {
      loadCalls += 1;
      return key;
    },
    createDeviceKey: async () => key,
    loadOrCreateDeviceKey: async () => key,
    deleteDeviceKey: async () => {},
    kvGet: async (name) => store.get(name) ?? null,
    kvSet: async (name, value) => {
      store.set(name, value);
    },
    kvRemove: async (name) => {
      store.delete(name);
    },
  });

  await hydrateHousehold();
  assert.equal((await unlockHousehold()).ok, true);
  const loadsAfterUnlock = loadCalls;
  updateHousehold((current) => ({ ...current, householdName: "Flushed Home" }));
  await lockHouseholdSession();
  assert.equal(isHouseholdSessionUnlocked(), false);
  const sealed = store.get(VAULT_STORAGE_KEY)!;
  const opened = JSON.parse(await decryptJson(key, parseEnvelopeJson(sealed)!));
  assert.equal(opened.householdName, "Flushed Home");
  assert.equal(loadCalls, loadsAfterUnlock);
  assert.equal((await unlockHousehold()).ok, true);
  assert.equal(getHousehold().householdName, "Flushed Home");
  resetVaultForTests();
});

test("lock with empty persist chain does not load the device key", async () => {
  resetVaultForTests();
  let loadCalls = 0;
  installVaultIOForTests({
    requiresInteractiveUnlock: () => false,
    loadDeviceKey: async () => {
      loadCalls += 1;
      return null;
    },
    createDeviceKey: async () => {
      throw new Error("should not mint");
    },
    loadOrCreateDeviceKey: async () => {
      throw new Error("should not mint");
    },
    deleteDeviceKey: async () => {},
    kvGet: async () => null,
    kvSet: async () => {},
    kvRemove: async () => {},
  });

  await hydrateHousehold();
  await lockHouseholdSession();
  assert.equal(loadCalls, 0);
  resetVaultForTests();
});

test("persist while locked never calls loadDeviceKey", async () => {
  resetVaultForTests();
  let loadCalls = 0;
  const store = new Map<string, string>();
  installVaultIOForTests({
    requiresInteractiveUnlock: () => false,
    loadDeviceKey: async () => {
      loadCalls += 1;
      return null;
    },
    createDeviceKey: async () => {
      throw new Error("should not mint");
    },
    loadOrCreateDeviceKey: async () => {
      throw new Error("should not mint");
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

  await hydrateHousehold();
  // Simulate a persist that lost the race with lock: null captured key after session lock.
  await lockHouseholdSession();
  const loadsAfterLock = loadCalls;
  updateHousehold((current) => ({ ...current, householdName: "Should Not Prompt", onboarded: true }));
  await flushHousehold();
  assert.equal(loadCalls, loadsAfterLock);
  assert.equal(store.has(VAULT_STORAGE_KEY), false);
  resetVaultForTests();
});

test("cancel during unlock is not missing and does not quarantine", async () => {
  resetVaultForTests();
  const key = await importRawKey(generateRawKey());
  const sealed = JSON.stringify(
    await encryptJson(key, JSON.stringify({ householdName: "Still Here", onboarded: true })),
  );
  const store = new Map<string, string>([[VAULT_STORAGE_KEY, sealed]]);
  let minted = 0;
  installVaultIOForTests({
    requiresInteractiveUnlock: () => true,
    loadDeviceKey: async () => {
      throw new DeviceKeyError("User canceled authentication", { code: "user_canceled" });
    },
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

  const pending = await hydrateHousehold();
  assert.equal(pending.ok, true);
  if (pending.ok) assert.equal(pending.pendingUnlock, true);

  const canceled = await unlockHousehold();
  assert.equal(canceled.ok, false);
  if (!canceled.ok) assert.equal(canceled.reason, "canceled");
  assert.equal(minted, 0);
  assert.equal(store.get(VAULT_STORAGE_KEY), sealed);
  assert.equal(store.has(QUARANTINED_VAULT_KEY), false);
  assert.equal(isHouseholdSessionUnlocked(), false);
  resetVaultForTests();
});

test("two quarantines produce two timestamped slots without deleting keys", async () => {
  resetVaultForTests();
  const key = await importRawKey(generateRawKey());
  const sealed = JSON.stringify(
    await encryptJson(key, JSON.stringify({ householdName: "Keep", onboarded: true })),
  );
  const store = new Map<string, string>([[VAULT_STORAGE_KEY, sealed]]);
  let deletedKeys = 0;
  let minted = 0;
  const io = {
    requiresInteractiveUnlock: () => false as const,
    loadDeviceKey: async () => null as CryptoKey | null,
    createDeviceKey: async () => {
      minted += 1;
      return key;
    },
    loadOrCreateDeviceKey: async () => key,
    deleteDeviceKey: async () => {
      deletedKeys += 1;
    },
    kvGet: async (name: string) => store.get(name) ?? null,
    kvSet: async (name: string, value: string) => {
      store.set(name, value);
    },
    kvRemove: async (name: string) => {
      store.delete(name);
    },
  };
  installVaultIOForTests(io);

  await hydrateHousehold();
  assert.equal((await unlockHousehold()).ok, false);

  const backupA = await sealBackup(
    JSON.stringify({ householdName: "Restored A", onboarded: true }),
    "correct horse battery staple",
  );
  assert.equal((await importHouseholdBackup(backupA, "correct horse battery staple")).ok, true);

  store.set(VAULT_STORAGE_KEY, sealed);
  await hydrateHousehold();
  assert.equal((await unlockHousehold()).ok, false);
  const backupB = await sealBackup(
    JSON.stringify({ householdName: "Restored B", onboarded: true }),
    "correct horse battery staple",
  );
  assert.equal((await importHouseholdBackup(backupB, "correct horse battery staple")).ok, true);

  const slots = [...store.keys()].filter((k) => k.startsWith(`${QUARANTINED_VAULT_KEY}.`));
  assert.ok(slots.length >= 2, `expected >=2 timestamped slots, got ${slots.join(",")}`);
  assert.equal(deletedKeys, 0);
  assert.ok(minted >= 1);
  resetVaultForTests();
});

test("unavailable load does not mint on restore", async () => {
  resetVaultForTests();
  const key = await importRawKey(generateRawKey());
  const sealed = JSON.stringify(
    await encryptJson(key, JSON.stringify({ householdName: "Transient", onboarded: true })),
  );
  const store = new Map<string, string>([[VAULT_STORAGE_KEY, sealed]]);
  let minted = 0;
  installVaultIOForTests({
    requiresInteractiveUnlock: () => true,
    loadDeviceKey: async () => {
      throw new DeviceKeyError("User interaction is not allowed", { code: "interaction_not_allowed" });
    },
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

  await hydrateHousehold();
  const unlocked = await unlockHousehold();
  assert.equal(unlocked.ok, false);
  if (!unlocked.ok) assert.equal(unlocked.reason, "unavailable");
  const before = minted;
  const backup = await sealBackup(
    JSON.stringify({ householdName: "Should Keep Key", onboarded: true }),
    "correct horse battery staple",
  );
  await importHouseholdBackup(backup, "correct horse battery staple");
  assert.equal(minted, before);
  assert.equal(store.get(VAULT_STORAGE_KEY), sealed);
  resetVaultForTests();
});

test("restore snapshots the prior vault and undo returns the previous home", async () => {
  resetVaultForTests();
  const store = new Map<string, string>();
  const key = await importRawKey(generateRawKey());
  installVaultIOForTests({
    loadDeviceKey: async () => key,
    createDeviceKey: async () => key,
    loadOrCreateDeviceKey: async () => key,
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
  updateHousehold((current) => ({ ...current, householdName: "Before Restore", onboarded: true }));
  await flushHousehold();
  assert.equal(getHousehold().householdName, "Before Restore");
  assert.equal(canUndoLastRestore(), false);

  const file = await sealBackup(
    JSON.stringify({ householdName: "After Restore", onboarded: true }),
    "correct horse",
  );
  const restored = await importHouseholdBackup(file, "correct horse");
  assert.equal(restored.ok, true);
  assert.equal(getHousehold().householdName, "After Restore");
  assert.equal(canUndoLastRestore(), true);
  const snapshotKeys = [...store.keys()].filter((k) => k.startsWith(RESTORE_SNAPSHOT_KEY_PREFIX));
  assert.equal(snapshotKeys.length, 1);

  const undone = await undoLastRestore();
  assert.equal(undone.ok, true);
  assert.equal(getHousehold().householdName, "Before Restore");
  assert.equal(canUndoLastRestore(), false);

  const again = await undoLastRestore();
  assert.equal(again.ok, false);
  resetVaultForTests();
});
