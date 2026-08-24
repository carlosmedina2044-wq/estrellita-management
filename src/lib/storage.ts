import { normalizeAssetType } from "@/lib/asset-catalog";
import { inferAudience, STORAGE_KEY } from "@/lib/constants";
import {
  createVaultSession,
  decryptEnvelope,
  encryptHousehold,
  isVaultEnvelope,
  parseEnvelopeJson,
  sessionFromEnvelope,
  VAULT_STORAGE_KEY,
  type VaultEnvelope,
  type VaultSession,
} from "@/lib/crypto";
import { todayISO } from "@/lib/dates";
import { migrateRoom } from "@/lib/house";
import { appraisalHomeTree, asRoomType, emptyHomeTree, ensureHomeTree, systemRooms } from "@/lib/home-model";
import { DEFAULT_RESTOCK_DIGEST } from "@/lib/digest";
import {
  DEFAULT_ACCOUNT,
  DEFAULT_ATTRIBUTES,
  DEFAULT_LOCK_SETTINGS,
  DEFAULT_WEATHER_STATUS,
  withHouseholdDefaults,
} from "@/lib/household-defaults";
import { clearPasskey } from "@/lib/passkey";
import { hashPin, isBrokenPinHash, isPinHash, pinIsSet, pinsMatch, sanitizeStoredPin } from "@/lib/pin";
import { asArray, asId, isPlainObject, sanitizePinInput, sanitizeText, TEXT_LIMITS } from "@/lib/sanitize";
import { deriveOrderByDate } from "@/lib/supply";
import { pullVaultEnvelope, pushVaultEnvelope } from "@/lib/vault-sync";
import type {
  Account,
  Audience,
  Completion,
  Consumable,
  Duty,
  DutyKind,
  Frequency,
  HomeAsset,
  HomeAttributes,
  HomeFloor,
  HomeLocation,
  HomeRoom,
  Household,
  LifespanUnit,
  LockSettings,
  NodeType,
  PlaybookDecision,
  SupplyAutomation,
  Visit,
  WeatherFire,
} from "@/lib/types";

export const EMPTY_HOUSEHOLD: Household = withHouseholdDefaults({
  version: 7,
  householdName: "Estrellita",
  ownerName: "",
  cleanerName: "Cleaner",
  ownerPin: "",
  onboarded: false,
  mode: "owner",
  activeVisitId: null,
  ...emptyHomeTree("Estrellita"),
  duties: [],
  completions: [],
  visits: [],
  supplyAutomations: [],
});

export type Gate = "empty" | "ready" | "locked" | "needs-wrap";

export type HouseholdLoad =
  | { ok: true; gate: Gate }
  | { ok: false; reason: "corrupt" | "unavailable" };

const FREQUENCIES: Frequency[] = ["once", "daily", "weekly", "monthly", "quarterly", "yearly"];
const LIFESPAN_UNITS: LifespanUnit[] = ["days", "months", "years"];
const AUDIENCES: Audience[] = ["me", "cleaner", "anyone"];
const EFFORTS = ["small", "medium", "large"] as const;
const PRIORITIES = ["low", "medium", "high"] as const;

let memory: Household | null = null;
let didHydrate = false;
let lastLoadError: HouseholdLoad | null = null;
let gate: Gate = "empty";
let session: VaultSession | null = null;
let persistChain: Promise<void> = Promise.resolve();

