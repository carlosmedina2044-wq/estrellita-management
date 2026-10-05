/**
 * `semiannual` exists because six-month consumables are real (fridge and well
 * filters, purifier cartridges) and the nearest neighbours are both wrong: the
 * walk used to map them to `monthly`, which put a 180-day filter on a 30-day
 * cadence and re-ordered it twelve times a year.
 */
export type Frequency =
  | "once"
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "yearly";
export type Priority = "low" | "medium" | "high";
export type Effort = "small" | "medium" | "large";
export type Audience = "me" | "cleaner" | "anyone";
export type Mode = "owner" | "cleaner";
export type Floor = string;
export type DutyKind = "chore" | "replacement";
export type DutyOrigin = "user" | "starter" | "playbook" | "weather";
export type LifespanUnit = "days" | "months" | "years";
export type Room = string;
export type NodeType = "home" | "floor" | "room" | "asset";
export type RoomType =
  | "kitchen"
  | "primary_bedroom"
  | "bedroom"
  | "bathroom"
  | "living"
  | "dining"
  | "office"
  | "laundry"
  | "garage"
  | "basement"
  | "attic"
  | "hallway"
  | "closet"
  | "patio"
  | "other";
export type AssetType =
  | "hvac_system"
  | "water_heater"
  | "furnace"
  | "refrigerator"
  | "dishwasher"
  | "range_oven"
  | "microwave"
  | "washer"
  | "dryer"
  | "garbage_disposal"
  | "water_softener"
  | "garage_door_opener"
  | "roof"
  | "exterior_paint"
  | "interior_paint"
  | "carpet"
  | "hardwood_floor"
  | "windows"
  | "smoke_detector"
  | "sump_pump"
  | "pool_pump"
  | "irrigation_system"
  | "air_purifier"
  | "evaporative_cooler"
  | "hvac"
  | "fridge"
  | "other";
export type AssetCondition = "good" | "fair" | "poor";
export type SystemRoomKind = "whole-home" | "exterior";
export type HomeType = "house" | "townhouse" | "condo" | "apartment" | "other";
export type ClimateZone = "hot-arid" | "cold" | "humid-subtropical" | "marine" | "mixed";
export type LockAfter = "immediate" | "2min" | "15min";
export type HouseholdMemberRole = "owner" | "adult" | "child";
export type PlaybookSeason = "spring" | "summer" | "fall" | "winter" | "monsoon" | "any";
export type AgeBucket = "new" | "mid" | "old" | "unsure";
export type Tenure = "new" | "settled" | "longtime";
export const RETAILER_IDS = ["amazon", "walmart", "target", "home-depot", "lowes", "costco", "chewy"] as const;
export type RetailerId = (typeof RETAILER_IDS)[number];

export type HomeFloor = {
  id: string;
  name: string;
  sortOrder: number;
  /** ISO instant of the last local edit (hybrid logical clock). Optional: only sync reads it. See src/lib/sync/stamp.ts. */
  updatedAt?: string;
};

export type HomeRoom = {
  id: string;
  floorId: string | null;
  name: string;
  type: RoomType;
  sortOrder: number;
  system?: SystemRoomKind;
  tileW?: number;
  tileH?: number;
  tileX?: number;
  tileY?: number;
  /** ISO instant of the last local edit (hybrid logical clock). Optional: only sync reads it. See src/lib/sync/stamp.ts. */
  updatedAt?: string;
};

export type HomeAsset = {
  id: string;
  roomId: string;
  name: string;
  type: AssetType;
  installDate?: string;
  warrantyUntil?: string;
  purchasePrice?: number;
  expectedLifeYears?: number;
  replacementCostEstimate?: number;
  condition?: AssetCondition;
  notes?: string;
  deferredUntil?: string;
  deferReason?: string;
  /** ISO instant of the last local edit (hybrid logical clock). Optional: only sync reads it. See src/lib/sync/stamp.ts. */
  updatedAt?: string;
};

export type HomeLocation = {
  lat?: number;
  lng?: number;
  postalCode?: string;
  placeName?: string;
  climateZone?: ClimateZone;
  /** User override. When set, deriveClimate returns this instead of ZIP/coords. */
  climateZoneOverride?: ClimateZone;
};

export type HomeAttributes = {
  hasGarage: boolean;
  hasYard: boolean;
  hasPool: boolean;
  hasIrrigation: boolean;
  hasFireplace: boolean;
  hasBasement: boolean;
  hasAttic: boolean;
  hasLaundry: boolean;
  hasHomeOffice: boolean;
  hasGutters: boolean;
  hasSepticSystem: boolean;
  hasWell: boolean;
  hasSolar: boolean;
  hasEvaporativeCooler: boolean;
  roofType?: string;
};

