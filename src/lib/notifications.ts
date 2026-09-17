import { tActive } from "@/i18n";
import { addDays, parseISODate } from "@/lib/dates";
import { isOverdueFor } from "@/lib/duties";
import { itemNameWithSize } from "@/lib/item-label";
import { digestCandidates, linkedDutyIdsFor, restockPlacement } from "@/lib/restock";
import { digestCopy } from "@/lib/digest";
import { BRIEF_DAYS, BRIEF_ID_BASE, morningBriefNotifications } from "@/lib/morning-brief";
import { eveningNudgeNotifications, NUDGE_DAYS, NUDGE_ID_BASE } from "@/lib/evening-nudge";
import { isNative } from "@/lib/native/platform";
import { warrantyNotificationsFor } from "@/lib/warranty";
import type { Household, SupplyAutomation } from "@/lib/types";

export type NotifyPermission = "granted" | "denied" | "prompt" | "unsupported";

const DIGEST_ID = 1;
const ITEM_ID_BASE = 1000;
const MAX_PENDING = 64;
const MAX_ITEM_REMINDERS = 50; // iOS caps pending local notifications at 64.
const REMINDER_HOUR = 9;
const ARRIVAL_HOUR = 18;
export const ORDER_FOLLOWUP_DAYS = 3;

export type NotificationSchedule =
  | { at: Date; repeats?: false }
  | { on: { weekday: number; hour: number; minute?: number }; repeats: true };

export type PlannedNotification = {
  id: number;
  title: string;
  body: string;
  schedule: NotificationSchedule;
  extra?: Record<string, string>;
};

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

function hashId(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return ITEM_ID_BASE + (Math.abs(hash) % 1_000_000);
}

function allocateId(used: Set<number>, seed: string): number {
  let id = hashId(seed);
  while (used.has(id)) {
    id = ITEM_ID_BASE + ((id - ITEM_ID_BASE + 1) % 1_000_000);
  }
  used.add(id);
  return id;
}

/** Capacitor/iOS weekday is 1 = Sunday … 7 = Saturday. JS getDay is 0–6. */
export function capacitorWeekday(jsWeekday: number): number {
  return (jsWeekday % 7) + 1;
}

export function arrivalCheckAt(expectedArrivalDate: string): Date {
  const at = addDays(new Date(parseISODate(expectedArrivalDate)), 1);
  at.setHours(ARRIVAL_HOUR, 0, 0, 0);
  return at;
}

export function itemReminderCap(arrivalCount: number): number {
  return Math.max(0, MAX_ITEM_REMINDERS - Math.max(0, arrivalCount));
}

function hasLinkedDuty(item: SupplyAutomation, household: Household): boolean {
  const ids = new Set(linkedDutyIdsFor(item));
  return household.duties.some((duty) => !duty.archived && ids.has(duty.id));
}

function scheduleAt(at: Date): NotificationSchedule {
  return { at };
}

function arrivalNotice(
  item: SupplyAutomation,
  household: Household,
  now: Date,
  used: Set<number>,
): PlannedNotification | null {
  const placement = restockPlacement(item, household, now);
  if (placement.bucket !== "ordered" || !item.expectedArrivalDate) return null;
  const at = arrivalCheckAt(item.expectedArrivalDate);
  if (at.getTime() <= now.getTime()) return null;
  return {
    id: allocateId(used, `arrive:${item.id}`),
    title: household.restockDigest.privateNotifications
      ? tActive("notify.didOrderArrive")
      : tActive("notify.didItemArrive", { name: item.itemName }),
    body: household.restockDigest.privateNotifications
      ? tActive("digest.openDetails")
      : hasLinkedDuty(item, household)
        ? tActive("notify.tapReceivedInstall")
        : tActive("notify.tapReceived"),
    schedule: scheduleAt(at),
    extra: { tab: "restock", itemId: item.id, action: "receive" },
  };
}

export function overdueChoreCount(household: Household, now = new Date()): number {
  return household.duties.filter((duty) => !duty.archived && isOverdueFor(duty, household, now)).length;
}

export function orderFollowUpAt(orderByDate: string, now = new Date()): Date | null {
  const due = new Date(parseISODate(orderByDate));
  due.setHours(REMINDER_HOUR, 0, 0, 0);
  const follow = addDays(due, ORDER_FOLLOWUP_DAYS);
  follow.setHours(REMINDER_HOUR, 0, 0, 0);
  if (follow.getTime() <= now.getTime()) return null;
  return follow;
}

