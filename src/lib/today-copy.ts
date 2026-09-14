import type { MessageKey } from "@/i18n";
import type { DayArcState } from "@/lib/momentum";

const OPEN_POOL: MessageKey[] = [
  "today.heroOpen1",
  "today.heroOpen2",
  "today.heroOpen3",
];
const CLOSED_POOL: MessageKey[] = [
  "today.heroClosed1",
  "today.heroClosed2",
  "today.heroClosed3",
];
const CLEAR_POOL: MessageKey[] = ["today.heroClear1", "today.heroClear2"];
const REST_POOL: MessageKey[] = ["today.heroRest1", "today.heroRest2"];

export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const now = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((now - start) / 86_400_000);
}

export function heroCopyKey(
  state: DayArcState,
  dayIndex: number,
  opts: { hasName: boolean; count: number },
): MessageKey {
  if (state === "open" && opts.count === 1) return "today.headlineOne";
  let pool: MessageKey[];
  if (state === "open") {
    pool = opts.hasName ? [...OPEN_POOL, "today.heroOpenNamed"] : OPEN_POOL;
  } else if (state === "closed") {
    pool = CLOSED_POOL;
  } else if (state === "clear") {
    pool = CLEAR_POOL;
  } else {
    pool = REST_POOL;
  }
  const index = ((dayIndex % pool.length) + pool.length) % pool.length;
  return pool[index];
}
