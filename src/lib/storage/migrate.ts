import { normalizeAssetType } from "@/lib/asset-catalog";
import { inferAudience } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import { migrateRoom } from "@/lib/house";
import { asRoomType, emptyHomeTree, ensureHomeTree, systemRooms } from "@/lib/home-model";
import { DEFAULT_RESTOCK_DIGEST } from "@/lib/digest";
import {
  DEFAULT_ATTRIBUTES,
  DEFAULT_LOCK_SETTINGS,
  DEFAULT_WEATHER_STATUS,
  withHouseholdDefaults,
} from "@/lib/household-defaults";
import { asArray, asId, isPlainObject, sanitizeText, TEXT_LIMITS } from "@/lib/sanitize";
import { rememberRetailerLink, normalizeSavedRetailerUrl } from "@/lib/retailer";
import { deriveOrderByDate } from "@/lib/supply";
import {
  RETAILER_IDS,
  type Audience,
  type Completion,
  type Consumable,
  type Duty,
  type DutyKind,
  type Frequency,
  type HomeAsset,
  type HomeAttributes,
  type HomeFloor,
  type HomeLocation,
  type HomeRoom,
  type Household,
  type LaborKind,
  type LifespanUnit,
  type LockSettings,
  type MaintenanceFund,
  type PlaybookDecision,
  type Purchase,
  type PurchaseKind,
  type RetailerId,
  type SavedRetailerLink,
  type SupplyAutomation,
  type Tenure,
  type Visit,
  type WeatherFire,
} from "@/lib/types";

export const EMPTY_HOUSEHOLD: Household = withHouseholdDefaults({
  version: 8,
  householdName: "Home",
  ownerName: "",
  cleanerName: "Cleaner",
  onboarded: false,
  mode: "owner",
  activeVisitId: null,
  ...emptyHomeTree(),
  duties: [],
  completions: [],
  visits: [],
  supplyAutomations: [],
});

const FREQUENCIES: Frequency[] = ["once", "daily", "weekly", "monthly", "quarterly", "yearly"];
const LIFESPAN_UNITS: LifespanUnit[] = ["days", "months", "years"];
const AUDIENCES: Audience[] = ["me", "cleaner", "anyone"];
const EFFORTS = ["small", "medium", "large"] as const;
const PRIORITIES = ["low", "medium", "high"] as const;

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
    audience: asEnum(raw.audience, AUDIENCES, inferAudience(title)),
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

function asActualCost(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100_000) return undefined;
  return Math.round(value * 100) / 100;
}

function asFundAmount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 5_000_000) return undefined;
  return Math.round(value * 100) / 100;
}

function migrateCompletion(raw: unknown): Completion | null {
  if (!isPlainObject(raw)) return null;
  const id = asId(raw.id);
  const dutyId = asId(raw.dutyId);
  if (!id || !dutyId) return null;
  const actualCost = asActualCost(raw.actualCost);
  return {
    id,
    dutyId,
    actor: raw.actor === "cleaner" ? "cleaner" : "me",
    visitId: asId(raw.visitId),
    completedAt: asIsoDateTime(raw.completedAt, new Date().toISOString()),
    actualCost,
    costSkipped: raw.costSkipped === true ? true : undefined,
  };
}

function migratePurchase(raw: unknown): Purchase | null {
  if (!isPlainObject(raw)) return null;
  const id = asId(raw.id);
  const actualCost = asActualCost(raw.actualCost);
  const label = sanitizeText(raw.label, TEXT_LIMITS.title);
  if (!id || actualCost == null || !label) return null;
  const kind: PurchaseKind =
    raw.kind === "consumable" || raw.kind === "task" || raw.kind === "replacement" ? raw.kind : "task";
  const laborKind: LaborKind | undefined = raw.laborKind === "diy" || raw.laborKind === "hired" ? raw.laborKind : undefined;
  const plannedCost = asActualCost(raw.plannedCost);
  return {
    id,
    completedAt: asIsoDateTime(raw.completedAt, new Date().toISOString()),
    actualCost,
    label,
    kind,
    dutyId: asId(raw.dutyId) ?? undefined,
    assetId: asId(raw.assetId) ?? undefined,
    automationId: asId(raw.automationId) ?? undefined,
    laborKind,
    notes: sanitizeText(raw.notes, TEXT_LIMITS.notes) || undefined,
    plannedCost,
  };
}

