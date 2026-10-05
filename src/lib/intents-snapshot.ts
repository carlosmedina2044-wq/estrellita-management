import { tDutyTitle } from "@/i18n/content";
import { normalizeAssetType } from "@/lib/asset-catalog";
import { todaysOpenDuties } from "@/lib/duties";
import { appraise, type AgeStatus } from "@/lib/scan/appraise";
import type { Household } from "@/lib/types";

/** Most things Siri will read out from today's list. */
export const INTENTS_TODAY_LIMIT = 10;
/** Most appliances kept for Siri and Visual Intelligence. */
export const INTENTS_APPLIANCE_LIMIT = 50;

export type IntentsAppliance = {
  id: string;
  name: string;
  /** Canonical `AssetType`, e.g. "water_heater". Native maps camera labels onto it. */
  type: string;
  roomId: string;
  roomName: string;
  /** Whole years old, only when an install date is known. */
  ageYears?: number;
  /** Years of usual life left (negative once past it), only when an install date is known. */
  yearsLeft?: number;
  status?: AgeStatus;
};

export type IntentsToday = {
  /** Local calendar day this was written for, "YYYY-MM-DD". Native refuses an older day. */
  day: string;
  left: number;
  items: { id: string; title: string }[];
};

/**
 * Privacy-minimal plaintext the app's Siri and Visual Intelligence intents
 * read from the App Group. The vault stays behind Face ID, so native code has
 * no other way to know the household.
 */
export type IntentsSnapshot = {
  appliances: IntentsAppliance[];
  today: IntentsToday;
};

function localDay(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function intentsSnapshotFor(household: Household, now = new Date()): IntentsSnapshot {
  const roomNames = new Map(household.rooms.map((room) => [room.id, room.name]));
  const appliances: IntentsAppliance[] = household.assets.slice(0, INTENTS_APPLIANCE_LIMIT).map((asset) => {
    const type = normalizeAssetType(asset.type);
    const base: IntentsAppliance = {
      id: asset.id,
      name: asset.name,
      type,
      roomId: asset.roomId,
      roomName: roomNames.get(asset.roomId) ?? "",
    };
    const appraisal = asset.installDate ? appraise({ type, manufacturedAt: asset.installDate, now }) : undefined;
    if (!appraisal) return base;
    return {
      ...base,
      ageYears: Math.floor(appraisal.ageYears),
      yearsLeft: appraisal.yearsLeft,
      status: appraisal.status,
    };
  });

  const open = todaysOpenDuties(household, now);
  const privateMode = household.restockDigest.privateNotifications === true;
  return {
    appliances,
    today: {
      day: localDay(now),
      left: open.length,
      // Same rule as the lock-screen widget: private mode keeps the count, not the titles.
      items: privateMode
        ? []
        : open.slice(0, INTENTS_TODAY_LIMIT).map((duty) => ({ id: duty.id, title: tDutyTitle(duty.title) })),
    },
  };
}