function cloneEmpty(): Household {
  return withHouseholdDefaults({
    ...EMPTY_HOUSEHOLD,
    ...emptyHomeTree("Estrellita"),
    duties: [],
    completions: [],
    visits: [],
    supplyAutomations: [],
    floors: emptyHomeTree().floors.map((floor) => ({ ...floor })),
    rooms: emptyHomeTree().rooms.map((room) => ({ ...room })),
    assets: [],
    consumables: [],
    playbookDecisions: [],
    weatherFires: [],
  });
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function asInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function asIsoDate(value: unknown, fallback: string | null = null): string | null {
  if (typeof value !== "string") return fallback;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function asIsoDateTime(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

function migrateDuty(raw: unknown): Duty | null {
  if (!isPlainObject(raw)) return null;
  const id = asId(raw.id);
  if (!id) return null;
  const title = sanitizeText(raw.title, TEXT_LIMITS.title);
  if (!title) return null;
  const room = migrateRoom(typeof raw.room === "string" ? raw.room : "entry");
  const nodeType = asEnum(raw.nodeType, ["home", "floor", "room", "asset"] as const, "room");
  const nodeId =
    typeof raw.nodeId === "string" && /^[A-Za-z0-9_-]{2,64}$/.test(raw.nodeId) ? raw.nodeId : room;
  const frequency = asEnum(raw.frequency, FREQUENCIES, "weekly");
  return {
    id,
    title,
    notes: sanitizeText(raw.notes, TEXT_LIMITS.notes),
    room,
    nodeId,
    nodeType,
    audience: asEnum(raw.audience, AUDIENCES, inferAudience(title, room)),
    effort: asEnum(raw.effort, EFFORTS, "medium"),
    frequency,
    kind: raw.kind === "replacement" ? "replacement" : "chore",
    weekday: asInt(raw.weekday, 0, 0, 6),
    monthDay: asInt(raw.monthDay, 1, 1, 31),
    dueDate: asIsoDate(raw.dueDate),
    priority: asEnum(raw.priority, PRIORITIES, "medium"),
    createdAt: asIsoDateTime(raw.createdAt, new Date().toISOString()),
    archived: raw.archived === true,
    estimatedCost: typeof raw.estimatedCost === "number" ? raw.estimatedCost : undefined,
    isDiy: typeof raw.isDiy === "boolean" ? raw.isDiy : undefined,
    laborCostEstimate: typeof raw.laborCostEstimate === "number" ? raw.laborCostEstimate : undefined,
    estimatedMinutes: typeof raw.estimatedMinutes === "number" ? raw.estimatedMinutes : undefined,
    origin:
      raw.origin === "starter" || raw.origin === "playbook" || raw.origin === "weather" || raw.origin === "user"
        ? raw.origin
        : undefined,
    playbookId: typeof raw.playbookId === "string" ? raw.playbookId : undefined,
    weatherTriggerId: typeof raw.weatherTriggerId === "string" ? raw.weatherTriggerId : undefined,
    buyLocally: raw.buyLocally === true ? true : undefined,
  };
}

function migrateCompletion(raw: unknown): Completion | null {
  if (!isPlainObject(raw)) return null;
  const id = asId(raw.id);
  const dutyId = asId(raw.dutyId);
  if (!id || !dutyId) return null;
  return {
    id,
    dutyId,
    actor: raw.actor === "cleaner" ? "cleaner" : "me",
    visitId: asId(raw.visitId),
    completedAt: asIsoDateTime(raw.completedAt, new Date().toISOString()),
  };
}

function migrateVisit(raw: unknown): Visit | null {
  if (!isPlainObject(raw)) return null;
  const id = asId(raw.id);
  if (!id) return null;
  return {
    id,
    cleanerName: sanitizeText(raw.cleanerName, TEXT_LIMITS.name) || "Cleaner",
    startedAt: asIsoDateTime(raw.startedAt, new Date().toISOString()),
    endedAt: typeof raw.endedAt === "string" ? asIsoDateTime(raw.endedAt, "") || null : null,
  };
}

function migrateAutomation(raw: unknown, duties: Duty[]): SupplyAutomation | null {
  if (!isPlainObject(raw)) return null;
  const id = asId(raw.id);
  const duty = duties.find((item) => item.id === raw.dutyId);
  const dutyId = asId(raw.dutyId) ?? duty?.id;
  if (!id || !dutyId) return null;
  const room = (typeof raw.room === "string" ? migrateRoom(raw.room) : duty?.room) ?? "living-room";
  const nodeType = asEnum(raw.nodeType, ["home", "floor", "room", "asset"] as const, duty?.nodeType ?? "room");
  const nodeId =
    typeof raw.nodeId === "string" && /^[A-Za-z0-9_-]{2,64}$/.test(raw.nodeId)
      ? raw.nodeId
      : (duty?.nodeId ?? room);
  const installedAt = asIsoDate(raw.installedAt, todayISO()) ?? todayISO();
  const lifespanUnit = asEnum(raw.lifespanUnit, LIFESPAN_UNITS, "months");
  const lifespanValue = asInt(raw.lifespanValue, 6, 1, 120);
  const derived = deriveOrderByDate(installedAt, lifespanValue, lifespanUnit);
  const orderByDate = asIsoDate(raw.orderByDate, asIsoDate(raw.nextOrderDate, derived)) ?? derived;
  const linkedDutyIds = [
    dutyId,
    ...asArray(raw.linkedDutyIds).filter((item): item is string => typeof item === "string" && Boolean(asId(item))),
  ].filter((item, index, all) => all.indexOf(item) === index);
  const retailerUrl =
    sanitizeText(raw.retailerUrl, TEXT_LIMITS.url) || sanitizeText(raw.amazonProductUrl, TEXT_LIMITS.url);
  const quantity = asInt(raw.qtyPerOrder ?? raw.quantity, 1, 1, 99);
  const ordered = raw.state === "ordered" || raw.orderInFlight === true;
  return {
    id,
    dutyId,
    linkedDutyIds,
    room,
    nodeId,
    nodeType,
    itemName: sanitizeText(raw.itemName, TEXT_LIMITS.title) || duty?.title || "Supply",
    sku: sanitizeText(raw.sku, TEXT_LIMITS.sku),
    asin: sanitizeText(raw.asin, TEXT_LIMITS.asin),
    amazonProductUrl: sanitizeText(raw.amazonProductUrl, TEXT_LIMITS.url) || retailerUrl,
    amazonOneClick: false,
    amazonNotes: sanitizeText(raw.amazonNotes, TEXT_LIMITS.notes),
    retailerUrl,
    quantity,
    onHand: asInt(raw.onHand, 0, 0, 999),
    qtyPerOrder: quantity,
    leadTimeDays: asInt(raw.leadTimeDays, 14, 0, 90),
    installedAt,
    lifespanValue,
    lifespanUnit,
    orderByDate,
    nextOrderDate: asIsoDate(raw.nextOrderDate, orderByDate) ?? orderByDate,
    orderInFlight: ordered,
    state: ordered ? "ordered" : "stocked",
    expectedArrivalDate: asIsoDate(raw.expectedArrivalDate),
    createdAt: asIsoDateTime(raw.createdAt, new Date().toISOString()),
    unitCost: typeof raw.unitCost === "number" ? raw.unitCost : undefined,
    lastPaidPrice: typeof raw.lastPaidPrice === "number" ? raw.lastPaidPrice : undefined,
  };
}

function asSlugId(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/[^\w-]/g, "").slice(0, 64);
  return cleaned.length >= 2 ? cleaned : fallback;
}

function migrateFloor(raw: unknown, index: number): HomeFloor | null {
  if (!isPlainObject(raw)) return null;
  const id = asSlugId(raw.id, `floor-${index}`);
  const name = sanitizeText(raw.name, TEXT_LIMITS.name);
  if (!name) return null;
  return { id, name, sortOrder: asInt(raw.sortOrder, index, 0, 99) };
}

function migrateHomeRoom(raw: unknown, index: number): HomeRoom | null {
  if (!isPlainObject(raw)) return null;
  const id = asSlugId(raw.id, `room-${index}`);
  const name = sanitizeText(raw.name, TEXT_LIMITS.name);
  if (!name) return null;
  const system =
    raw.system === "whole-home" || raw.system === "exterior" ? raw.system : undefined;
  return {
    id,
    floorId: typeof raw.floorId === "string" ? asSlugId(raw.floorId, raw.floorId) : null,
    name,
    type: asRoomType(typeof raw.type === "string" ? raw.type : "other"),
    sortOrder: asInt(raw.sortOrder, index, 0, 999),
    system,
    tileW: typeof raw.tileW === "number" ? raw.tileW : undefined,
    tileH: typeof raw.tileH === "number" ? raw.tileH : undefined,
    tileX: typeof raw.tileX === "number" ? raw.tileX : undefined,
    tileY: typeof raw.tileY === "number" ? raw.tileY : undefined,
  };
}

function migrateAsset(raw: unknown): HomeAsset | null {
  if (!isPlainObject(raw)) return null;
  const id = asId(raw.id);
  const roomId = typeof raw.roomId === "string" ? asSlugId(raw.roomId, "") : "";
  const name = sanitizeText(raw.name, TEXT_LIMITS.name);
  if (!id || !roomId || !name) return null;
  const type = normalizeAssetType(typeof raw.type === "string" ? raw.type : "other");
  const condition =
    raw.condition === "good" || raw.condition === "fair" || raw.condition === "poor" ? raw.condition : undefined;
  return {
    id,
    roomId,
    name,
    type,
    installDate: asIsoDate(raw.installDate) ?? undefined,
    purchasePrice: typeof raw.purchasePrice === "number" ? raw.purchasePrice : undefined,
    expectedLifeYears: typeof raw.expectedLifeYears === "number" ? raw.expectedLifeYears : undefined,
    replacementCostEstimate:
      typeof raw.replacementCostEstimate === "number" ? raw.replacementCostEstimate : undefined,
    condition,
    notes: sanitizeText(raw.notes, TEXT_LIMITS.notes) || undefined,
  };
}

function migrateConsumable(raw: unknown): Consumable | null {
  if (!isPlainObject(raw)) return null;
  const id = asId(raw.id);
  const name = sanitizeText(raw.name, TEXT_LIMITS.title);
  const nodeId = typeof raw.nodeId === "string" ? raw.nodeId : "";
  if (!id || !name || !nodeId) return null;
  return {
    id,
    assetId: typeof raw.assetId === "string" ? raw.assetId : undefined,
    nodeId,
    nodeType: asEnum(raw.nodeType, ["home", "floor", "room", "asset"] as const, "asset"),
    name,
    intervalDays: asInt(raw.intervalDays, 90, 1, 3650),
    unitCost: typeof raw.unitCost === "number" ? raw.unitCost : undefined,
    lastPaidPrice: typeof raw.lastPaidPrice === "number" ? raw.lastPaidPrice : undefined,
    lastReplacedAt: asIsoDate(raw.lastReplacedAt) ?? undefined,
  };
}

function migrateLocation(raw: unknown): HomeLocation {
  if (!isPlainObject(raw)) return {};
  const climateZone =
    raw.climateZone === "hot-arid" ||
    raw.climateZone === "cold" ||
    raw.climateZone === "humid-subtropical" ||
    raw.climateZone === "marine" ||
    raw.climateZone === "mixed"
      ? raw.climateZone
      : undefined;
  return {
    lat: typeof raw.lat === "number" ? raw.lat : undefined,
    lng: typeof raw.lng === "number" ? raw.lng : undefined,
    postalCode: typeof raw.postalCode === "string" ? sanitizeText(raw.postalCode, 16) : undefined,
    climateZone,
  };
}

function migrateAttributes(raw: unknown): HomeAttributes {
  if (!isPlainObject(raw)) return { ...DEFAULT_ATTRIBUTES };
  return {
    ...DEFAULT_ATTRIBUTES,
    hasGarage: raw.hasGarage === true,
    hasYard: raw.hasYard === true,
    hasPool: raw.hasPool === true,
    hasIrrigation: raw.hasIrrigation === true,
    hasFireplace: raw.hasFireplace === true,
    hasBasement: raw.hasBasement === true,
    hasAttic: raw.hasAttic === true,
    hasLaundry: raw.hasLaundry === true,
    hasHomeOffice: raw.hasHomeOffice === true,
    hasGutters: raw.hasGutters === true,
    hasSepticSystem: raw.hasSepticSystem === true,
    hasWell: raw.hasWell === true,
    hasSolar: raw.hasSolar === true,
    hasEvaporativeCooler: raw.hasEvaporativeCooler === true,
    roofType: typeof raw.roofType === "string" ? sanitizeText(raw.roofType, 40) : undefined,
  };
}

function migrateAccount(raw: unknown): Account {
  if (!isPlainObject(raw)) return { ...DEFAULT_ACCOUNT };
  const providers = asArray(raw.providers).filter(
    (item): item is Account["providers"][number] =>
      item === "apple" || item === "passkey" || item === "magic-link",
  );
  return {
    appleUserId: typeof raw.appleUserId === "string" ? raw.appleUserId : undefined,
    email: typeof raw.email === "string" ? sanitizeText(raw.email, 120) : undefined,
    emailHidden: raw.emailHidden === true,
    providers,
    passkeyPromptedAt: typeof raw.passkeyPromptedAt === "string" ? raw.passkeyPromptedAt : undefined,
  };
}

function migrateLockSettings(raw: unknown): LockSettings {
  if (!isPlainObject(raw)) return { ...DEFAULT_LOCK_SETTINGS };
  return {
    requireFaceId: raw.requireFaceId !== false,
    lockAfter: raw.lockAfter === "immediate" || raw.lockAfter === "15min" ? raw.lockAfter : "2min",
  };
}

function migratePlaybookDecision(raw: unknown): PlaybookDecision | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.playbookId !== "string") return null;
  return {
    playbookId: raw.playbookId,
    year: asInt(raw.year, new Date().getFullYear(), 2020, 2100),
    declinedTaskKeys: asArray(raw.declinedTaskKeys).filter((item): item is string => typeof item === "string"),
    disabled: raw.disabled === true,
  };
}

