import {
  decryptJson,
  encryptJson,
  isLegacyPinEnvelope,
  LEGACY_PLAINTEXT_KEY,
  LEGACY_VAULT_KEY,
  parseEnvelopeJson,
  PREVIOUS_VAULT_KEY,
  VAULT_STORAGE_KEY,
} from "@/lib/crypto";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { emptyHomeTree } from "@/lib/home-model";
import {
  createDeviceKey,
  deleteDeviceKey,
  DeviceKeyError,
  deviceKeyRequiresInteractiveUnlock,
  getLastMintedKeyId,
  isPasscodeRequiredKeyError,
  isUserCanceledKeyError,
  loadDeviceKey,
  loadOrCreateDeviceKey,
} from "@/lib/native/device-key";
import { kvGet, kvRemove, kvSet } from "@/lib/native/kv";
import { syncScheduledNotifications } from "@/lib/notifications";
import { isPlainObject } from "@/lib/sanitize";
import { EMPTY_HOUSEHOLD, migrateHousehold, parseStored } from "@/lib/storage/migrate";
import type { Household, LockAfter } from "@/lib/types";

export type HouseholdLoad =
  | { ok: true; legacyLockedVault: boolean; pendingUnlock?: boolean }
  | { ok: false; reason: "corrupt" | "unavailable" | "key-mismatch" | "passcode_required" };

export type UnlockHouseholdResult =
  | { ok: true }
  | { ok: false; reason: "canceled" | "auth_failed" | "key-mismatch" | "corrupt" | "unavailable" | "passcode_required" };

export const PERSIST_FAILED_EVENT = "cuidala-persist-failed";
/** Copy of a vault that could not be opened. Hydrate never reads this key. */
export const QUARANTINED_VAULT_KEY = "cuidala-vault-v2-unreadable";

/** Thrown when a persist runs after the session has locked and no key was captured. */
export class SessionLockedError extends Error {
  constructor(message = "Household session is locked") {
    super(message);
    this.name = "SessionLockedError";
  }
}

/** Non-sensitive fields kept while the vault session is locked (plaintext scrubbed). */
export type VaultSessionMeta = {
  onboarded: boolean;
  requireFaceId: boolean;
  lockAfter: LockAfter;
  mode: Household["mode"];
  cleanerVisitActive: boolean;
};

type VaultIO = {
  kvGet: typeof kvGet;
  kvSet: typeof kvSet;
  kvRemove: typeof kvRemove;
  loadDeviceKey: typeof loadDeviceKey;
  createDeviceKey: typeof createDeviceKey;
  loadOrCreateDeviceKey: typeof loadOrCreateDeviceKey;
  deleteDeviceKey: typeof deleteDeviceKey;
  requiresInteractiveUnlock: () => boolean;
};

const defaultIO = (): VaultIO => ({
  kvGet,
  kvSet,
  kvRemove,
  loadDeviceKey,
  createDeviceKey,
  loadOrCreateDeviceKey,
  deleteDeviceKey,
  requiresInteractiveUnlock: deviceKeyRequiresInteractiveUnlock,
});

let io: VaultIO = defaultIO();

/** Test-only: swap persistence adapters. Pass null to restore production IO. */
export function installVaultIOForTests(next: Partial<VaultIO> | null) {
  io = next ? { ...defaultIO(), ...next } : defaultIO();
}

/** Test-only: reset module-level vault state. */
export function resetVaultForTests() {
  memory = null;
  didHydrate = false;
  lastLoad = null;
  key = null;
  keyId = null;
  sessionUnlocked = true;
  sessionMeta = null;
  persistChain = Promise.resolve();
  persistOk = true;
  if (notifyTimer) clearTimeout(notifyTimer);
  notifyTimer = null;
  io = defaultIO();
}

let memory: Household | null = null;
let didHydrate = false;
let lastLoad: HouseholdLoad | null = null;
let key: CryptoKey | null = null;
/** Keychain account keyId for the active session (`"v2"` for legacy envelopes). */
let keyId: string | null = null;
let sessionUnlocked = true;
let sessionMeta: VaultSessionMeta | null = null;
let persistChain: Promise<void> = Promise.resolve();
let persistOk = true;
let notifyTimer: ReturnType<typeof setTimeout> | null = null;

function cloneEmpty(): Household {
  return withHouseholdDefaults({
    ...EMPTY_HOUSEHOLD,
    ...emptyHomeTree(),
    duties: [],
    completions: [],
    visits: [],
    supplyAutomations: [],
    assets: [],
    consumables: [],
    playbookDecisions: [],
    weatherFires: [],
  });
}

