import { catalogEntry, normalizeAssetType } from "@/lib/asset-catalog";
import { deriveClimate } from "@/lib/climate";
import { addDays, toISODate } from "@/lib/dates";
import { installDateFromAge } from "@/lib/forecast";
import { defaultRoomName, systemRooms, WHOLE_HOME_ID } from "@/lib/home-model";
import starterSeed from "@/lib/onboarding/starter-chores.json";
import { matchingPlaybooks } from "@/lib/playbooks";
import { sampleHomeRooms, type RoomChoice } from "@/lib/onboarding/rooms";
import type { RestockPick } from "@/lib/onboarding/restock-walk";
import { SAMPLE_RESTOCK_PICKS } from "@/lib/onboarding/restock-walk";
import type {
  AgeBucket,
  AssetType,
  Consumable,
  Duty,
  HomeAsset,
  HomeAttributes,
  HomeFloor,
  HomeLocation,
  HomeRoom,
  HomeType,
  Household,
  RoomType,
  RetailerId,
  Tenure,
} from "@/lib/types";

export type FeatureKey = keyof Pick<
  HomeAttributes,
  | "hasGarage"
  | "hasYard"
  | "hasPool"
  | "hasIrrigation"
  | "hasFireplace"
  | "hasBasement"
  | "hasAttic"
  | "hasLaundry"
  | "hasHomeOffice"
  | "hasGutters"
  | "hasSepticSystem"
  | "hasWell"
  | "hasSolar"
  | "hasEvaporativeCooler"
>;

export const FEATURES: { id: FeatureKey; label: string }[] = [
  { id: "hasGarage", label: "Garage" },
  { id: "hasYard", label: "Yard" },
  { id: "hasPool", label: "Pool" },
  { id: "hasIrrigation", label: "Irrigation" },
  { id: "hasFireplace", label: "Fireplace" },
  { id: "hasBasement", label: "Basement" },
  { id: "hasAttic", label: "Attic" },
  { id: "hasLaundry", label: "Laundry room" },
  { id: "hasHomeOffice", label: "Home office" },
  { id: "hasGutters", label: "Gutters" },
  { id: "hasSepticSystem", label: "Septic" },
  { id: "hasWell", label: "Well" },
  { id: "hasSolar", label: "Solar" },
  { id: "hasEvaporativeCooler", label: "Evaporative cooler" },
];

export type SystemKey = "hvac_system" | "water_heater" | "refrigerator" | "washer" | "dishwasher";

export const SYSTEMS: { id: SystemKey; label: string }[] = [
  { id: "hvac_system", label: "Heating / cooling" },
  { id: "water_heater", label: "Water heater" },
  { id: "refrigerator", label: "Fridge" },
  { id: "washer", label: "Washer / dryer" },
  { id: "dishwasher", label: "Dishwasher" },
];

export type OnboardingAnswers = {
  homeType: HomeType;
  tenure?: Tenure;
  location: HomeLocation;
  nickname: string;
  floors?: 1 | 2 | 3;
  bedrooms?: 1 | 2 | 3 | 4;
  bathrooms?: 1 | 2 | 3;
  features?: FeatureKey[];
  ages?: Partial<Record<SystemKey, AgeBucket>>;
  rooms?: RoomChoice[];
  restockPicks?: RestockPick[];
  preferredRetailers?: RetailerId[];
  notificationsAllowed?: boolean;
};

const AGE_YEARS: Record<AgeBucket, number | null> = {
  new: 1.5,
  mid: 6,
  old: 11,
  unsure: null,
};

const FEATURE_ASSETS: Partial<Record<FeatureKey, AssetType>> = {
  hasPool: "pool_pump",
  hasIrrigation: "irrigation_system",
  hasWell: "water_softener",
  hasSolar: "other",
  hasEvaporativeCooler: "evaporative_cooler",
  hasBasement: "sump_pump",
};

type StarterChore = {
  title: string;
  roomType?: RoomType;
  assetType?: AssetType;
  frequency: Duty["frequency"];
  estimatedMinutes: number;
  weekOffset: number;
  estimatedCost?: number;
};