function migrateWeatherFire(raw: unknown): WeatherFire | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.triggerId !== "string" || typeof raw.firedAt !== "string") return null;
  return { triggerId: raw.triggerId, firedAt: raw.firedAt };
}

function migrate(raw: Record<string, unknown>): Household {
  const duties = asArray(raw.duties)
    .map(migrateDuty)
    .filter((item): item is Duty => Boolean(item));

  const completions = asArray(raw.completions)
    .map(migrateCompletion)
    .filter((item): item is Completion => Boolean(item));

  const visits = asArray(raw.visits)
    .map(migrateVisit)
    .filter((item): item is Visit => Boolean(item));

  const supplyAutomations = asArray(raw.supplyAutomations ?? raw.reorderRules)
    .map((item) => migrateAutomation(item, duties))
    .filter((item): item is SupplyAutomation => Boolean(item))
    .filter((item) => duties.some((duty) => duty.id === item.dutyId));

  const withKind = duties.map((duty) =>
    supplyAutomations.some((item) => item.dutyId === duty.id)
      ? { ...duty, kind: "replacement" as DutyKind }
      : duty,
  );

  const people = asArray(raw.people);
  const firstPerson = isPlainObject(people[0]) ? sanitizeText(people[0].name, TEXT_LIMITS.name) : "";
  const floors = asArray(raw.floors)
    .map(migrateFloor)
    .filter((item): item is HomeFloor => Boolean(item));
  const rooms = asArray(raw.rooms)
    .map(migrateHomeRoom)
    .filter((item): item is HomeRoom => Boolean(item));
  const assets = asArray(raw.assets)
    .map(migrateAsset)
    .filter((item): item is HomeAsset => Boolean(item));

  const householdName = sanitizeText(raw.householdName, TEXT_LIMITS.name) || "Estrellita";
  const seeded = floors.length > 0 && rooms.length > 0
    ? {
        homeId: asSlugId(raw.homeId, "home"),
        floors,
        rooms: rooms.some((room) => room.system) ? rooms : [...systemRooms(), ...rooms],
        assets,
      }
    : withKind.length > 0 || raw.onboarded === true
      ? appraisalHomeTree()
      : emptyHomeTree(householdName);

  const consumables = asArray(raw.consumables)
    .map(migrateConsumable)
    .filter((item): item is Consumable => Boolean(item));
  const playbookDecisions = asArray(raw.playbookDecisions)
    .map(migratePlaybookDecision)
    .filter((item): item is PlaybookDecision => Boolean(item));
  const weatherFires = asArray(raw.weatherFires)
    .map(migrateWeatherFire)
    .filter((item): item is WeatherFire => Boolean(item));
  const homeType =
    raw.homeType === "townhouse" ||
    raw.homeType === "condo" ||
    raw.homeType === "apartment" ||
    raw.homeType === "other"
      ? raw.homeType
      : "house";

  return ensureHomeTree({
    version: 7,
    householdName,
    ownerName: sanitizeText(raw.ownerName, TEXT_LIMITS.name) || firstPerson || "Me",
    cleanerName: sanitizeText(raw.cleanerName, TEXT_LIMITS.name) || "Cleaner",
    ownerPin: sanitizeStoredPin(raw.ownerPin),
    onboarded: raw.onboarded === true,
    mode: raw.mode === "cleaner" ? "cleaner" : "owner",
    activeVisitId: asId(raw.activeVisitId),
    homeId: seeded.homeId,
    homeType,
    location: migrateLocation(raw.location),
    attributes: migrateAttributes(raw.attributes),
    floors: seeded.floors,
    rooms: seeded.rooms,
    assets: seeded.assets,
    consumables,
    duties: withKind,
    completions,
    visits,
    supplyAutomations,
    playbookDecisions,
    weatherFires,
    weatherStatus: isPlainObject(raw.weatherStatus)
      ? {
          lastSuccessAt: typeof raw.weatherStatus.lastSuccessAt === "string" ? raw.weatherStatus.lastSuccessAt : null,
          lastError: typeof raw.weatherStatus.lastError === "string" ? raw.weatherStatus.lastError : null,
        }
      : { ...DEFAULT_WEATHER_STATUS },
    account: migrateAccount(raw.account),
    lockSettings: migrateLockSettings(raw.lockSettings),
    householdRole: raw.householdRole === "adult" || raw.householdRole === "child" ? raw.householdRole : "owner",
    restockDigest: isPlainObject(raw.restockDigest)
      ? {
          enabled: raw.restockDigest.enabled !== false,
          weekday: asInt(raw.restockDigest.weekday, 0, 0, 6),
          hour: asInt(raw.restockDigest.hour, 9, 0, 23),
          lastSentOn:
            typeof raw.restockDigest.lastSentOn === "string" ? asIsoDate(raw.restockDigest.lastSentOn) : null,
          permissionAsked: raw.restockDigest.permissionAsked === true,
        }
      : { ...DEFAULT_RESTOCK_DIGEST },
  });
}

