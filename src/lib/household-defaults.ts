import { DEFAULT_RESTOCK_DIGEST } from "@/lib/digest";
import { DEFAULT_MORNING_BRIEF } from "@/lib/morning-brief";
import type {
  HomeAttributes,
  HomeLocation,
  HomeType,
  Household,
  LockSettings,
  Milestone,
  MomentumSettings,
  MorningBriefSettings,
  RestockDigestSettings,
  RetailerId,
  SavedRetailerLink,
  TeachingProgress,
  WeatherStatus,
} from "@/lib/types";

export const DEFAULT_ATTRIBUTES: HomeAttributes = {
  hasGarage: false,
  hasYard: false,
  hasPool: false,
  hasIrrigation: false,
  hasFireplace: false,
  hasBasement: false,
  hasAttic: false,
  hasLaundry: false,
  hasHomeOffice: false,
  hasGutters: false,
  hasSepticSystem: false,
  hasWell: false,
  hasSolar: false,
  hasEvaporativeCooler: false,
};

export const DEFAULT_LOCATION: HomeLocation = {};

export const DEFAULT_LOCK_SETTINGS: LockSettings = {
  requireFaceId: false,
  lockAfter: "2min",
};

export const DEFAULT_WEATHER_STATUS: WeatherStatus = {
  lastSuccessAt: null,
  lastError: null,
};

export const DEFAULT_TEACHING: TeachingProgress = {
  startedAt: null,
  checkedChore: false,
  openedRestock: false,
  setDigestOrZip: false,
};

export const DEFAULT_MOMENTUM: MomentumSettings = {
  enabled: true,
  bestRun: 0,
  nightFollowsSky: true,
};

export function defaultHomeType(): HomeType {
  return "house";
}

export function withHouseholdDefaults<T extends Partial<Household>>(partial: T): Pick<
  Household,
  | "homeType"
  | "location"
  | "attributes"
  | "consumables"
  | "purchases"
  | "playbookDecisions"
  | "weatherFires"
  | "weatherStatus"
  | "lockSettings"
  | "householdRole"
  | "restockDigest"
  | "morningBrief"
  | "savedRetailerLinks"
  | "preferredRetailers"
  | "teaching"
  | "seenTips"
  | "milestones"
  | "momentum"
> &
  T {
  return {
    homeType: partial.homeType ?? "house",
    location: partial.location ?? { ...DEFAULT_LOCATION },
    attributes: { ...DEFAULT_ATTRIBUTES, ...partial.attributes },
    playbookDecisions: partial.playbookDecisions ?? [],
    weatherFires: partial.weatherFires ?? [],
    weatherStatus: partial.weatherStatus ?? { ...DEFAULT_WEATHER_STATUS },
    lockSettings: { ...DEFAULT_LOCK_SETTINGS, ...partial.lockSettings },
    householdRole: partial.householdRole ?? "owner",
    ...partial,
    consumables: partial.consumables ?? [],
    purchases: partial.purchases ?? [],
    savedRetailerLinks: (partial.savedRetailerLinks ?? []) as SavedRetailerLink[],
    preferredRetailers: (partial.preferredRetailers ?? []) as RetailerId[],
    restockDigest: { ...DEFAULT_RESTOCK_DIGEST, ...partial.restockDigest } satisfies RestockDigestSettings,
    morningBrief: { ...DEFAULT_MORNING_BRIEF, ...partial.morningBrief } satisfies MorningBriefSettings,
    teaching: { ...DEFAULT_TEACHING, ...partial.teaching } satisfies TeachingProgress,
    seenTips: partial.seenTips ?? [],
    milestones: (partial.milestones ?? []) as Milestone[],
    momentum: { ...DEFAULT_MOMENTUM, ...partial.momentum } satisfies MomentumSettings,
  };
}