const CHANGE_EVENT = "cuidala-change";

function notifyChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function captureSessionMeta(household: Household): VaultSessionMeta {
  return {
    onboarded: household.onboarded,
    requireFaceId: Boolean(household.lockSettings?.requireFaceId),
    lockAfter: household.lockSettings?.lockAfter ?? "2min",
    mode: household.mode,
    cleanerVisitActive: household.mode === "cleaner",
  };
}

async function persist(next: Household, capturedKey: CryptoKey | null) {
  let deviceKey = capturedKey;
  if (!deviceKey) {
    if (!sessionUnlocked) {
      throw new SessionLockedError();
    }
    deviceKey = await resolveDeviceKeyForPersist();
    key = deviceKey;
  }
  const envelope = await encryptJson(deviceKey, JSON.stringify(next), VAULT_STORAGE_KEY, keyId ?? undefined);
  await io.kvSet(VAULT_STORAGE_KEY, JSON.stringify(envelope));
  scheduleNotificationSync(next);
}

async function resolveDeviceKeyForPersist(): Promise<CryptoKey> {
  const existingVault = (await io.kvGet(VAULT_STORAGE_KEY)) ?? (await io.kvGet(PREVIOUS_VAULT_KEY));
  if (!existingVault) {
    // Uninstall often leaves the Keychain item. Reuse it when there is
    // nothing to decrypt; mint only when the item is genuinely absent.
    const minted = await io.loadOrCreateDeviceKey({ reason: "Save your home on this iPhone", keyId: keyId ?? undefined });
    keyId = getLastMintedKeyId() ?? keyId ?? "v2";
    return minted;
  }

  const envelope = parseEnvelopeJson(existingVault);
  const envelopeKeyId = envelope?.keyId ?? "v2";

  let existingKey: CryptoKey | null = null;
  try {
    existingKey = await io.loadDeviceKey({
      reason: "Save your home on this iPhone",
      keyId: envelopeKeyId,
    });
  } catch (error) {
    if (isUserCanceledKeyError(error)) {
      throw new DeviceKeyError("User canceled authentication", { cause: error, code: "user_canceled" });
    }
    throw new DeviceKeyError("Refusing to mint a new key while a vault exists");
  }

  if (existingKey && (await canDecryptVault(existingKey, existingVault))) {
    keyId = envelopeKeyId;
    return existingKey;
  }

  // Stale or unreadable leftover (empty Keychain, or a key that cannot open it).
  // Quarantine first — never overwrite with a newly minted key on the same account.
  await quarantineUnreadableVault();
  const fresh = await io.createDeviceKey();
  keyId = getLastMintedKeyId() ?? mintFallbackKeyId();
  return fresh;
}

function mintFallbackKeyId(): string {
  return `k${Date.now().toString(36)}`;
}

async function canDecryptVault(deviceKey: CryptoKey, raw: string): Promise<boolean> {
  const envelope = parseEnvelopeJson(raw);
  if (!envelope) return false;
  try {
    await decryptJson(deviceKey, envelope);
    return true;
  } catch {
    return false;
  }
}

function scheduleNotificationSync(next: Household) {
  if (notifyTimer) clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    void syncScheduledNotifications(next).catch(() => {});
  }, 1500);
}

function write(next: Household) {
  if (!sessionUnlocked) {
    persistChain = persistChain
      .then(() => {
        throw new SessionLockedError();
      })
      .catch(() => {
        const firstFailure = persistOk;
        persistOk = false;
        if (firstFailure && typeof window !== "undefined") {
          window.dispatchEvent(new Event(PERSIST_FAILED_EVENT));
        }
      });
    return;
  }
  memory = next;
  sessionMeta = captureSessionMeta(next);
  sessionUnlocked = true;
  notifyChange();
  const keyAtWrite = key;
  persistChain = persistChain
    .then(() => persist(next, keyAtWrite))
    .then(() => {
      persistOk = true;
    })
    .catch(() => {
      const firstFailure = persistOk;
      persistOk = false;
      if (firstFailure && typeof window !== "undefined") {
        window.dispatchEvent(new Event(PERSIST_FAILED_EVENT));
      }
    });
}