function parseStored(raw: string): Household {
  const parsed: unknown = JSON.parse(raw);
  if (!isPlainObject(parsed)) {
    throw new Error("Household data is not an object");
  }
  if (isVaultEnvelope(parsed)) {
    throw new Error("Encrypted vault cannot be read as plaintext");
  }
  return migrate(parsed);
}

function readLocalEnvelope(): VaultEnvelope | null {
  const vaultRaw = window.localStorage.getItem(VAULT_STORAGE_KEY);
  if (vaultRaw) return parseEnvelopeJson(vaultRaw);
  const legacy = window.localStorage.getItem(STORAGE_KEY);
  return legacy ? parseEnvelopeJson(legacy) : null;
}

function remember(next: Household, nextGate: Gate, load: HouseholdLoad) {
  memory = next;
  gate = nextGate;
  lastLoadError = load;
  window.dispatchEvent(new Event("estrellita-change"));
}

async function persistEncrypted(next: Household) {
  if (!session) return;
  const envelope = await encryptHousehold(session, JSON.stringify(next));
  window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(envelope));
  window.localStorage.removeItem(STORAGE_KEY);
  try {
    await pushVaultEnvelope(session.authToken, envelope);
  } catch {
    // Local ciphertext is the source of truth if the vault is offline.
  }
}

