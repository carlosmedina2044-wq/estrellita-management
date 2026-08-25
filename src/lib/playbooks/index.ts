import playbookSeed from "@/lib/playbooks/playbooks.json";
import { deriveClimate } from "@/lib/climate";
import { lastCompletion } from "@/lib/duties";
import { EXTERIOR_ID, WHOLE_HOME_ID } from "@/lib/home-model";
import { normalizeAssetType } from "@/lib/asset-catalog";
import type {
  Duty,
  DutyCaution,
  HomeAttributes,
  Household,
  NodeType,
  PlaybookSeason,
  RoomType,
  Tenure,
} from "@/lib/types";

export type PlaybookTaskDef = {
  title: string;
  description?: string;
  nodeType: "home" | "exterior" | "roomType" | "assetType";
  target?: string;
  estimatedMinutes?: number;
  estimatedCost?: number;
  isDiy?: boolean;
  consumables?: string[];
  caution?: DutyCaution;
};

export type Playbook = {
  id: string;
  name: string;
  season: PlaybookSeason;
  climateZones: string[] | "all";
  tenure?: Tenure;
  requires?: Partial<HomeAttributes>;
  triggerMonth?: number;
  /** First month the playbook is worth starting (1-12). Defaults to triggerMonth - 1. */
  earlyMonth?: number;
  /** Last month it is still worth doing this year (1-12). May be < earlyMonth when the window wraps the year end. Defaults to triggerMonth + 2. */
  lateMonth?: number;
  /** One sentence on why this matters / cost of neglect. Shown on the card. */
  why?: string;
  tasks: PlaybookTaskDef[];
};

type PlaybookFile = { contentVersion: string; playbooks: Playbook[] } | Playbook[];

function playbooksFromSeed(seed: PlaybookFile): { version: string; playbooks: Playbook[] } {
  if (Array.isArray(seed)) return { version: "2026.08.24", playbooks: seed };
  return { version: seed.contentVersion, playbooks: seed.playbooks };
}

const loaded = playbooksFromSeed(playbookSeed as PlaybookFile);
export const PLAYBOOK_CONTENT_VERSION = loaded.version;
export const PLAYBOOKS = loaded.playbooks;

export function taskKey(playbookId: string, title: string): string {
  return `${playbookId}:${title}`;
}

export function attributesMatch(requires: Partial<HomeAttributes> | undefined, attributes: HomeAttributes): boolean {
  if (!requires) return true;
  return (Object.entries(requires) as [keyof HomeAttributes, HomeAttributes[keyof HomeAttributes]][]).every(
    ([key, value]) => attributes[key] === value,
  );
}

export function playbookApplies(
  playbook: Playbook,
  household: Pick<Household, "location" | "attributes" | "tenure">,
): boolean {
  const zone = deriveClimate(household.location);
  const climateOk = playbook.climateZones === "all" || playbook.climateZones.includes(zone);
  const tenureOk = !playbook.tenure || playbook.tenure === household.tenure;
  return climateOk && attributesMatch(playbook.requires, household.attributes) && tenureOk;
}

/** Maps any integer onto 1–12 (0→12, 13→1). */
export function wrapMonth(m: number): number {
  return ((((m - 1) % 12) + 12) % 12) + 1;
}

export type PlaybookWindow = { early: number; ideal: number; late: number } | null;

export function windowFor(playbook: Playbook): PlaybookWindow {
  if (playbook.triggerMonth == null) return null;
  const ideal = playbook.triggerMonth;
  const early = playbook.earlyMonth ?? wrapMonth(ideal - 1);
  const late = playbook.lateMonth ?? wrapMonth(ideal + 2);
  return { early, ideal, late };
}

export function monthInWindow(month: number, window: NonNullable<PlaybookWindow>): boolean {
  if (window.early <= window.late) return month >= window.early && month <= window.late;
  return month >= window.early || month <= window.late;
}

function monthsInWindow(window: NonNullable<PlaybookWindow>): number[] {
  const months: number[] = [];
  let month = window.early;
  while (true) {
    months.push(month);
    if (month === window.late) break;
    month = wrapMonth(month + 1);
  }
  return months;
}

export type WindowState = "get_ahead" | "ideal" | "late" | "closed";

export function windowState(playbook: Playbook, month: number): WindowState {
  const window = windowFor(playbook);
  if (!window) return "ideal";
  if (!monthInWindow(month, window)) return "closed";
  const months = monthsInWindow(window);
  const monthIdx = months.indexOf(month);
  const idealIdx = months.indexOf(window.ideal);
  if (monthIdx < idealIdx) return "get_ahead";
  if (monthIdx === idealIdx) return "ideal";
  return "late";
}

export function seasonYearFor(playbook: Playbook, now: Date = new Date()): number {
  const window = windowFor(playbook);
  const year = now.getFullYear();
  if (!window || window.early <= window.late) return year;
  const month = now.getMonth() + 1;
  if (month <= window.late) return year - 1;
  return year;
}

const WINDOW_SORT: Record<WindowState, number> = { late: 0, ideal: 1, get_ahead: 2, closed: 3 };

