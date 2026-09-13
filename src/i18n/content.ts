import { getActiveAppLocale, translate, type MessageKey } from "@/i18n";
import type { RestockWalkGroup, RestockWalkItem } from "@/lib/onboarding/restock-walk";
import type { RoomType } from "@/lib/types";

const ROOM_TYPE_KEYS: Partial<Record<RoomType, MessageKey>> = {
  kitchen: "content.room.kitchen",
  living: "content.room.living",
  bedroom: "content.room.bedroom",
  bathroom: "content.room.bathroom",
  garage: "content.room.garage",
  laundry: "content.room.laundry",
  office: "content.room.office",
  basement: "content.room.basement",
  attic: "content.room.attic",
  patio: "content.room.patio",
  other: "content.room.other",
  primary_bedroom: "content.room.primaryBedroom",
};

const ROOM_TEMPLATE_KEYS: Record<string, MessageKey> = {
  kitchen: "content.room.kitchen",
  living: "content.room.living",
  bedroom: "content.room.bedroom",
  bathroom: "content.room.bathroom",
  balcony: "content.room.balcony",
  primary: "content.room.primaryBedroom",
  bed2: "content.room.bedroom2",
  bath1: "content.room.bathroom1",
  bath2: "content.room.bathroom2",
  garage: "content.room.garage",
  laundry: "content.room.laundry",
  exterior: "content.room.outdoors",
  utility: "content.room.homeSystems",
};

const GROUP_KEYS: Record<RestockWalkGroup, MessageKey> = {
  kitchen: "content.group.kitchen",
  laundry: "content.group.laundry",
  living: "content.group.living",
  bath: "content.group.bath",
  "whole-home": "content.group.wholeHome",
  outside: "content.group.outside",
};