const STARTERS = starterSeed as StarterChore[];

export function sizeDefaults(homeType: HomeType): Required<Pick<OnboardingAnswers, "floors" | "bedrooms" | "bathrooms">> {
  if (homeType === "condo" || homeType === "apartment") return { floors: 1, bedrooms: 1, bathrooms: 1 };
  if (homeType === "townhouse") return { floors: 2, bedrooms: 2, bathrooms: 2 };
  return { floors: 1, bedrooms: 3, bathrooms: 2 };
}

export function defaultFeatures(homeType: HomeType, location: HomeLocation): FeatureKey[] {
  const zone = deriveClimate(location);
  const features: FeatureKey[] = ["hasLaundry"];
  if (homeType === "house" || homeType === "townhouse") {
    features.push("hasGarage", "hasYard", "hasGutters");
  }
  if (homeType === "house") features.push("hasAttic");
  if (zone === "hot-arid" && features.includes("hasYard")) features.push("hasIrrigation");
  if (zone === "cold") features.push("hasBasement", "hasFireplace");
  if (zone === "hot-arid") {
    return features.filter((item) => item !== "hasBasement");
  }
  return features;
}

function floorName(index: number, count: number): string {
  if (count === 1) return "Main";
  if (index === 0) return "Main";
  if (index === 1) return "Upstairs";
  return `Floor ${index + 1}`;
}

function uid(): string {
  return crypto.randomUUID();
}

function addRoom(rooms: HomeRoom[], floorId: string, type: RoomType) {
  rooms.push({
    id: uid(),
    floorId,
    name: defaultRoomName(type, rooms),
    type,
    sortOrder: rooms.length,
  });
}

export function sampleHomeAnswers(): OnboardingAnswers {
  return {
    homeType: "house",
    location: {},
    nickname: "Sample home",
    rooms: sampleHomeRooms(),
    ages: {},
    restockPicks: SAMPLE_RESTOCK_PICKS,
  };
}

function inferFeaturesFromRooms(homeType: HomeType, rooms: RoomChoice[], location: HomeLocation): FeatureKey[] {
  const enabled = rooms.filter((room) => room.enabled);
  const hasType = (type: RoomType) => enabled.some((room) => room.type === type && !room.system);
  const features: FeatureKey[] = [];
  if (hasType("garage")) features.push("hasGarage");
  if (hasType("laundry")) features.push("hasLaundry");
  if (hasType("office")) features.push("hasHomeOffice");
  if (hasType("basement")) features.push("hasBasement");
  if (hasType("attic")) features.push("hasAttic");
  if (enabled.some((room) => room.system === "exterior")) features.push("hasYard");
  if (homeType === "house" || homeType === "townhouse") features.push("hasGutters");
  const climateDefaults = defaultFeatures(homeType, location).filter(
    (item) => item === "hasIrrigation" || item === "hasFireplace",
  );
  for (const item of climateDefaults) {
    if (item === "hasIrrigation" && !features.includes("hasYard")) continue;
    if (!features.includes(item)) features.push(item);
  }
  return features;
}

export function generateHomeFromAnswers(
  answers: OnboardingAnswers,
  now = new Date(),
): Pick<
  Household,
  | "homeId"
  | "homeType"
  | "tenure"
  | "householdName"
  | "location"
  | "attributes"
  | "floors"
  | "rooms"
  | "assets"
  | "consumables"
  | "duties"