export function matchingPlaybooks(
  household: Pick<Household, "location" | "attributes" | "playbookDecisions" | "tenure">,
  now: Date = new Date(),
): Array<{ playbook: Playbook; state: WindowState; decided: boolean }> {
  const month = now.getMonth() + 1;
  const matched: Array<{ playbook: Playbook; state: WindowState; decided: boolean }> = [];
  for (const playbook of PLAYBOOKS) {
    if (!playbookApplies(playbook, household)) continue;
    const state = windowState(playbook, month);
    if (state === "closed") continue;
    const year = seasonYearFor(playbook, now);
    const decision = household.playbookDecisions.find(
      (item) => item.playbookId === playbook.id && item.year === year,
    );
    if (decision?.disabled) continue;
    matched.push({ playbook, state, decided: Boolean(decision) });
  }
  return matched.sort((a, b) => {
    const byState = WINDOW_SORT[a.state] - WINDOW_SORT[b.state];
    if (byState !== 0) return byState;
    return (a.playbook.triggerMonth ?? 0) - (b.playbook.triggerMonth ?? 0);
  });
}

export function playbookProgress(
  household: Pick<Household, "duties" | "completions">,
  playbookId: string,
  seasonYear: number,
): { done: number; total: number; nextTitle: string | null } {
  const duties = household.duties.filter(
    (duty) => duty.playbookId === playbookId && new Date(duty.createdAt).getFullYear() >= seasonYear,
  );
  const done = duties.filter((duty) => lastCompletion(duty.id, household.completions)).length;
  const next = duties.find((duty) => !lastCompletion(duty.id, household.completions));
  return { done, total: duties.length, nextTitle: next?.title ?? null };
}

export type TimelineEntryState = "done" | "in_progress" | "planned" | "declined" | "open";

export type TimelineMonth = {
  month: number;
  year: number;
  label: string;
  entries: Array<{ playbook: Playbook; state: TimelineEntryState }>;
};

function timelineLabel(month: number, year: number, nowYear: number): string {
  const short = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "short" });
  if (year === nowYear) return short;
  return `${short} ’${String(year).slice(-2)}`;
}

function timelineEntryState(
  household: Household,
  playbook: Playbook,
  occurrenceYear: number,
  occurrenceMonth: number,
): TimelineEntryState {
  const seasonYear = seasonYearFor(playbook, new Date(occurrenceYear, occurrenceMonth - 1, 15));
  const decision = household.playbookDecisions.find(
    (item) => item.playbookId === playbook.id && item.year === seasonYear,
  );
  if (decision?.disabled) return "declined";
  if (decision) {
    const progress = playbookProgress(household, playbook.id, seasonYear);
    if (progress.done === progress.total && progress.total > 0) return "done";
    if (progress.total > 0) return "in_progress";
    return "planned";
  }
  return "open";
}

export function seasonalTimeline(household: Household, now: Date = new Date()): TimelineMonth[] {
  const months: TimelineMonth[] = [];
  for (let offset = 0; offset < 12; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const entries: TimelineMonth["entries"] = [];
    for (const playbook of PLAYBOOKS) {
      if (!playbookApplies(playbook, household)) continue;
      const window = windowFor(playbook);
      if (!window || month !== window.ideal) continue;
      entries.push({
        playbook,
        state: timelineEntryState(household, playbook, year, month),
      });
    }
    months.push({
      month,
      year,
      label: timelineLabel(month, year, now.getFullYear()),
      entries,
    });
  }
  return months;
}

export function resolvePlaybookTarget(
  household: Pick<Household, "rooms" | "assets">,
  task: PlaybookTaskDef,
): { nodeId: string; nodeType: NodeType; room: string } {
  if (task.nodeType === "home") {
    return { nodeId: WHOLE_HOME_ID, nodeType: "home", room: WHOLE_HOME_ID };
  }
  if (task.nodeType === "exterior") {
    return { nodeId: EXTERIOR_ID, nodeType: "room", room: EXTERIOR_ID };
  }
  if (task.nodeType === "roomType" && task.target) {
    const room = household.rooms.find((item) => item.type === (task.target as RoomType) && !item.system);
    if (room) return { nodeId: room.id, nodeType: "room", room: room.id };
    return { nodeId: WHOLE_HOME_ID, nodeType: "home", room: WHOLE_HOME_ID };
  }
  if (task.nodeType === "assetType" && task.target) {
    const type = normalizeAssetType(task.target);
    const asset = household.assets.find((item) => normalizeAssetType(item.type) === type);
    if (asset) return { nodeId: asset.id, nodeType: "asset", room: asset.roomId };
    if (type === "dryer" || type === "washer") {
      const laundry = household.rooms.find((room) => room.type === "laundry");
      if (laundry) return { nodeId: laundry.id, nodeType: "room", room: laundry.id };
    }
    return { nodeId: WHOLE_HOME_ID, nodeType: "home", room: WHOLE_HOME_ID };
  }
  return { nodeId: WHOLE_HOME_ID, nodeType: "home", room: WHOLE_HOME_ID };
}

export function dutyFromPlaybookTask(
  household: Pick<Household, "rooms" | "assets">,
  playbook: Playbook,
  task: PlaybookTaskDef,
  dueDate: string,
  origin: Duty["origin"] = "playbook",
): Omit<Duty, "id" | "createdAt"> {
  const target = resolvePlaybookTarget(household, task);
  return {
    title: task.title,
    notes: task.description ?? "",
    room: target.room,
    nodeId: target.nodeId,
    nodeType: target.nodeType,
    audience: "me",
    effort: (task.estimatedMinutes ?? 20) > 40 ? "large" : (task.estimatedMinutes ?? 20) > 15 ? "medium" : "small",
    frequency: "once",
    kind: "chore",
    weekday: 0,
    monthDay: 1,
    dueDate,
    priority: "medium",
    archived: false,
    estimatedCost: task.estimatedCost,
    isDiy: task.isDiy,
    estimatedMinutes: task.estimatedMinutes,
    origin,
    playbookId: playbook.id,
    caution: task.caution,
  };
}