export function getHousehold(): Household {
  if (!didHydrate) return EMPTY_HOUSEHOLD;
  if (!sessionUnlocked) return EMPTY_HOUSEHOLD;
  return memory ?? EMPTY_HOUSEHOLD;
}

export function getHouseholdLoad(): HouseholdLoad | null {
  return lastLoad;
}

export function isHouseholdSessionUnlocked(): boolean {
  return sessionUnlocked;
}

export function getVaultSessionMeta(): VaultSessionMeta | null {
  return sessionMeta;
}

/** Clears in-memory CryptoKey and household plaintext. Ciphertext stays on disk. */
export async function lockHouseholdSession(): Promise<void> {
  await flushHousehold().catch(() => {});
  key = null;
  keyId = null;
  memory = null;
  sessionUnlocked = false;
  if (lastLoad?.ok) {
    lastLoad = { ok: true, legacyLockedVault: false, pendingUnlock: true };
  }
  notifyChange();
}

/**
 * ACL Keychain get → decrypt → hydrate UI.
 * Cancel stays locked and must not quarantine or mint.
 */
export async function unlockHousehold(reason = "Unlock Cuidala"): Promise<UnlockHouseholdResult> {
  await persistChain.catch(() => {});
  try {
    let raw = await io.kvGet(VAULT_STORAGE_KEY);
    let fromPreviousKey = false;
    if (!raw) {
      raw = await io.kvGet(PREVIOUS_VAULT_KEY);
      fromPreviousKey = Boolean(raw);
    }
    if (!raw) {
      // No ciphertext — treat as empty unlocked session.
      memory = cloneEmpty();
      key = null;
      keyId = null;
      sessionUnlocked = true;
      sessionMeta = captureSessionMeta(memory);
      lastLoad = { ok: true, legacyLockedVault: legacyLockedVaultPresent() };
      notifyChange();
      return { ok: true };
    }

    const envelope = parseEnvelopeJson(raw);
    const envelopeKeyId = envelope?.keyId ?? "v2";

    let deviceKey: CryptoKey | null = null;
    try {
      deviceKey = await io.loadDeviceKey({ reason, keyId: envelopeKeyId });
    } catch (error) {
      if (isUserCanceledKeyError(error)) return { ok: false, reason: "canceled" };
      if (error instanceof DeviceKeyError && error.code === "auth_failed") {
        return { ok: false, reason: "auth_failed" };
      }
      if (isPasscodeRequiredKeyError(error)) {
        lastLoad = { ok: false, reason: "passcode_required" };
        return { ok: false, reason: "passcode_required" };
      }
      lastLoad = { ok: false, reason: "unavailable" };
      return { ok: false, reason: "unavailable" };
    }
    if (!deviceKey) {
      lastLoad = { ok: false, reason: "key-mismatch" };
      return { ok: false, reason: "key-mismatch" };
    }
    if (!envelope) {
      lastLoad = { ok: false, reason: "corrupt" };
      return { ok: false, reason: "corrupt" };
    }

    try {
      memory = parseStored(await decryptJson(deviceKey, envelope));
    } catch {
      key = null;
      keyId = null;
      memory = null;
      sessionUnlocked = false;
      lastLoad = { ok: false, reason: "key-mismatch" };
      return { ok: false, reason: "key-mismatch" };
    }

    key = deviceKey;
    keyId = envelopeKeyId;
    sessionUnlocked = true;
    sessionMeta = captureSessionMeta(memory);
    if (fromPreviousKey) {
      await persist(memory, key);
      await io.kvRemove(PREVIOUS_VAULT_KEY);
    }
    if (typeof window !== "undefined") window.localStorage.removeItem("estrellita-audit-v1");
    lastLoad = { ok: true, legacyLockedVault: false };
    notifyChange();
    return { ok: true };
  } catch (error) {
    if (isUserCanceledKeyError(error)) return { ok: false, reason: "canceled" };
    if (isPasscodeRequiredKeyError(error)) {
      lastLoad = { ok: false, reason: "passcode_required" };
      return { ok: false, reason: "passcode_required" };
    }
    lastLoad = {
      ok: false,
      reason: error instanceof DOMException || error instanceof DeviceKeyError ? "unavailable" : "corrupt",
    };
    return { ok: false, reason: lastLoad.reason === "unavailable" ? "unavailable" : "corrupt" };
  }
}

/** Resolves once every queued write has reached storage (failures are absorbed). */
export function flushHousehold(): Promise<void> {
  return persistChain.catch(() => {});
}

