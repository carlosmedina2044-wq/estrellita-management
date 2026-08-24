import { DEFAULT_RESTOCK_DIGEST } from "@/lib/digest";
import type {
  HomeAttributes,
  HomeLocation,
  HomeType,
  Household,
  LockSettings,
  RestockDigestSettings,
  SavedRetailerLink,
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
  requireFaceId: true,
  lockAfter: "2min",
};

export const DEFAULT_WEATHER_STATUS: WeatherStatus = {
  lastSuccessAt: null,
  lastError: null,
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
  | "playbookDecisions"
  | "weatherFires"
  | "weatherStatus"
  | "lockSettings"
  | "householdRole"
  | "restockDigest"
  | "savedRetailerLinks"
> &
  T {
  return {
    homeType: partial.homeType ?? "house",
    location: partial.location ?? { ...DEFAULT_LOCATION },
    attributes: { ...DEFAULT_ATTRIBUTES, ...partial.attributes },
    consumables: partial.consumables ?? [],
    playbookDecisions: partial.playbookDecisions ?? [],
    weatherFires: partial.weatherFires ?? [],
    weatherStatus: partial.weatherStatus ?? { ...DEFAULT_WEATHER_STATUS },
    lockSettings: { ...DEFAULT_LOCK_SETTINGS, ...partial.lockSettings },
    householdRole: partial.householdRole ?? "owner",
    ...partial,
    savedRetailerLinks: (partial.savedRetailerLinks ?? []) as SavedRetailerLink[],
    restockDigest: { ...DEFAULT_RESTOCK_DIGEST, ...partial.restockDigest } satisfies RestockDigestSettings,
  };
}
