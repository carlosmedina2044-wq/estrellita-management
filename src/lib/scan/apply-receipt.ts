import { applyLogPurchase } from "@/lib/budget/actions";
import { applyReceivedPrice } from "@/lib/costs";
import { toISODate } from "@/lib/dates";
import { receiveConsumable } from "@/lib/restock";
import type { Household } from "@/lib/types";
import type { ReceiptLine } from "./receipt";

/** One receipt line the person ticked, and the tracked thing it belongs to. */
export type ConfirmedReceiptLine = {
  line: Pick<ReceiptLine, "name" | "qty" | "price">;
  /** Exactly one of these. Lines with neither are ignored: nothing is ever auto-created. */
  automationId?: string;
  consumableId?: string;
};

export type ApplyReceiptOptions = {
  /** Receipt date "YYYY-MM-DD", used for the purchase. Falls back to today. */
  date?: string;
  store?: string;
  /** Also log each line as a Purchase so it shows in Budget spending. Default true. */
  recordPurchases?: boolean;
};

export type ApplyReceiptResult = {
  household: Household;
  /** Restock items marked as arrived (stock added, order cleared). */
  arrivedAutomationIds: string[];
  /** Tracked supplies that only had a price recorded. */
  pricedConsumableIds: string[];
  /** Lines that pointed at nothing that exists, or had no usable price. */
  skipped: number;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Applies the ticked receipt lines. For a restock item this does exactly what
 * the Restock "arrived" button does (receiveConsumable: adds the quantity,
 * clears the order, moves the next-order date), then records what was paid with
 * applyReceivedPrice, and optionally logs a Purchase through applyLogPurchase.
 * Lines that matched nothing are left alone. Pure: the caller saves.
 */
export function applyReceipt(
  household: Household,
  confirmed: ConfirmedReceiptLine[],
  options: ApplyReceiptOptions = {},
  now: Date = new Date(),
): ApplyReceiptResult {
  const record = options.recordPurchases !== false;
  const completedOn = options.date && ISO.test(options.date) ? options.date : toISODate(now);
  const arrived: string[] = [];
  const priced: string[] = [];
  let skipped = 0;
  let next = household;

  for (const entry of confirmed) {
    const paid = Number.isFinite(entry.line.price) && entry.line.price > 0 ? Math.round(entry.line.price * 100) / 100 : undefined;
    const qty = Math.max(1, Math.min(99, Math.round(entry.line.qty) || 1));

    if (entry.automationId) {
      const item = next.supplyAutomations.find((a) => a.id === entry.automationId);
      if (!item) {
        skipped += 1;
        continue;
      }
      const snapshot = next;
      next = {
        ...snapshot,
        supplyAutomations: snapshot.supplyAutomations.map((a) =>
          a.id === item.id ? receiveConsumable(a, qty, now, snapshot) : a,
        ),
      };
      arrived.push(item.id);
      if (paid !== undefined) {
        next = record
          ? applyLogPurchase(
              next,
              {
                actualCost: paid,
                completedOn,
                label: entry.line.name,
                kind: "consumable",
                automationId: item.id,
                notes: options.store,
              },
              now,
            )
          : applyReceivedPrice(next, item.id, paid, now);
      }
      continue;
    }

    if (entry.consumableId) {
      const item = next.consumables.find((c) => c.id === entry.consumableId);
      if (!item || paid === undefined) {
        skipped += 1;
        continue;
      }
      next = {
        ...next,
        consumables: next.consumables.map((c) =>
          c.id === item.id ? { ...c, lastPaidPrice: paid, lastReplacedAt: completedOn } : c,
        ),
      };
      if (record) {
        next = {
          ...next,
          purchases: [
            ...(next.purchases ?? []),
            {
              id: crypto.randomUUID(),
              completedAt: new Date(`${completedOn}T12:00:00`).toISOString(),
              actualCost: paid,
              label: entry.line.name,
              kind: "consumable" as const,
              assetId: item.assetId,
              notes: options.store,
            },
          ],
        };
      }
      priced.push(item.id);
      continue;
    }
    skipped += 1;
  }

  return { household: next, arrivedAutomationIds: arrived, pricedConsumableIds: priced, skipped };
}
