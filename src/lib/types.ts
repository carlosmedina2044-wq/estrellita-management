export type Frequency = "once" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
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
export const RETAILER_IDS = ["amazon", "walmart", "target", "home-depot", "lowes", "chewy"] as const;
export type RetailerId = (typeof RETAILER_IDS)[number];

export type HomeFloor = {
  id: string;
  name: string;
  sortOrder: number;
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
};

export type HomeLocation = {
  lat?: number;
  lng?: number;
  postalCode?: string;
  placeName?: string;
  climateZone?: ClimateZone;
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
};

export type RestockState = "stocked" | "order_now" | "ordered";

export type RestockDigestSettings = {
  enabled: boolean;
  weekday: number;
  hour: number;
  lastSentOn: string | null;
  permissionAsked: boolean;
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
};

export type Completion = {
  id: string;
  dutyId: string;
  actor: "me" | "cleaner";
  visitId: string | null;
  completedAt: string;
  actualCost?: number;
  costSkipped?: true;
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

export type Household = {
  version: 8;
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
  floors: HomeFloor[];
  rooms: HomeRoom[];
  assets: HomeAsset[];
  consumables: Consumable[];
  duties: Duty[];
  completions: Completion[];
  purchases: Purchase[];
  visits: Visit[];
  maintenanceFund?: MaintenanceFund;
  homeValueEstimate?: number;
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
  /** Days of slack added to lead time before an item surfaces in Order now. Default 7. */
  restockSafetyBufferDays?: number;
};

export type DutyDraft = Omit<Duty, "id" | "createdAt" | "archived"> & {
  id?: string;
  supplyAutomation?: SupplyAutomationInput | null;
};

export type Tab = "today" | "home" | "restock" | "budget" | "seasonal" | "settings";

export type AppNavigateTarget = {
  tab: Tab;
  section?: "ordered" | "order_now" | "coming_up" | "stocked";
  itemId?: string;
  action?: "receive";
  assetId?: string;
  dutyId?: string;
};