async function readLegacyPlaintext(): Promise<Household | null> {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LEGACY_PLAINTEXT_KEY);
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!isPlainObject(parsed) || isLegacyPinEnvelope(parsed)) return null;
  return migrateHousehold(parsed);
}

function legacyLockedVaultPresent(): boolean {
  if (typeof window === "undefined") return false;
  for (const storageKey of [LEGACY_VAULT_KEY, LEGACY_PLAINTEXT_KEY]) {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) continue;
    try {
      if (isLegacyPinEnvelope(JSON.parse(raw))) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

async function decryptVaultRaw(
  raw: string,
  fromPreviousKey: boolean,
  reason: string,
): Promise<HouseholdLoad> {
  const envelope = parseEnvelopeJson(raw);
  const envelopeKeyId = envelope?.keyId ?? "v2";
  try {
    key = await io.loadDeviceKey({ reason, keyId: envelopeKeyId });
  } catch (error) {
    if (isUserCanceledKeyError(error)) {
      sessionUnlocked = false;
      lastLoad = { ok: true, legacyLockedVault: false, pendingUnlock: true };
      return lastLoad;
    }
    if (isPasscodeRequiredKeyError(error)) {
      lastLoad = { ok: false, reason: "passcode_required" };
      return lastLoad;
    }
    lastLoad = { ok: false, reason: "unavailable" };
    return lastLoad;
  }
  if (!key) {
    lastLoad = { ok: false, reason: "key-mismatch" };
    return lastLoad;
  }
  if (!envelope) {
    lastLoad = { ok: false, reason: "corrupt" };
    return lastLoad;
  }
  try {
    memory = parseStored(await decryptJson(key, envelope));
  } catch {
    key = null;
    keyId = null;
    lastLoad = { ok: false, reason: "key-mismatch" };
    return lastLoad;
  }
  keyId = envelopeKeyId;
  if (fromPreviousKey) {
    await persist(memory, key);
    await io.kvRemove(PREVIOUS_VAULT_KEY);
  }
  if (typeof window !== "undefined") window.localStorage.removeItem("estrellita-audit-v1");
  sessionUnlocked = true;
  sessionMeta = captureSessionMeta(memory);
  lastLoad = { ok: true, legacyLockedVault: false };
  return lastLoad;
}

/**
 * Loads the household from encrypted storage. Never deletes anything it cannot
 * read: unreadable data is reported as `corrupt` and left in place.
 *
 * On native, when ciphertext exists, decrypt is deferred until `unlockHousehold`
 * (ACL Keychain get). Cancel must not quarantine or mint.
 */
export async function hydrateHousehold(): Promise<HouseholdLoad> {
  didHydrate = true;
  await persistChain.catch(() => {});
  if (!persistOk && memory) {
    persistChain = persist(memory, key)
      .then(() => {
        persistOk = true;
      })
      .catch(() => {
        persistOk = false;
      });
    sessionUnlocked = true;
    sessionMeta = captureSessionMeta(memory);
    lastLoad = { ok: true, legacyLockedVault: false };
    return lastLoad;
  }
  try {
    // Never read QUARANTINED_VAULT_KEY — that copy is only for forensics after a failed open.
    let raw = await io.kvGet(VAULT_STORAGE_KEY);
    let fromPreviousKey = false;
    if (!raw) {
      raw = await io.kvGet(PREVIOUS_VAULT_KEY);
      fromPreviousKey = Boolean(raw);
    }
    if (raw) {
      if (io.requiresInteractiveUnlock()) {
        // Detect ciphertext only — do not touch the ACL-bound key yet.
        key = null;
        keyId = null;
        memory = null;
        sessionUnlocked = false;
        sessionMeta = null;
        lastLoad = { ok: true, legacyLockedVault: false, pendingUnlock: true };
        return lastLoad;
      }
      return decryptVaultRaw(raw, fromPreviousKey, "Unlock Cuidala");
    }

    // First launch on this build: pick up a plaintext household from the
    // pre-release web build, encrypt it, and remove the plaintext copy.
    const legacy = await readLegacyPlaintext();
    if (legacy) {
      memory = legacy;
      sessionUnlocked = true;
      sessionMeta = captureSessionMeta(legacy);
      await persist(legacy, key);
      window.localStorage.removeItem(LEGACY_PLAINTEXT_KEY);
      lastLoad = { ok: true, legacyLockedVault: false };
      return lastLoad;
    }

    memory = cloneEmpty();
    sessionUnlocked = true;
    sessionMeta = captureSessionMeta(memory);
    lastLoad = { ok: true, legacyLockedVault: legacyLockedVaultPresent() };
    return lastLoad;
  } catch (error) {
    if (isPasscodeRequiredKeyError(error)) {
      lastLoad = { ok: false, reason: "passcode_required" };
      return lastLoad;
    }
    lastLoad = {
      ok: false,
      reason: error instanceof DOMException || error instanceof DeviceKeyError ? "unavailable" : "corrupt",
    };
    return lastLoad;
  }
}

export function updateHousehold(updater: (current: Household) => Household) {
  didHydrate = true;
  if (!sessionUnlocked) return;
  write(updater(memory ?? cloneEmpty()));
}

/** Erases the household, its encryption key, and pending notifications on this device. */
export async function eraseHousehold(): Promise<{ ok: boolean }> {
  didHydrate = true;
  await persistChain.catch(() => {});
  try {
    await io.kvRemove(VAULT_STORAGE_KEY);
    await io.kvRemove(PREVIOUS_VAULT_KEY);
    await io.kvRemove(QUARANTINED_VAULT_KEY);
    await io.deleteDeviceKey();
  } catch {
    return { ok: false };
  }
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LEGACY_PLAINTEXT_KEY);
    window.localStorage.removeItem(LEGACY_VAULT_KEY);
    window.localStorage.removeItem("estrellita-audit-v1");
  }
  key = null;
  keyId = null;
  memory = cloneEmpty();
  sessionUnlocked = true;
  sessionMeta = captureSessionMeta(memory);
  persistOk = true;
  lastLoad = { ok: true, legacyLockedVault: false };
  notifyChange();
  void syncScheduledNotifications(memory).catch(() => {});
  return { ok: true };
}