/** English seed/playbook/walk titles → catalog keys. Custom user titles stay unlisted. */
const DUTY_TITLE_KEYS: Record<string, MessageKey> = {
  "Adjust irrigation for summer": "content.chore.adjust-irrigation-for-summer",
  "Blow out or shut down irrigation": "content.chore.blow-out-or-shut-down-irrigation",
  "Change or rekey the exterior locks.": "content.chore.change-or-rekey-the-exterior-locks",
  "Check attic insulation depth and ventilation before snow":
    "content.chore.check-attic-insulation-depth-and-ventilation-before-snow",
  "Check basement or crawlspace humidity; run dehumidifier under 50%":
    "content.chore.check-basement-or-crawlspace-humidity-run-dehumidifier-under-50",
  "Check bathroom caulk": "content.chore.check-bathroom-caulk",
  "Check humidity and hidden mold": "content.chore.check-humidity-and-hidden-mold",
  "Check roof and drainage": "content.chore.check-roof-and-drainage",
  "Check tree limbs over roof and lines; trim or call an arborist":
    "content.chore.check-tree-limbs-over-roof-and-lines-trim-or-call-an-arborist",
  "Check weatherstripping and caulk on windows and doors":
    "content.chore.check-weatherstripping-and-caulk-on-windows-and-doors",
  "Clean bathrooms": "content.chore.clean-bathrooms",
  "Clean dryer vent": "content.chore.clean-dryer-vent",
  "Clean fridge coils": "content.chore.clean-fridge-coils",
  "Clean gutters before freeze": "content.chore.clean-gutters-before-freeze",
  "Clean refrigerator coils": "content.chore.clean-refrigerator-coils",
  "Clean whole-house or portable humidifier pads; set for winter":
    "content.chore.clean-whole-house-or-portable-humidifier-pads-set-for-winter",
  "Clear debris from the AC condenser; run it once before the first hot day":
    "content.chore.clear-debris-from-the-ac-condenser-run-it-once-before-the-first-hot-day",
  "Clear gutters and downspouts after leaf drop": "content.chore.clear-gutters-and-downspouts-after-leaf-drop",
  "Clear moss and gutters": "content.chore.clear-moss-and-gutters",
  "Disconnect hoses, drain and cover exterior spigots":
    "content.chore.disconnect-hoses-drain-and-cover-exterior-spigots",
  "Drain and shut off exterior spigots; store hoses":
    "content.chore.drain-and-shut-off-exterior-spigots-store-hoses",
  "Find and label the main water shutoff.": "content.chore.find-and-label-the-main-water-shutoff",
  "Find the water heater and note its age from the serial plate.":
    "content.chore.find-the-water-heater-and-note-its-age-from-the-serial-plate",
  "Flush the AC condensate drain": "content.chore.flush-the-ac-condensate-drain",
  "Flush the water heater": "content.chore.flush-the-water-heater",
  "Inspect exterior caulk and paint for UV damage": "content.chore.inspect-exterior-caulk-and-paint-for-uv-damage",
  "Inspect furnace or heat and replace the filter": "content.chore.inspect-furnace-or-heat-and-replace-the-filter",
  "Inspect roof and gutters after monsoon": "content.chore.inspect-roof-and-gutters-after-monsoon",
  "Inspect the chimney": "content.chore.inspect-the-chimney",
  "Inspect the roof after storm season": "content.chore.inspect-the-roof-after-storm-season",
  "Label the breaker panel.": "content.chore.label-the-breaker-panel",
  "Photograph the electrical panel, shutoffs, and appliance nameplates.":
    "content.chore.photograph-the-electrical-panel-shutoffs-and-appliance-nameplates",
  "Prep snow equipment": "content.chore.prep-snow-equipment",
  "Replace HVAC filter": "content.walk.hvac-filter.duty",
  "Replace HVAC filter before dust season": "content.chore.replace-hvac-filter-before-dust-season",
  "Replace air purifier filter": "content.walk.air-purifier.duty",
  "Replace drinking water filter": "content.walk.water-filter.duty",
  "Replace evaporative cooler pads": "content.walk.cooler-pads.duty",
  "Replace fridge water filter": "content.walk.fridge-filter.duty",
  "Replace garage remote battery": "content.walk.garage-remote-battery.duty",
  "Replace smoke detector batteries": "content.walk.smoke-battery.duty",
  "Replace the HVAC filter and record the size.": "content.chore.replace-the-hvac-filter-and-record-the-size",
  "Replace vacuum bag or filter": "content.walk.vacuum-filter.duty",
  "Replace well sediment filter": "content.walk.well-filter.duty",
  "Restock dishwasher detergent": "content.walk.dishwasher-pods.duty",
  "Restock laundry detergent": "content.walk.laundry-soap.duty",
  "Restock pool chlorine": "content.walk.pool-chlorine.duty",
  "Restock pool test strips": "content.walk.pool-test-strips.duty",
  "Restock water softener salt": "content.walk.water-softener-salt.duty",
  "Run garbage disposal with ice and citrus": "content.chore.run-garbage-disposal-with-ice-and-citrus",
  "Schedule AC tune-up and replace the filter": "content.chore.schedule-ac-tune-up-and-replace-the-filter",
  "Schedule a termite inspection": "content.chore.schedule-a-termite-inspection",
  "Seal exterior wood": "content.chore.seal-exterior-wood",
  "Service the AC and replace the filter": "content.chore.service-the-ac-and-replace-the-filter",
  "Service the furnace": "content.chore.service-the-furnace",
  "Stage hurricane supplies": "content.chore.stage-hurricane-supplies",
  "Stage patio furniture and flashlights": "content.chore.stage-patio-furniture-and-flashlights",
  "Start up the evaporative cooler": "content.chore.start-up-the-evaporative-cooler",
  "Sweep the garage": "content.chore.sweep-the-garage",
  "Test GFCI outlets": "content.chore.test-gfci-outlets",
  "Test every smoke and CO detector and note the battery types.":
    "content.chore.test-every-smoke-and-co-detector-and-note-the-battery-types",
  "Test smoke and CO detectors": "content.chore.test-smoke-and-co-detectors",
  "Test smoke detectors": "content.chore.test-smoke-detectors",
  "Test sump pump by pouring a bucket in the pit": "content.chore.test-sump-pump-by-pouring-a-bucket-in-the-pit",
  "Test the sump pump": "content.chore.test-the-sump-pump",
  "Vacuum / mop floors": "content.chore.vacuum-mop-floors",
  "Walk drip lines and emitters": "content.chore.walk-drip-lines-and-emitters",
  "Walk the exterior after thaw: grading, downspout extensions, foundation cracks":
    "content.chore.walk-the-exterior-after-thaw-grading-downspout-extensions-foundation-cracks",
  "Walk the foundation for mud tubes; note any wood-to-soil contact":
    "content.chore.walk-the-foundation-for-mud-tubes-note-any-wood-to-soil-contact",
  "Winterize outdoor faucets": "content.chore.winterize-outdoor-faucets",
  "Winterize the evaporative cooler": "content.chore.winterize-the-evaporative-cooler",
  "Wipe kitchen counters": "content.chore.wipe-kitchen-counters",
  "Wipe laundry machines": "content.chore.wipe-laundry-machines",
};

function tContent(key: string, fallback: string): string {
  const value = translate(getActiveAppLocale(), key as MessageKey);
  return value === key ? fallback : value;
}

