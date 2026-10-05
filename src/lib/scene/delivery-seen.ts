const STORAGE_KEY = "cuidala.deliveriesWalked";
const KEEP = 40;

/** Kept in memory as well, so a blocked or cleared localStorage still gives
 * one walk per arrival for as long as the app stays open. */
const memory = new Set<string>();

function readStored(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/** The arrivals the courier has already walked up for. */
export function walkedArrivals(): ReadonlySet<string> {
  return new Set([...readStored(), ...memory]);
}

/** Record that an arrival has had its walk, so no scene plays it again. */
export function markArrivalWalked(key: string): void {
  memory.add(key);
  try {
    const next = [...readStored().filter((item) => item !== key), key].slice(-KEEP);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private window or blocked storage: the in-memory set still holds.
  }
}