function migrateMaintenanceFund(raw: unknown): MaintenanceFund | undefined {
  if (!isPlainObject(raw)) return undefined;
  const balance = asFundAmount(raw.balance);
  if (balance == null) return undefined;
  const contribution = asActualCost(raw.monthlyContribution);
  return {
    balance,
    updatedAt: asIsoDateTime(raw.updatedAt, new Date().toISOString()),
    monthlyContribution: contribution,
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
  const installedAt = asIsoDate(raw.installedAt) ?? "";
  const lifespanUnit = asEnum(raw.lifespanUnit, LIFESPAN_UNITS, "months");
  const lifespanValue = asInt(raw.lifespanValue, 6, 1, 120);
  const derived = installedAt
    ? deriveOrderByDate(installedAt, lifespanValue, lifespanUnit)
    : (asIsoDate(raw.orderByDate, asIsoDate(raw.nextOrderDate)) ?? todayISO());
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
    sizeSpec: sanitizeText(raw.sizeSpec, TEXT_LIMITS.sizeSpec) || undefined,
    retailerUrl,
    quantity,
    onHand: asInt(raw.onHand, 0, 0, 999),
    qtyPerOrder: quantity,
    reorderAt: asInt(raw.reorderAt, 0, 0, 99),
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
    lastPaidAt: asIsoDate(raw.lastPaidAt) ?? undefined,
    preferredRetailer: asPreferredRetailer(raw.preferredRetailer),
    orderedAt: asIsoDate(raw.orderedAt) ?? undefined,
    orderedQty: raw.orderedQty !== undefined ? asInt(raw.orderedQty, 1, 1, 99) : undefined,
    observedLeadTimeDays:
      raw.observedLeadTimeDays !== undefined ? asInt(raw.observedLeadTimeDays, 0, 0, 90) : undefined,
  };
}

function asPreferredRetailer(value: unknown): RetailerId | string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = sanitizeText(value, TEXT_LIMITS.url);
  if (!trimmed) return undefined;
  return (RETAILER_IDS as readonly string[]).includes(trimmed) ? (trimmed as RetailerId) : trimmed;
}