export type Consumable = {
  id: string;
  assetId?: string;
  nodeId: string;
  nodeType: NodeType;
  name: string;
  intervalDays: number;
  unitCost?: number;
  lastPaidPrice?: number;
  lastReplacedAt?: string;
  sizeSpec?: string;
  /** ISO instant of the last local edit (hybrid logical clock). Optional: only sync reads it. See src/lib/sync/stamp.ts. */
  updatedAt?: string;
};

export type Duty = {
  id: string;
  title: string;
  notes: string;
  room: Room;
  nodeId: string;
  nodeType: NodeType;
  audience: Audience;
  effort: Effort;
  frequency: Frequency;
  kind: DutyKind;
  weekday: number;
  monthDay: number;
  dueDate: string | null;
  priority: Priority;
  createdAt: string;
  archived: boolean;
  estimatedCost?: number;
  isDiy?: boolean;
  laborCostEstimate?: number;
  estimatedMinutes?: number;
  origin?: DutyOrigin;
  playbookId?: string;
  weatherTriggerId?: string;
  buyLocally?: boolean;
  caution?: DutyCaution;
  rolledCompletions?: number;
  /** ISO date; hide from Today until this day (inclusive end = day after). */
  snoozedUntil?: string;
  /** ISO instant of the last local edit (hybrid logical clock). Optional: only sync reads it. See src/lib/sync/stamp.ts. */
  updatedAt?: string;
};

export type DutyCaution = "gas" | "electrical" | "roof" | "ladder" | "structural" | "pest";

export type RestockState = "stocked" | "order_now" | "ordered";

export type RestockDigestSettings = {
  enabled: boolean;
  weekday: number;
  hour: number;
  lastSentOn: string | null;
  permissionAsked: boolean;
  privateNotifications?: boolean;
};

export type MorningBriefSettings = {
  enabled: boolean;
  hour: number;
  weekdaysOnly: boolean;
};

/** One evening note when a chore or two would close the day and keep a run. Off by default. */
export type EveningNudgeSettings = {
  enabled: boolean;
  hour: number;
};

export type SavedRetailerLink = {
  url: string;
  lastUsedAt: string;
  useCount: number;
};

export type SupplyAutomation = {
  id: string;
  dutyId: string;
  linkedDutyIds: string[];
  room: Room;
  nodeId: string;
  nodeType: NodeType;
  itemName: string;
  sku: string;
  /**
   * Barcodes (UPC/EAN digits) learned by scanning the box, kept when `sku`
   * already holds something else (a retailer SKU or a size). Optional so every
   * older saved household and backup still loads; see src/lib/scan/barcode.ts.
   */
  barcodes?: string[];
  sizeSpec?: string;
  retailerUrl: string;
  quantity: number;
  onHand: number;
  qtyPerOrder: number;
  reorderAt: number;
  leadTimeDays: number;
  installedAt: string;
  lifespanValue: number;
  lifespanUnit: LifespanUnit;
  orderByDate: string;
  nextOrderDate: string;
  orderInFlight: boolean;
  state: RestockState;
  expectedArrivalDate: string | null;
  createdAt: string;
  unitCost?: number;
  lastPaidPrice?: number;
  lastPaidAt?: string;
  preferredRetailer?: RetailerId | string;
  orderedAt?: string;
  orderedQty?: number;
  observedLeadTimeDays?: number;
  /** Last user- or system-confirmed inventory level, in units. Fractional allowed (0.5 = half a container). */
  lastConfirmedLevel?: number;
  /** ISO date (YYYY-MM-DD) when lastConfirmedLevel was confirmed. */
  lastConfirmedAt?: string;
  /** Learned consumption rate in units per day, from observed purchase intervals. */
  observedRatePerDay?: number;
  /** ISO timestamp. Set by a "low" or "out" check-in (or saying "I'm low on
   * X"); pins the item to Order now regardless of the rate model until it's
   * received. Cleared on receive or a fuller check-in. */
  flaggedLowAt?: string;
  /** ISO instant of the last local edit (hybrid logical clock). Optional: only sync reads it. See src/lib/sync/stamp.ts. */
  updatedAt?: string;
};