export function tRoomTypeLabel(type: RoomType): string {
  const key = ROOM_TYPE_KEYS[type];
  return key ? translate(getActiveAppLocale(), key) : translate(getActiveAppLocale(), "content.room.room");
}

export function tRoomTemplateName(key: string, fallback: string): string {
  const msg = ROOM_TEMPLATE_KEYS[key];
  return msg ? translate(getActiveAppLocale(), msg) : fallback;
}

/** Localize known seed/template room names stored in English; custom names pass through. */
const STORED_ROOM_NAME_KEYS: Record<string, MessageKey> = {
  Kitchen: "content.room.kitchen",
  "Living Room": "content.room.living",
  Bedroom: "content.room.bedroom",
  Bathroom: "content.room.bathroom",
  Balcony: "content.room.balcony",
  "Primary Bedroom": "content.room.primaryBedroom",
  "Bedroom 2": "content.room.bedroom2",
  "Bathroom 1": "content.room.bathroom1",
  "Bathroom 2": "content.room.bathroom2",
  Garage: "content.room.garage",
  Laundry: "content.room.laundry",
  Outdoors: "content.room.outdoors",
  "Home systems": "content.room.homeSystems",
  "Whole Home": "content.room.wholeHome",
  Exterior: "content.room.exterior",
  Office: "content.room.office",
  Basement: "content.room.basement",
  Attic: "content.room.attic",
  Patio: "content.room.patio",
  Other: "content.room.other",
  Room: "content.room.room",
};

export function tStoredRoomName(name: string): string {
  const key = STORED_ROOM_NAME_KEYS[name];
  return key ? translate(getActiveAppLocale(), key) : name;
}

export function tWalkGroupLabel(group: RestockWalkGroup): string {
  return translate(getActiveAppLocale(), GROUP_KEYS[group]);
}

export function tWalkItemName(item: Pick<RestockWalkItem, "id" | "itemName">): string {
  return tContent(`content.walk.${item.id}.name`, item.itemName);
}

export function tWalkItemHint(item: Pick<RestockWalkItem, "id" | "hint">): string {
  return tContent(`content.walk.${item.id}.hint`, item.hint);
}

export function tWalkItemDuty(item: Pick<RestockWalkItem, "id" | "dutyTitle">): string {
  return tContent(`content.walk.${item.id}.duty`, item.dutyTitle);
}

/** Localized label for known seed/playbook/walk titles; custom titles pass through. */
export function tDutyTitle(title: string): string {
  const key = DUTY_TITLE_KEYS[title];
  return key ? translate(getActiveAppLocale(), key) : title;
}

/**
 * When editing a seed duty, the form may show a localized title. If the user
 * did not change it, persist the original English catalog title so lookups stay stable.
 */
export function seedTitleForSave(draftTitle: string, originalTitle: string | undefined): string {
  if (!originalTitle) return draftTitle;
  if (draftTitle === tDutyTitle(originalTitle)) return originalTitle;
  return draftTitle;
}

export function isKnownSeedDutyTitle(title: string): boolean {
  return title in DUTY_TITLE_KEYS;
}

export function tPlaybookName(id: string, fallback: string): string {
  return tContent(`content.playbook.${id}.name`, fallback);
}

export function tPlaybookWhy(id: string, fallback: string): string {
  if (!fallback) return "";
  return tContent(`content.playbook.${id}.why`, fallback);
}

export function tTriggerName(id: string, fallback: string): string {
  return tContent(`content.trigger.${id}.name`, fallback);
}

export function tAssetTypeLabel(type: string, fallback?: string): string {
  return tContent(`content.asset.${type}`, fallback ?? type);
}

export function tClimateZoneLabel(zone: string): string {
  return tContent(`climate.zone.${zone}`, zone);
}

export function tMonthName(monthIndex0: number): string {
  const keys = [
    "month.january",
    "month.february",
    "month.march",
    "month.april",
    "month.may",
    "month.june",
    "month.july",
    "month.august",
    "month.september",
    "month.october",
    "month.november",
    "month.december",
  ] as const;
  const key = keys[monthIndex0];
  return key ? translate(getActiveAppLocale(), key) : String(monthIndex0 + 1);
}

export function tSpendingCategory(category: string): string {
  const map: Record<string, MessageKey> = {
    Supplies: "budget.cat.supplies",
    Upkeep: "budget.cat.upkeep",
    HVAC: "budget.cat.hvac",
    Plumbing: "budget.cat.plumbing",
    Exterior: "budget.cat.exterior",
    Interior: "budget.cat.interior",
    Appliances: "budget.cat.appliances",
    Other: "budget.cat.other",
  };
  const key = map[category];
  return key ? translate(getActiveAppLocale(), key) : category;
}