// Temporary: owner PIN is disabled — persist plaintext on this device instead of wrapping.
function persistPlaintext(next: Household) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, ownerPin: "" }));
  window.localStorage.removeItem(VAULT_STORAGE_KEY);
}

async function persistHousehold(next: Household) {
  if (session) {
    await persistEncrypted(next);
    return;
  }
  persistPlaintext(next);
}

function write(next: Household) {
  memory = next;
  gate = next.onboarded ? "ready" : "empty";
  window.dispatchEvent(new Event("estrellita-change"));
  persistChain = persistChain.then(() => persistHousehold(next));
}

export function getHousehold(): Household {
  if (!didHydrate) return EMPTY_HOUSEHOLD;
  return memory ?? EMPTY_HOUSEHOLD;
}

export function getGate(): Gate {
  return gate;
}

export function getVaultId(): string | null {
  return session?.vaultId ?? readLocalEnvelope()?.vaultId ?? null;
}

export function getHouseholdLoadError(): HouseholdLoad | null {
  return lastLoadError;
}

function openWithoutPin(next: Household, nextGate: Gate): HouseholdLoad {
  memory = { ...next, ownerPin: "" };
  gate = nextGate;
  lastLoadError = { ok: true, gate };
  return lastLoadError;
}

export async function hydrateHouseholdFromStorage(): Promise<HouseholdLoad> {
  didHydrate = true;
  memory = null;
  session = null;
  lastLoadError = null;
  try {
    const envelope = readLocalEnvelope();
    if (envelope) {
      // Temporary: PIN unlock is off. Ciphertext cannot be opened without the
      // forgotten PIN — reset this device's local vault and continue unlocked.
      try {
        window.localStorage.removeItem(VAULT_STORAGE_KEY);
        window.localStorage.removeItem(STORAGE_KEY);
        clearPasskey();
      } catch {
        // Private mode / quota — still continue with an empty household.
      }
      return openWithoutPin(cloneEmpty(), "empty");
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return openWithoutPin(cloneEmpty(), "empty");
    }

    const household = parseStored(raw);
    return openWithoutPin(household, household.onboarded ? "ready" : "empty");
  } catch (error) {
    if (error instanceof DOMException) {
      lastLoadError = { ok: false, reason: "unavailable" };
      return lastLoadError;
    }
    lastLoadError = { ok: false, reason: "corrupt" };
    return lastLoadError;
  }
}

