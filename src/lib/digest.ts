import { startOfWeek, toISODate } from "@/lib/dates";
import { digestCandidates } from "@/lib/restock";
import type { Household, RestockDigestSettings, SupplyAutomation } from "@/lib/types";

export const DEFAULT_RESTOCK_DIGEST: RestockDigestSettings = {
  enabled: true,
  weekday: 0,
  hour: 9,
  lastSentOn: null,
  permissionAsked: false,
};

export function digestCopy(items: Array<Pick<SupplyAutomation, "itemName">>): { title: string; body: string } {
  const n = items.length;
  const title = n === 1 ? "1 thing to order this week" : `${n} things to order this week`;
  const names = items.slice(0, 3).map((item) => item.itemName);
  return { title, body: names.join(" · ") };
}

export function shouldSendDigest(
  settings: RestockDigestSettings,
  items: Array<Pick<SupplyAutomation, "itemName">>,
  now = new Date(),
): boolean {
  if (!settings.enabled || items.length === 0) return false;
  if (now.getDay() !== settings.weekday) return false;
  if (now.getHours() < settings.hour) return false;
  if (settings.lastSentOn) {
    const sent = new Date(`${settings.lastSentOn}T00:00:00`);
    if (startOfWeek(sent).getTime() === startOfWeek(now).getTime()) return false;
  }
  return true;
}

export function digestPayload(household: Household, now = new Date()) {
  const items = digestCandidates(household.supplyAutomations, household, now);
  return {
    items,
    ...digestCopy(items),
    shouldSend: shouldSendDigest(household.restockDigest, items, now),
    sentOn: toISODate(now),
  };
}