export type SupplyAutomationInput = {
  id?: string;
  itemName: string;
  sku?: string;
  sizeSpec?: string;
  retailerUrl?: string;
  quantity?: number;
  onHand?: number;
  qtyPerOrder?: number;
  reorderAt?: number;
  leadTimeDays: number;
  installedAt?: string;
  lifespanValue?: number;
  lifespanUnit?: LifespanUnit;
  orderByDate?: string;
  linkedDutyIds?: string[];
  preferredRetailer?: RetailerId | string;
  unitCost?: number;
  lastConfirmedLevel?: number;
  lastConfirmedAt?: string;
};

export type Completion = {
  id: string;
  dutyId: string;
  actor: "me" | "cleaner";
  visitId: string | null;
  completedAt: string;
  actualCost?: number;
  costSkipped?: true;
  /** ISO instant of the last local edit (hybrid logical clock). Optional: only sync reads it. See src/lib/sync/stamp.ts. */
  updatedAt?: string;
};

export type PurchaseKind = "consumable" | "task" | "replacement";
export type LaborKind = "diy" | "hired";

export type Purchase = {
  id: string;
  completedAt: string;
  actualCost: number;
  label: string;
  kind: PurchaseKind;
  dutyId?: string;
  assetId?: string;
  automationId?: string;
  laborKind?: LaborKind;
  notes?: string;
  plannedCost?: number;
  /** ISO instant of the last local edit (hybrid logical clock). Optional: only sync reads it. See src/lib/sync/stamp.ts. */
  updatedAt?: string;
};

export type MaintenanceFund = {
  balance: number;
  updatedAt: string;
  monthlyContribution?: number;
};

export type Visit = {
  id: string;
  cleanerName: string;
  startedAt: string;
  endedAt: string | null;
  /** ISO instant of the last local edit (hybrid logical clock). Optional: only sync reads it. See src/lib/sync/stamp.ts. */
  updatedAt?: string;
};

export type LockSettings = {
  requireFaceId: boolean;
  lockAfter: LockAfter;
};

export type PlaybookDecision = {
  playbookId: string;
  year: number;
  declinedTaskKeys: string[];
  disabled?: boolean;
};

export type WeatherFire = {
  triggerId: string;
  firedAt: string;
};

export type WeatherStatus = {
  lastSuccessAt: string | null;
  lastError: string | null;
};

/** Ordered easiest first. Tiers deliberately run past what a consistent home
 * reaches in a month: with only seven, the ladder ran out by day 30 and the
 * house sheet said "every milestone earned" for the rest of its life. */
export const MILESTONE_IDS = [
  "first-close",
  "first-week",
  "seven-run",
  "ten-done",
  "every-room",
  "first-quarterly",
  "thirty-run",
  "fifty-done",
  "four-seasonal",
  "care-cared-for",
  "hundred-run",
  "two-hundred-done",
  "twelve-seasonal",
  "care-loved",
] as const;
export type MilestoneId = (typeof MILESTONE_IDS)[number];

export type Milestone = {
  id: MilestoneId;
  earnedAt: string;
};

export type MomentumSettings = {
  enabled: boolean;
  bestRun: number;
  care?: CareState;
  /** Previous care states, oldest first, appended whenever the level changes.
   * Capped at 24 entries. Feeds the year view's care line. */
  careHistory?: CareState[];
  nightFollowsSky?: boolean;
};

export const CARE_LEVELS = [
  "settling-in",
  "kept",
  "well-kept",
  "cared-for",
  "loved",
] as const;
export type CareLevelId = (typeof CARE_LEVELS)[number];
export type CareState = {
  level: CareLevelId;
  since: string;
  direction?: "up" | "down";
};

export const KIT_TYPES = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
] as const;
export type KitType = (typeof KIT_TYPES)[number];
export const PALETTE_IDS = ["classic", "terracotta", "slate"] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];
export type HomeSpec = {
  version: 2;
  kitType: KitType;
  palette: PaletteId;
  windows: Array<{ id: string; roomId: string | null }>;
  seed: number;
};