> & { seasonalSuggestions: ReturnType<typeof matchingPlaybooks> } {
  const size = {
    floors: answers.floors ?? sizeDefaults(answers.homeType).floors,
    bedrooms: answers.bedrooms ?? sizeDefaults(answers.homeType).bedrooms,
    bathrooms: answers.bathrooms ?? sizeDefaults(answers.homeType).bathrooms,
  };
  const chosenRooms = answers.rooms?.filter((room) => room.enabled);
  const inferred = answers.rooms
    ? inferFeaturesFromRooms(answers.homeType, answers.rooms, answers.location)
    : (answers.features ?? defaultFeatures(answers.homeType, answers.location));
  const features: FeatureKey[] = [...inferred];
  for (const extra of answers.features ?? []) {
    if (!features.includes(extra)) features.push(extra);
  }
  const ages = answers.ages ?? {};

  const floors: HomeFloor[] = Array.from({ length: size.floors }, (_, index) => ({
    id: index === 0 ? "main" : `floor-${index}`,
    name: floorName(index, size.floors),
    sortOrder: index,
  }));
  const houseLike = answers.homeType === "house" || answers.homeType === "townhouse";
  const rooms: HomeRoom[] = [
    ...systemRooms({
      wholeHome: houseLike ? "Home systems" : "Whole Home",
      exterior: houseLike ? "Outdoors" : "Exterior",
    }),
  ];
  if (chosenRooms) {
    for (const choice of chosenRooms) {
      if (choice.system === "exterior") {
        const existing = rooms.find((room) => room.system === "exterior");
        if (existing) existing.name = choice.name;
        continue;
      }
      if (choice.system === "whole-home") {
        const existing = rooms.find((room) => room.system === "whole-home");
        if (existing) existing.name = choice.name;
        continue;
      }
      rooms.push({
        id: uid(),
        floorId: floors[0].id,
        name: choice.name.trim() || defaultRoomName(choice.type, rooms),
        type: choice.type,
        sortOrder: rooms.length,
      });
    }
  } else {
    const mainId = floors[0].id;
    addRoom(rooms, mainId, "kitchen");
    addRoom(rooms, mainId, "living");
    const bedFloor = floors[Math.min(1, floors.length - 1)].id;
    addRoom(rooms, bedFloor, "primary_bedroom");
    for (let i = 1; i < size.bedrooms; i += 1) addRoom(rooms, bedFloor, "bedroom");
    for (let i = 0; i < size.bathrooms; i += 1) {
      addRoom(rooms, i === 0 && floors.length > 1 ? floors[0].id : bedFloor, "bathroom");
    }
    if (features.includes("hasLaundry")) addRoom(rooms, mainId, "laundry");
    if (features.includes("hasGarage")) addRoom(rooms, mainId, "garage");
    if (features.includes("hasHomeOffice")) addRoom(rooms, bedFloor, "office");
    if (features.includes("hasBasement")) {
      const basement: HomeFloor = { id: "basement", name: "Basement", sortOrder: -1 };
      floors.unshift(basement);
      floors.forEach((floor, index) => {
        floor.sortOrder = index;
      });
      addRoom(rooms, basement.id, "basement");
    }
    if (features.includes("hasAttic")) addRoom(rooms, floors[floors.length - 1].id, "attic");
  }

  const attributes: HomeAttributes = {
    hasGarage: features.includes("hasGarage"),
    hasYard: features.includes("hasYard"),
    hasPool: features.includes("hasPool"),
    hasIrrigation: features.includes("hasIrrigation"),
    hasFireplace: features.includes("hasFireplace"),
    hasBasement: features.includes("hasBasement"),
    hasAttic: features.includes("hasAttic"),
    hasLaundry: features.includes("hasLaundry"),
    hasHomeOffice: features.includes("hasHomeOffice"),
    hasGutters: features.includes("hasGutters"),
    hasSepticSystem: features.includes("hasSepticSystem"),
    hasWell: features.includes("hasWell"),
    hasSolar: features.includes("hasSolar"),
    hasEvaporativeCooler: features.includes("hasEvaporativeCooler"),
  };

  const assets: HomeAsset[] = [];
  const kitchen = rooms.find((room) => room.type === "kitchen") ?? rooms[0];
  const laundry = rooms.find((room) => room.type === "laundry") ?? kitchen;
  const wholeHome = rooms.find((room) => room.system === "whole-home") ?? rooms[0];
  const exterior = rooms.find((room) => room.system === "exterior") ?? rooms[0];

  function placeSystem(type: AssetType, roomId: string, bucket?: AgeBucket) {
    const catalog = catalogEntry(type);
    const years = bucket ? AGE_YEARS[bucket] : null;
    assets.push({
      id: uid(),
      roomId,
      name: catalog.label,
      type,
      installDate: years != null ? installDateFromAge(years, now) : undefined,
      expectedLifeYears: catalog.defaultLifeYears,
      replacementCostEstimate: catalog.defaultReplacementCost.mid,
    });
  }

  placeSystem("hvac_system", wholeHome.id, ages.hvac_system);
  placeSystem("water_heater", wholeHome.id, ages.water_heater);
  placeSystem("refrigerator", kitchen.id, ages.refrigerator);
  placeSystem("dishwasher", kitchen.id, ages.dishwasher);
  placeSystem("washer", laundry.id, ages.washer);
  placeSystem("dryer", laundry.id, ages.washer);

  for (const feature of features) {
    const type = FEATURE_ASSETS[feature];
    if (!type) continue;
    const roomId =
      type === "pool_pump" || type === "irrigation_system" || type === "evaporative_cooler"
        ? exterior.id
        : type === "sump_pump"
          ? (rooms.find((room) => room.type === "basement")?.id ?? wholeHome.id)
          : wholeHome.id;
    if (assets.some((asset) => normalizeAssetType(asset.type) === type)) continue;
    placeSystem(type, roomId);
  }

  for (const floor of floors) {
    placeSystem("smoke_detector", rooms.find((room) => room.floorId === floor.id && !room.system)?.id ?? wholeHome.id);
  }

  const consumables: Consumable[] = [];
  for (const asset of assets) {
    for (const item of catalogEntry(asset.type).defaultConsumables) {
      consumables.push({
        id: uid(),
        assetId: asset.id,
        nodeId: asset.id,
        nodeType: "asset",
        name: item.name,
        intervalDays: item.intervalDays,
        unitCost: item.unitCost,
      });
    }
  }

  const duties: Duty[] = [];
  for (const starter of STARTERS) {
    let room = WHOLE_HOME_ID;
    let nodeId = WHOLE_HOME_ID;
    let nodeType: Duty["nodeType"] = "home";
    if (starter.assetType) {
      const asset = assets.find((item) => normalizeAssetType(item.type) === starter.assetType);
      if (!asset) continue;
      nodeId = asset.id;
      nodeType = "asset";
      room = asset.roomId;
    } else if (starter.roomType) {
      const match = rooms.find((item) => item.type === starter.roomType && !item.system);
      if (!match) continue;
      room = match.id;
      nodeId = match.id;
      nodeType = "room";
    }
    duties.push({
      id: uid(),
      title: starter.title,
      notes: "",
      room,
      nodeId,
      nodeType,
      audience: "me",
      effort: starter.estimatedMinutes > 20 ? "medium" : "small",
      frequency: starter.frequency,
      kind: "chore",
      weekday: 6,
      monthDay: 1,
      dueDate: starter.frequency === "once" ? toISODate(addDays(now, starter.weekOffset * 7)) : toISODate(addDays(now, starter.weekOffset * 7)),
      priority: "medium",
      createdAt: now.toISOString(),
      archived: false,
      estimatedMinutes: starter.estimatedMinutes,
      estimatedCost: starter.estimatedCost,
      origin: "starter",
    });
  }

  const location = {
    ...answers.location,
    climateZone: deriveClimate({ ...answers.location, climateZone: undefined }),
  };

  return {
    homeId: "home",
    homeType: answers.homeType,
    tenure: answers.tenure,
    householdName: answers.nickname.trim() || "Home",
    location,
    attributes,
    floors,
    rooms,
    assets,
    consumables,
    duties,
    seasonalSuggestions: matchingPlaybooks(
      { location, attributes, playbookDecisions: [], tenure: answers.tenure },
      now,
    ),
  };
}

export function firstWeekDuties(duties: Duty[], now = new Date()) {
  const end = addDays(now, 7).getTime();
  return duties.filter((duty) => {
    if (!duty.dueDate) return duty.frequency === "weekly" || duty.frequency === "daily";
    return Date.parse(duty.dueDate) <= end;
  });
}