export function forCleanerSession(household: Household): Household {
  return {
    ...household,
    supplyAutomations: [],
    duties: household.duties.filter((duty) => duty.audience === "cleaner" || duty.audience === "anyone"),
  };
}

export function subscribeHousehold(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(CHANGE_EVENT, onStoreChange);
}

export async function exportHouseholdBackup(passphrase: string): Promise<string> {
  const { sealBackup } = await import("@/lib/backup");
  return sealBackup(JSON.stringify(memory ?? cloneEmpty()), passphrase);
}

async function quarantineUnreadableVault() {
  const current = (await io.kvGet(VAULT_STORAGE_KEY)) ?? (await io.kvGet(PREVIOUS_VAULT_KEY));
  if (!current) return;
  const slot = `${QUARANTINED_VAULT_KEY}.${Date.now()}`;
  await io.kvSet(slot, current);
  // Keep the legacy single slot as the most recent unreadable copy for older restore paths.
  await io.kvSet(QUARANTINED_VAULT_KEY, current);
  await io.kvRemove(VAULT_STORAGE_KEY);
  await io.kvRemove(PREVIOUS_VAULT_KEY);
  // Never delete Keychain items here — quarantine must leave every key account intact.
}

function needsRestoreKey(): boolean {
  // Mint only when the Keychain item is missing or cannot decrypt (key-mismatch).
  // Transient unavailable / interaction_not_allowed must keep the existing key.
  return lastLoad !== null && !lastLoad.ok && lastLoad.reason === "key-mismatch";
}

export async function importHouseholdBackup(
  raw: string,
  passphrase: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { openBackup } = await import("@/lib/backup");
    const plaintext = await openBackup(raw, passphrase);
    const household = {
      ...parseStored(plaintext),
      mode: "owner" as const,
      activeVisitId: null,
      onboarded: true,
    };
    await persistChain.catch(() => {});
    try {
      if (needsRestoreKey()) {
        await quarantineUnreadableVault();
        key = await io.createDeviceKey();
        keyId = getLastMintedKeyId() ?? mintFallbackKeyId();
      }
      memory = household;
      didHydrate = true;
      sessionUnlocked = true;
      sessionMeta = captureSessionMeta(household);
      notifyChange();
      await persist(household, key);
    } catch {
      persistOk = false;
      return {
        ok: false,
        error: "Restored, but it couldn’t be saved to this iPhone. Try again.",
      };
    }
    lastLoad = { ok: true, legacyLockedVault: false };
    persistOk = true;
    persistChain = Promise.resolve();
    void syncScheduledNotifications(household).catch(() => {});
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn’t open that backup.";
    return { ok: false, error: message };
  }
}
