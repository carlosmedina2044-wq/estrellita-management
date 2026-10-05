import type { MessageKey } from "@/i18n";
import { tDutyTitle } from "@/i18n/content";
import type { AiAction, AiTellContext } from "@/lib/native/intelligence";
import { applyLogPurchase } from "@/lib/budget/actions";
import { toISODate } from "@/lib/dates";
import { applyDutySave } from "@/lib/household-update";
import { roomName, WHOLE_HOME_ID } from "@/lib/home-model";
import { sanitizeText, TEXT_LIMITS } from "@/lib/sanitize";
import type { Frequency, Household } from "@/lib/types";

/*
 * Turns what Apple Intelligence PROPOSED into the household updates the app already
 * knows how to make. Nothing here is automatic: the sheet lists every proposal as a
 * plain sentence, and only the ticked ones are applied. A chore marked done is NOT
 * applied here; the caller runs the app's normal completion so the house answers.
 */

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

const DAYS: Record<"day" | "week" | "month" | "year", number> = { day: 1, week: 7, month: 30, year: 365 };
const CADENCES: { frequency: Frequency; days: number }[] = [
  { frequency: "daily", days: 1 },
  { frequency: "weekly", days: 7 },
  { frequency: "monthly", days: 30 },
  { frequency: "quarterly", days: 91 },
  { frequency: "semiannual", days: 182 },
  { frequency: "yearly", days: 365 },
];

/**
 * The app repeats on a few fixed cadences, so "every 3 months" is quarterly and an
 * odd one ("every 5 weeks") lands on the closest cadence. The confirm row names the
 * cadence that will actually be saved, so the person can see it before tapping Add.
 */
export function frequencyFor(freq: { unit: "day" | "week" | "month" | "year"; every: number } | undefined): Frequency {
  if (!freq) return "once";
  const days = DAYS[freq.unit] * Math.max(1, freq.every);
  let best = CADENCES[0];
  let bestGap = Infinity;
  for (const cadence of CADENCES) {
    const gap = Math.abs(Math.log(days / cadence.days));
    if (gap < bestGap) {
      best = cadence;
      bestGap = gap;
    }
  }
  return best.frequency;
}

const FREQUENCY_KEYS: Record<Frequency, MessageKey> = {
  once: "tell.freqOnce",
  daily: "tell.freqDaily",
  weekly: "tell.freqWeekly",
  monthly: "tell.freqMonthly",
  quarterly: "tell.freqQuarterly",
  semiannual: "tell.freqSemiannual",
  yearly: "tell.freqYearly",
};

/** Names the model may use, exactly as the person sees them on screen. */
export function tellContext(household: Household): AiTellContext {
  return {
    rooms: household.rooms.map((room) => roomName(household, room.id)),
    duties: household.duties.filter((duty) => !duty.archived).map((duty) => tDutyTitle(duty.title)),
    supplies: household.supplyAutomations.map((item) => item.itemName),
  };
}

function roomIdByName(household: Household, name: string | undefined): string | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase();
  return household.rooms.find((room) => roomName(household, room.id).toLowerCase() === lower)?.id;
}

/** The open (not archived) chore whose on-screen title matches. */
export function dutyIdByTitle(household: Household, title: string): string | undefined {
  const lower = title.toLowerCase();
  return household.duties.find((duty) => !duty.archived && tDutyTitle(duty.title).toLowerCase() === lower)?.id;
}

/** Whether an action can be applied to this household at all. */
export function isUsable(household: Household, action: AiAction): boolean {
  if (action.kind === "completeChore") return dutyIdByTitle(household, action.title) !== undefined;
  if (action.kind === "logPurchase") return action.amount !== undefined && action.amount > 0;
  return true;
}

/** One plain sentence for the confirm row. */
export function describeAction(
  household: Household,
  action: AiAction,
  t: Translate,
  formatMoney: (value: number) => string,
): string {
  if (action.kind === "addChore") {
    const parts = [t("tell.rowAddChore", { title: action.title })];
    parts.push(t(FREQUENCY_KEYS[frequencyFor(action.frequency)]));
    const room = roomIdByName(household, action.room);
    if (room) parts.push(roomName(household, room));
    return parts.join(" · ");
  }
  if (action.kind === "logPurchase") {
    return t("tell.rowLog", { amount: formatMoney(action.amount ?? 0), label: action.label });
  }
  return t("tell.rowDone", { title: action.title });
}

/** Chores to mark done through the app's normal completion. */
export function completionTargets(household: Household, actions: AiAction[]): string[] {
  const ids: string[] = [];
  for (const action of actions) {
    if (action.kind !== "completeChore") continue;
    const id = dutyIdByTitle(household, action.title);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Applies the chores and purchases. Completions are returned by `completionTargets`. */
export function applyTellActions(household: Household, actions: AiAction[], now = new Date()): Household {
  let next = household;
  for (const action of actions) {
    if (action.kind === "addChore") {
      const frequency = frequencyFor(action.frequency);
      const roomId = roomIdByName(next, action.room) ?? WHOLE_HOME_ID;
      const knownRoom = next.rooms.some((room) => room.id === roomId);
      const room = knownRoom ? roomId : (next.rooms[0]?.id ?? WHOLE_HOME_ID);
      next = applyDutySave(
        next,
        {
          title: sanitizeText(action.title, TEXT_LIMITS.title),
          notes: sanitizeText(action.notes ?? "", TEXT_LIMITS.notes),
          room,
          nodeId: room,
          nodeType: "room",
          audience: "me",
          effort: "medium",
          priority: "medium",
          frequency,
          kind: "chore",
          weekday: now.getDay(),
          monthDay: now.getDate(),
          dueDate: frequency === "once" ? toISODate(now) : null,
          supplyAutomation: undefined,
        },
        now,
      );
    } else if (action.kind === "logPurchase" && action.amount !== undefined && action.amount > 0) {
      next = applyLogPurchase(
        next,
        {
          actualCost: action.amount,
          completedOn: action.date ?? toISODate(now),
          label: sanitizeText(action.label, TEXT_LIMITS.title),
          kind: "task",
        },
        now,
      );
    }
  }
  return next;
}