export function updateHousehold(updater: (current: Household) => Household) {
  didHydrate = true;
  write(updater(memory ?? cloneEmpty()));
}

async function pinOpensCurrentVault(pin: string): Promise<boolean> {
  if (!session) return false;
  const local = readLocalEnvelope();
  if (!local) return false;
  try {
    const candidate = await sessionFromEnvelope(pin, local);
    return candidate.authToken === session.authToken;
  } catch {
    return false;
  }
}

async function repairOwnerPinHash(pin: string) {
  if (!memory || isPinHash(memory.ownerPin)) return;
  const ownerPin = await hashPin(pin);
  if (memory.ownerPin === ownerPin) return;
  const next = { ...memory, ownerPin };
  remember(next, gate, lastLoadError ?? { ok: true, gate });
  persistChain = persistChain.then(() => persistEncrypted(next));
}

/**
 * Same check unlock uses: the typed PIN must open this vault.
 * Intact hashes compare quickly; a truncated leftover hash falls back to the
 * session derived at unlock.
 */
export async function verifyOwnerPin(secret: string): Promise<boolean> {
  const pin = sanitizePinInput(secret);
  if (pin.length < 4) return false;
  const stored = memory?.ownerPin ?? "";
  if (isPinHash(stored) || (pinIsSet(stored) && !isBrokenPinHash(stored))) {
    return pinsMatch(pin, stored);
  }
  if (await pinOpensCurrentVault(pin)) {
    await repairOwnerPinHash(pin);
    return true;
  }
  return pinsMatch(pin, stored);
}