export type Household = {
  version: 9;
  householdName: string;
  ownerName: string;
  cleanerName: string;
  onboarded: boolean;
  mode: Mode;
  activeVisitId: string | null;
  homeId: string;
  homeType: HomeType;
  tenure?: Tenure;
  location: HomeLocation;
  attributes: HomeAttributes;
  homeSpec?: HomeSpec;
  floors: HomeFloor[];
  rooms: HomeRoom[];
  assets: HomeAsset[];
  consumables: Consumable[];
  duties: Duty[];
  completions: Completion[];
  purchases: Purchase[];
  visits: Visit[];
  maintenanceFund?: MaintenanceFund;
  bigTicketThreshold?: number;
  supplyAutomations: SupplyAutomation[];
  savedRetailerLinks: SavedRetailerLink[];
  preferredRetailers: RetailerId[];
  playbookDecisions: PlaybookDecision[];
  weatherFires: WeatherFire[];
  weatherStatus: WeatherStatus;
  lockSettings: LockSettings;
  householdRole: HouseholdMemberRole;
  restockDigest: RestockDigestSettings;
  morningBrief: MorningBriefSettings;
  eveningNudge?: EveningNudgeSettings;
  /** Days of slack added to lead time before an item surfaces in Order now. Default 7. */
  restockSafetyBufferDays?: number;
  teaching: TeachingProgress;
  seenTips: string[];
  milestones: Milestone[];
  momentum: MomentumSettings;
  /** ISO dates the app was opened, oldest first, capped at 400. On-device
   * only; it feeds the "days you opened the house" tile on the year view. */
  checkIns?: string[];
  /** Untracked things to pick up — "milk", "toilet paper" — said once and
   * gone once checked off. No cadence, no duty: a name matched to a tracked
   * supply is flagged low there instead (see flaggedLowAt) and never becomes
   * a haul item. */
  haulItems?: HaulItem[];
  /** Per-room facts worth keeping (breaker directory, shut-off valves, paint
   * colours). Optional so every older saved household and backup still loads;
   * see src/lib/house-notes.ts. Contents are never logged. */
  houseNotes?: HouseNote[];
  /** Deletions kept so a sync can tell "deleted" from "never seen". Pruned
   * after 90 days, capped at 2000. Only written while sync is on. */
  tombstones?: SyncTombstone[];
  /** ISO instant of the last edit to the shared home profile (names, home
   * type, location, attributes, scene, thresholds). Written only while sync is on. */
  profileUpdatedAt?: string;
  /** Per-device sync state. Never synced, never restored from a backup. */
  sync?: SyncState;
};

export type SyncEntityType =
  | "duty"
  | "completion"
  | "purchase"
  | "asset"
  | "room"
  | "floor"
  | "consumable"
  | "supply"
  | "houseNote"
  | "haulItem"
  | "visit";

export type SyncTombstone = {
  type: SyncEntityType;
  id: string;
  deletedAt: string;
  /**
   * Restock items only: the last stock count the deleted item carried. A count
   * is merged by "latest wins" across every copy, including copies that were
   * deleted and brought back, so it has to outlive the delete.
   */
  keep?: { lastConfirmedAt: string; lastConfirmedLevel?: number };
};

export type SyncState = {
  enabled: boolean;
  deviceId: string;
  homeId?: string;
  lastSyncAt?: string;
};

export type HouseNoteKind = "breaker" | "shutoff" | "paint" | "other";

export type HouseNote = {
  id: string;
  roomId?: string;
  title: string;
  body: string;
  kind: HouseNoteKind;
  createdAt: string;
  /** ISO instant of the last local edit (hybrid logical clock). Optional: only sync reads it. See src/lib/sync/stamp.ts. */
  updatedAt?: string;
};

export type HaulItem = {
  id: string;
  name: string;
  addedAt: string;
  /** ISO instant of the last local edit (hybrid logical clock). Optional: only sync reads it. See src/lib/sync/stamp.ts. */
  updatedAt?: string;
};

export type TeachingProgress = {
  startedAt: string | null;
  checkedChore: boolean;
  openedRestock: boolean;
  setDigestOrZip: boolean;
};

export type DutyDraft = Omit<Duty, "id" | "createdAt" | "archived"> & {
  id?: string;
  supplyAutomation?: SupplyAutomationInput | null;
};

export type RootTab = "today" | "home" | "restock";
export type PushTab = "budget" | "seasonal" | "settings" | "year";
export type Tab = RootTab | PushTab;

export function isRootTab(tab: Tab): tab is RootTab {
  return tab === "today" || tab === "home" || tab === "restock";
}

export type AppNavigateTarget = {
  tab: Tab;
  section?: "ordered" | "order_now" | "coming_up" | "stocked";
  itemId?: string;
  action?: "receive";
  assetId?: string;
  dutyId?: string;
  playbookId?: string;
  /** Home tab: open this room's sheet on arrival (a window tap on Today). */
  roomId?: string;
  /** Home tab: open the Scan a label sheet on arrival (the `cuidala://scan` link). */
  scan?: boolean;
};
