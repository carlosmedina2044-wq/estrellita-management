import { startOfWeek, toISODate } from "@/lib/dates";
import { itemNameWithSize } from "@/lib/item-label";
import { digestCandidates } from "@/lib/restock";
import type { Household, RestockDigestSettings, SupplyAutomation } from "@/lib/types";

export const DEFAULT_RESTOCK_DIGEST: RestockDigestSettings = {
  enabled: true,
  weekday: 0,
  hour: 9,
  lastSentOn: null,
  permissionAsked: false,
};

export function digestCopy(
  items: Array<Pick<SupplyAutomation, "itemName" | "sizeSpec">>,
  overdueCount = 0,
): { title: string; body: string } {
  const n = items.length;
  const names = items.slice(0, 3).map((item) => itemNameWithSize(item.itemName, item.sizeSpec));
  if (overdueCount > 0 && n > 0) {
    const chore = overdueCount === 1 ? "1 chore still open" : `${overdueCount} chores still open`;
    const order = n === 1 ? "1 thing to order" : `${n} things to order`;
    return { title: `${chore}. ${order}.`, body: names.join(" · ") };
  }
  if (overdueCount > 0) {
    const title = overdueCount === 1 ? "1 chore still open" : `${overdueCount} chores still open`;
    return { title, body: "A quiet nudge. No rush." };
  }
  const title = n === 1 ? "1 thing to order this week" : `${n} things to order this week`;
  return { title, body: names.join(" · ") };
}

export function shouldSendDigest(
  settings: RestockDigestSettings,
  items: Array<Pick<SupplyAutomation, "itemName" | "sizeSpec">>,
  now = new Date(),
  overdueCount = 0,
): boolean {
  if (!settings.enabled || (items.length === 0 && overdueCount === 0)) return false;
  if (now.getDay() !== settings.weekday) return false;
  if (now.getHours() < settings.hour) return false;
  if (settings.lastSentOn) {
    const sent = new Date(`${settings.lastSentOn}T00:00:00`);
    if (startOfWeek(sent).getTime() === startOfWeek(now).getTime()) return false;
  }
  return true;
}

export function digestPayload(household: Household, now = new Date(), overdueCount = 0) {
  const items = digestCandidates(household.supplyAutomations, household, now);
  return {
    items,
    ...digestCopy(items, overdueCount),
    shouldSend: shouldSendDigest(household.restockDigest, items, now, overdueCount),
    sentOn: toISODate(now),
  };
}