export async function unlockHousehold(secret: string): Promise<boolean> {
  const pin = sanitizePinInput(secret);
  if (!pin) return false;
  const local = readLocalEnvelope();
  if (!local) return false;
  try {
    let active = await sessionFromEnvelope(pin, local);
    let envelope = local;
    let plaintext = await decryptEnvelope(active, local);
    const remote = await pullVaultEnvelope(local.vaultId).catch(() => null);
    if (remote && remote.updatedAt > local.updatedAt) {
      try {
        const remoteSession = await sessionFromEnvelope(pin, remote);
        plaintext = await decryptEnvelope(remoteSession, remote);
        active = remoteSession;
        envelope = remote;
      } catch {
        // Keep the local ciphertext if the remote blob does not match this PIN.
      }
    }
    session = active;
    window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(envelope));
    const household = parseStored(plaintext);
    const repaired = !isPinHash(household.ownerPin);
    if (repaired) household.ownerPin = await hashPin(pin);
    remember(household, "ready", { ok: true, gate: "ready" });
    if (repaired) persistChain = persistChain.then(() => persistEncrypted(household));
    return true;
  } catch {
    return false;
  }
}

export async function wrapHousehold(secret: string): Promise<boolean> {
  const pin = sanitizePinInput(secret);
  if (pin.length < 4) return false;
  const current = memory ?? cloneEmpty();
  if (
    pinIsSet(current.ownerPin) &&
    !isBrokenPinHash(current.ownerPin) &&
    !(await pinsMatch(pin, current.ownerPin))
  ) {
    return false;
  }
  session = await createVaultSession(pin);
  const next = { ...current, ownerPin: await hashPin(pin), onboarded: true };
  remember(next, "ready", { ok: true, gate: "ready" });
  await persistEncrypted(next);
  return true;
}

