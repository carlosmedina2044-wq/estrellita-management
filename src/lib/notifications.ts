import { parseISODate } from "@/lib/dates";
import { digestCandidates, restockPlacement } from "@/lib/restock";
import { digestCopy } from "@/lib/digest";
import { isNative } from "@/lib/native/platform";
import type { Household } from "@/lib/types";

export type NotifyPermission = "granted" | "denied" | "prompt" | "unsupported";

const DIGEST_ID = 1;
const ITEM_ID_BASE = 1000;
const MAX_ITEM_REMINDERS = 50; // iOS caps pending local notifications at 64.
const REMINDER_HOUR = 9;

export async function notifyPermission(): Promise<NotifyPermission> {
  if (isNative()) {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const status = await LocalNotifications.checkPermissions();
    return status.display === "granted" ? "granted" : status.display === "denied" ? "denied" : "prompt";
  }
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission === "default" ? "prompt" : Notification.permission;
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (isNative()) {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const status = await LocalNotifications.requestPermissions();
    return status.display === "granted" ? "granted" : "denied";
  }
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    const result = await Notification.requestPermission();
    return result === "default" ? "prompt" : result;
  } catch {
    return "denied";
  }
}

function stableId(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return ITEM_ID_BASE + (Math.abs(hash) % 1_000_000);
}

function nextDigestDate(weekday: number, hour: number, now = new Date()): Date {
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
  const add = (weekday - candidate.getDay() + 7) % 7;
  candidate.setDate(candidate.getDate() + add);
  if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 7);
  return candidate;
}

export const OPEN_RESTOCK_EVENT = "cuidala-open-restock";

/**
 * Re-plans every pending Cuidala notification from the current household.
 * Called after each persisted change; idempotent. No-op on web.
 */
export async function syncScheduledNotifications(household: Household, now = new Date()): Promise<void> {
  if (!isNative()) return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return;

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((item) => ({ id: item.id })) });
  }

  const notifications: Array<{ id: number; title: string; body: string; schedule: { at: Date }; extra?: Record<string, string> }> = [];

  if (household.restockDigest.enabled) {
    const at = nextDigestDate(household.restockDigest.weekday, household.restockDigest.hour, now);
    const items = digestCandidates(household.supplyAutomations, household, at);
    if (items.length > 0) {
      const copy = digestCopy(items);
      notifications.push({ id: DIGEST_ID, title: copy.title, body: copy.body, schedule: { at }, extra: { tab: "restock" } });
    }
  }

  const reminders = household.supplyAutomations
    .map((item) => ({ item, placement: restockPlacement(item, household, now) }))
    .filter(({ placement }) => placement.orderByDate && placement.bucket !== "ordered")
    .map(({ item, placement }) => {
      const due = new Date(parseISODate(placement.orderByDate!));
      due.setHours(REMINDER_HOUR, 0, 0, 0);
      return { item, due };
    })
    .filter(({ due }) => due.getTime() > now.getTime())
    .sort((a, b) => a.due.getTime() - b.due.getTime())
    .slice(0, MAX_ITEM_REMINDERS);

  for (const { item, due } of reminders) {
    notifications.push({
      id: stableId(item.id),
      title: `Order ${item.itemName}`,
      body: `Order today so it arrives before you run out (${item.leadTimeDays}-day lead time).`,
      schedule: { at: due },
      extra: { tab: "restock", itemId: item.id },
    });
  }

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }
}

/** Web-only immediate digest, used by the dev shell where scheduling is unavailable. */
export function showLocalNotification(title: string, body: string, tag = "restock-digest"): boolean {
  if (isNative()) return false;
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  try {
    const notification = new Notification(title, { body, tag });
    notification.onclick = () => {
      window.focus();
      window.dispatchEvent(new CustomEvent(OPEN_RESTOCK_EVENT));
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}