function migratePreferredRetailers(raw: unknown): RetailerId[] {
  const seen = new Set<RetailerId>();
  const next: RetailerId[] = [];
  for (const item of asArray(raw)) {
    if (typeof item !== "string") continue;
    if (!(RETAILER_IDS as readonly string[]).includes(item)) continue;
    const id = item as RetailerId;
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
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
    warrantyUntil: asIsoDate(raw.warrantyUntil) ?? undefined,
    purchasePrice: typeof raw.purchasePrice === "number" ? raw.purchasePrice : undefined,
    expectedLifeYears: typeof raw.expectedLifeYears === "number" ? raw.expectedLifeYears : undefined,
    replacementCostEstimate:
      typeof raw.replacementCostEstimate === "number" ? raw.replacementCostEstimate : undefined,
    condition,
    notes: sanitizeText(raw.notes, TEXT_LIMITS.notes) || undefined,
    deferredUntil: asIsoDate(raw.deferredUntil) ?? undefined,
    deferReason: sanitizeText(raw.deferReason, TEXT_LIMITS.notes) || undefined,
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
    sizeSpec: sanitizeText(raw.sizeSpec, TEXT_LIMITS.sizeSpec) || undefined,
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
    placeName: typeof raw.placeName === "string" ? sanitizeText(raw.placeName, TEXT_LIMITS.name) || undefined : undefined,
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

function migrateSavedRetailerLink(raw: unknown): SavedRetailerLink | null {
  if (typeof raw === "string") {
    const url = normalizeSavedRetailerUrl(raw);
    if (!url) return null;
    return { url, lastUsedAt: new Date(0).toISOString(), useCount: 1 };
  }
  if (!isPlainObject(raw)) return null;
  const url = normalizeSavedRetailerUrl(typeof raw.url === "string" ? raw.url : "");
  if (!url) return null;
  return {
    url,
    lastUsedAt: asIsoDateTime(raw.lastUsedAt, new Date(0).toISOString()),
    useCount: asInt(raw.useCount, 1, 1, 9999),
  };
}

export function migrateHousehold(raw: Record<string, unknown>): Household {
  const duties = asArray(raw.duties)
    .map(migrateDuty)
    .filter((item): item is Duty => Boolean(item));

  const completions = asArray(raw.completions)
    .map(migrateCompletion)
    .filter((item): item is Completion => Boolean(item));

  const purchases = asArray(raw.purchases)
    .map(migratePurchase)
    .filter((item): item is Purchase => Boolean(item));

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

  const householdName = sanitizeText(raw.householdName, TEXT_LIMITS.name) || "Home";
  const seeded = floors.length > 0 && rooms.length > 0
    ? {
        homeId: asSlugId(raw.homeId, "home"),
        floors,
        rooms: rooms.some((room) => room.system) ? rooms : [...systemRooms(), ...rooms],
        assets,
      }
    : emptyHomeTree();

  const consumables = asArray(raw.consumables)
    .map(migrateConsumable)
    .filter((item): item is Consumable => Boolean(item));
  const playbookDecisions = asArray(raw.playbookDecisions)
    .map(migratePlaybookDecision)
    .filter((item): item is PlaybookDecision => Boolean(item));
  const weatherFires = asArray(raw.weatherFires)
    .map(migrateWeatherFire)
    .filter((item): item is WeatherFire => Boolean(item));
  const savedFromField = asArray(raw.savedRetailerLinks)
    .map(migrateSavedRetailerLink)
    .filter((item): item is SavedRetailerLink => Boolean(item));
  const savedRetailerLinks =
    savedFromField.length > 0
      ? savedFromField
      : supplyAutomations.reduce(
          (links, item) => rememberRetailerLink(links, item.retailerUrl),
          [] as SavedRetailerLink[],
        );
  const homeType =
    raw.homeType === "townhouse" ||
    raw.homeType === "condo" ||
    raw.homeType === "apartment" ||
    raw.homeType === "other"
      ? raw.homeType
      : "house";
  const TENURES: Tenure[] = ["new", "settled", "longtime"];
  const tenure =
    typeof raw.tenure === "string" && (TENURES as readonly string[]).includes(raw.tenure)
      ? (raw.tenure as Tenure)
      : undefined;

  return ensureHomeTree({
    version: 8,
    householdName,
    ownerName: sanitizeText(raw.ownerName, TEXT_LIMITS.name) || firstPerson || "Me",
    cleanerName: sanitizeText(raw.cleanerName, TEXT_LIMITS.name) || "Cleaner",
    onboarded: raw.onboarded === true,
    mode: raw.mode === "cleaner" ? "cleaner" : "owner",
    activeVisitId: asId(raw.activeVisitId),
    homeId: seeded.homeId,
    homeType,
    tenure,
    location: migrateLocation(raw.location),
    attributes: migrateAttributes(raw.attributes),
    floors: seeded.floors,
    rooms: seeded.rooms,
    assets: seeded.assets,
    consumables,
    duties: withKind,
    completions,
    purchases,
    visits,
    maintenanceFund: migrateMaintenanceFund(raw.maintenanceFund),
    homeValueEstimate:
      typeof raw.homeValueEstimate === "number" && Number.isFinite(raw.homeValueEstimate) && raw.homeValueEstimate > 0
        ? Math.min(100_000_000, Math.round(raw.homeValueEstimate))
        : undefined,
    bigTicketThreshold:
      typeof raw.bigTicketThreshold === "number" && Number.isFinite(raw.bigTicketThreshold) && raw.bigTicketThreshold > 0
        ? Math.min(50_000, Math.max(50, Math.round(raw.bigTicketThreshold)))
        : undefined,
    supplyAutomations,
    savedRetailerLinks,
    preferredRetailers: migratePreferredRetailers(raw.preferredRetailers),
    playbookDecisions,
    weatherFires,
    weatherStatus: isPlainObject(raw.weatherStatus)
      ? {
          lastSuccessAt: typeof raw.weatherStatus.lastSuccessAt === "string" ? raw.weatherStatus.lastSuccessAt : null,
          lastError: typeof raw.weatherStatus.lastError === "string" ? raw.weatherStatus.lastError : null,
        }
      : { ...DEFAULT_WEATHER_STATUS },
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

/** Parses a stored JSON household and runs every migration. Exported for tests. */
export function parseStored(raw: string): Household {
  const parsed: unknown = JSON.parse(raw);
  if (!isPlainObject(parsed)) throw new Error("Household data is not an object");
  return migrateHousehold(parsed);
}