export async function joinRemoteHousehold(vaultId: string, secret: string): Promise<boolean> {
  const pin = sanitizePinInput(secret);
  if (!pin) return false;
  const envelope = await pullVaultEnvelope(vaultId.trim());
  if (!envelope) return false;
  try {
    const active = await sessionFromEnvelope(pin, envelope);
    const plaintext = await decryptEnvelope(active, envelope);
    session = active;
    window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(envelope));
    window.localStorage.removeItem(STORAGE_KEY);
    const household = parseStored(plaintext);
    const repaired = !isPinHash(household.ownerPin);
    if (repaired) household.ownerPin = await hashPin(pin);
    remember(household, "ready", { ok: true, gate: "ready" });
    if (repaired) persistChain = persistChain.then(() => persistEncrypted(household));
    return true;
  } catch {
    return false;
  }
}

export async function rotateVaultSecret(secret: string): Promise<boolean> {
  const pin = sanitizePinInput(secret);
  if (pin.length < 4 || !memory) return false;
  const vaultId = session?.vaultId ?? crypto.randomUUID();
  session = await createVaultSession(pin, { vaultId });
  const next = { ...memory, ownerPin: await hashPin(pin) };
  clearPasskey();
  remember(next, "ready", { ok: true, gate: "ready" });
  await persistEncrypted(next);
  return true;
}

export function resetHousehold() {
  didHydrate = true;
  session = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(VAULT_STORAGE_KEY);
    clearPasskey();
  } catch {
    // Private mode / quota — still reset in-memory state.
  }
  remember(cloneEmpty(), "empty", { ok: true, gate: "empty" });
}

export function forCleanerSession(household: Household): Household {
  return {
    ...household,
    ownerPin: "",
    supplyAutomations: [],
    duties: household.duties.filter((duty) => duty.audience === "cleaner" || duty.audience === "anyone"),
  };
}

export function subscribeHousehold(onStoreChange: () => void) {
  const onLocal = () => onStoreChange();
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== VAULT_STORAGE_KEY) return;
    if (session && event.newValue) {
      const envelope = parseEnvelopeJson(event.newValue);
      if (envelope) {
        void decryptEnvelope(session, envelope)
          .then((plaintext) => {
            memory = parseStored(plaintext);
            onStoreChange();
          })
          .catch(() => {
            session = null;
            gate = "empty";
            memory = null;
            onStoreChange();
          });
        return;
      }
    }
    memory = null;
    onStoreChange();
  };

  window.addEventListener("estrellita-change", onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("estrellita-change", onLocal);
    window.removeEventListener("storage", onStorage);
  };
}
