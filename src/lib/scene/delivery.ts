import { addDays, toISODate } from "@/lib/dates";
import { isOrdered } from "@/lib/supply";
import type { SupplyAutomation } from "@/lib/types";

/** A box left on the porch is stale after this many days past its due date.
 * Past it the Restock row is already asking whether it ever came, and a box
 * that sits on the step for a month is a lie the picture tells. */
export const BOX_STALE_DAYS = 14;

/** Most boxes the porch ever shows. More is a pile, not a delivery. */
export const MAX_PORCH_BOXES = 2;

export type Delivery = {
  itemId: string;
  itemName: string;
  /** The day it was due, local ISO. */
  dueDate: string;
};

/**
 * What is waiting on the porch: supplies marked on the way whose due day has
 * come. The box stays until the item is marked arrived (the state leaves
 * `ordered`), which is the only thing that clears it — no timer takes it away.
 * Oldest first, so the longest wait is the box that is drawn.
 */
export function deliveriesAtDoor(items: readonly SupplyAutomation[], now: Date): Delivery[] {
  const today = toISODate(now);
  const stale = toISODate(addDays(now, -BOX_STALE_DAYS));
  return items
    .filter(
      (item): item is SupplyAutomation & { expectedArrivalDate: string } =>
        isOrdered(item) &&
        Boolean(item.expectedArrivalDate) &&
        (item.expectedArrivalDate as string) <= today &&
        (item.expectedArrivalDate as string) >= stale,
    )
    .map((item) => ({ itemId: item.id, itemName: item.itemName, dueDate: item.expectedArrivalDate }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.itemId.localeCompare(b.itemId));
}

/** Identifies one arrival. A "still waiting" bump moves the due date, which
 * makes it a new arrival with its own walk. */
export function arrivalKey(delivery: Pick<Delivery, "itemId" | "dueDate">): string {
  return `${delivery.itemId}:${delivery.dueDate}`;
}

/**
 * Whose arrival the courier walks up for: the first box that came due today
 * and has not been walked yet. Boxes from earlier days just sit there — the
 * walk is the moment of arrival, not something to replay on every open.
 */
export function pickCourierWalk(
  deliveries: readonly Delivery[],
  seen: ReadonlySet<string>,
  now: Date,
): Delivery | null {
  const today = toISODate(now);
  return deliveries.find((entry) => entry.dueDate === today && !seen.has(arrivalKey(entry))) ?? null;
}
