import starterSeed from "@/lib/onboarding/starter-chores.json";
import playbookSeed from "@/lib/playbooks/playbooks.json";
import triggerSeed from "@/lib/weather/triggers.json";
import type { Completion, Duty } from "@/lib/types";

type TopicSource = {
  title?: string;
  topic?: string;
};

type SeedTask = { title: string; topic?: string };

export const STARTER_TOPICS: Record<string, string> = Object.fromEntries(
  (starterSeed as { title: string; topic: string }[]).map((item) => [item.title, item.topic]),
);

function playbookSeedTasks(): SeedTask[] {
  const seed = playbookSeed as { playbooks?: { tasks: SeedTask[] }[] } | { tasks: SeedTask[] }[];
  const list = Array.isArray(seed) ? seed : (seed.playbooks ?? []);
  return list.flatMap((entry) => entry.tasks);
}

function triggerSeedTasks(): SeedTask[] {
  return (triggerSeed as { tasks: SeedTask[] }[]).flatMap((entry) => entry.tasks);
}

/**
 * Catalog title -> topic across starters, seasonal playbooks and weather
 * triggers. Titles are already the stable English keys the catalog uses for
 * translation (`tDutyTitle`), so a duty created from any seed resolves to its
 * topic by title alone, without storing anything extra on the duty.
 */
export const CATALOG_TOPICS: Record<string, string> = Object.fromEntries(
  [
    ...(starterSeed as SeedTask[]),
    ...playbookSeedTasks(),
    ...triggerSeedTasks(),
  ]
    .filter((task) => Boolean(task.topic))
    .map((task) => [task.title, task.topic as string]),
);

/** Explicit `task.topic`, then the catalog title map. No fuzzy match. */
export function dutyTopic(duty: Pick<Duty, "title">, task?: TopicSource): string | null {
  if (task?.topic) return task.topic;
  const fromDuty = CATALOG_TOPICS[duty.title];
  if (fromDuty) return fromDuty;
  if (task?.title) return CATALOG_TOPICS[task.title] ?? null;
  return null;
}

/** Lower-case, accent-stripped, punctuation collapsed: the key two titles
 * share when they are the same chore spelled differently. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasCompletion(dutyId: string, completions: Completion[]): boolean {
  return completions.some((item) => item.dutyId === dutyId);
}

/**
 * A duty "holds" its topic while it is live: every non-archived recurring duty,
 * plus one-off (seasonal) duties that have not been done yet. A completed
 * one-off releases its topic so next year's window can offer the job again.
 */
function liveDuties(duties: Duty[], completions: Completion[]): Duty[] {
  return duties.filter((duty) => {
    if (duty.archived) return false;
    if (duty.frequency === "once") return !hasCompletion(duty.id, completions);
    return true;
  });
}

export function activeTopics(duties: Duty[], completions: Completion[] = []): Set<string> {
  const topics = new Set<string>();
  for (const duty of liveDuties(duties, completions)) {
    const topic = dutyTopic(duty);
    if (topic) topics.add(topic);
  }
  return topics;
}

function activeTitles(duties: Duty[], completions: Completion[]): Set<string> {
  const titles = new Set<string>();
  for (const duty of liveDuties(duties, completions)) {
    const key = normalizeTitle(duty.title);
    if (key) titles.add(key);
  }
  return titles;
}

/**
 * Splits a playbook's tasks into the ones worth adding and the ones the home
 * already covers. A task is dropped when a live duty holds its topic, or when
 * an earlier task in the same batch does. An untagged task fails closed: it is
 * let through only when no live duty shares its (normalized) title. Previously
 * an untagged task was always let through, and 45 of the 50 catalog tasks were
 * untagged, so the same filter change could be accepted five ways.
 */
export function splitPlaybookTasks<T extends TopicSource>(
  tasks: T[],
  existing: Duty[],
  completions: Completion[] = [],
): { keep: T[]; dropped: T[] } {
  const taken = activeTopics(existing, completions);
  const takenTitles = activeTitles(existing, completions);
  const keep: T[] = [];
  const dropped: T[] = [];
  for (const task of tasks) {
    const topic = dutyTopic({ title: task.title ?? "" }, task);
    if (topic) {
      if (taken.has(topic)) {
        dropped.push(task);
        continue;
      }
      taken.add(topic);
      keep.push(task);
      continue;
    }
    const key = normalizeTitle(task.title ?? "");
    if (!key || takenTitles.has(key)) {
      dropped.push(task);
      continue;
    }
    takenTitles.add(key);
    keep.push(task);
  }
  return { keep, dropped };
}

export function dedupePlaybookTasks<T extends TopicSource>(
  tasks: T[],
  existing: Duty[],
  completions: Completion[] = [],
): T[] {
  return splitPlaybookTasks(tasks, existing, completions).keep;
}