export function plannedNotifications(household: Household, now = new Date()): PlannedNotification[] {
  const notifications: PlannedNotification[] = [];
  const used = new Set<number>([DIGEST_ID]);
  for (let offset = 0; offset < BRIEF_DAYS; offset += 1) used.add(BRIEF_ID_BASE + offset);
  for (let offset = 0; offset < NUDGE_DAYS; offset += 1) used.add(NUDGE_ID_BASE + offset);

  if (household.restockDigest.enabled) {
    const items = digestCandidates(household.supplyAutomations, household, now);
    const overdue = overdueChoreCount(household, now);
    if (items.length > 0 || overdue > 0) {
      const copy = digestCopy(items, overdue, household.restockDigest.privateNotifications === true);
      notifications.push({
        id: DIGEST_ID,
        title: copy.title,
        body: copy.body,
        schedule: {
          on: {
            weekday: capacitorWeekday(household.restockDigest.weekday),
            hour: household.restockDigest.hour,
            minute: 0,
          },
          repeats: true,
        },
        extra: { tab: items.length === 0 && overdue > 0 ? "today" : "restock" },
      });
    }
  }

  notifications.push(...morningBriefNotifications(household, now));
  notifications.push(...eveningNudgeNotifications(household, now));

  const arrivals = household.supplyAutomations
    .map((item) => arrivalNotice(item, household, now, used))
    .filter((notice): notice is PlannedNotification => Boolean(notice))
    .sort((a, b) => {
      const aAt = "at" in a.schedule ? a.schedule.at.getTime() : 0;
      const bAt = "at" in b.schedule ? b.schedule.at.getTime() : 0;
      return aAt - bAt;
    });
  const arrivalRoom = Math.max(0, MAX_PENDING - notifications.length);
  notifications.push(...arrivals.slice(0, arrivalRoom));

  const reminderCap = Math.min(itemReminderCap(arrivals.length), Math.max(0, MAX_PENDING - notifications.length));
  const reminders = household.supplyAutomations
    .map((item) => ({ item, placement: restockPlacement(item, household, now) }))
    .filter(({ placement }) => placement.orderByDate && placement.bucket !== "ordered")
    .map(({ item, placement }) => {
      const due = new Date(parseISODate(placement.orderByDate!));
      due.setHours(REMINDER_HOUR, 0, 0, 0);
      return { item, due, orderByDate: placement.orderByDate! };
    })
    .filter(({ due }) => due.getTime() > now.getTime())
    .sort((a, b) => a.due.getTime() - b.due.getTime())
    .slice(0, reminderCap);

  for (const { item, due } of reminders) {
    notifications.push({
      id: allocateId(used, item.id),
      title: household.restockDigest.privateNotifications
        ? tActive("notify.orderSupply")
        : tActive("notify.orderNamed", { name: itemNameWithSize(item.itemName, item.sizeSpec) }),
      body: household.restockDigest.privateNotifications
        ? tActive("digest.openDetails")
        : tActive("notify.orderToday"),
      schedule: scheduleAt(due),
      extra: { tab: "restock", itemId: item.id },
    });
  }

  const followRoom = Math.max(0, MAX_PENDING - notifications.length);
  const followUps = household.supplyAutomations
    .map((item) => ({ item, placement: restockPlacement(item, household, now) }))
    .filter(({ placement }) => placement.orderByDate && placement.bucket !== "ordered")
    .map(({ item, placement }) => {
      const at = orderFollowUpAt(placement.orderByDate!, now);
      return at ? { item, at } : null;
    })
    .filter((entry): entry is { item: SupplyAutomation; at: Date } => Boolean(entry))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, followRoom);

  for (const { item, at } of followUps) {
    notifications.push({
      id: allocateId(used, `followup:${item.id}`),
      title: household.restockDigest.privateNotifications
        ? tActive("notify.stillOrderSupply")
        : tActive("notify.stillOrderNamed", { name: itemNameWithSize(item.itemName, item.sizeSpec) }),
      body: household.restockDigest.privateNotifications
        ? tActive("digest.openDetails")
        : tActive("notify.noRush"),
      schedule: scheduleAt(at),
      extra: { tab: "restock", itemId: item.id, action: "followup" },
    });
  }

  const remaining = Math.max(0, MAX_PENDING - notifications.length);
  for (const notice of warrantyNotificationsFor(
    household.assets,
    now,
    household.restockDigest.privateNotifications === true,
  ).slice(0, remaining)) {
    notifications.push({
      id: allocateId(used, notice.id),
      title: notice.title,
      body: notice.body,
      schedule: scheduleAt(notice.at),
      extra: notice.extra,
    });
  }

  return notifications;
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

  const notifications = plannedNotifications(household, now);
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
