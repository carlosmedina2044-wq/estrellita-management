import starterSeed from "@/lib/onboarding/starter-chores.json";
import type { Duty } from "@/lib/types";

type TopicSource = {
  title?: string;
  topic?: string;
};

export const STARTER_TOPICS: Record<string, string> = Object.fromEntries(
  (starterSeed as { title: string; topic: string }[]).map((item) => [item.title, item.topic]),
);

/** Explicit playbook `task.topic`, then the starter title map. No fuzzy match. */
export function dutyTopic(duty: Pick<Duty, "title">, task?: TopicSource): string | null {
  if (task?.topic) return task.topic;
  const fromDuty = STARTER_TOPICS[duty.title];
  if (fromDuty) return fromDuty;
  if (task?.title) return STARTER_TOPICS[task.title] ?? null;
  return null;
}

export function activeTopics(duties: Duty[]): Set<string> {
  const topics = new Set<string>();
  for (const duty of duties) {
    if (duty.archived || duty.frequency === "once") continue;
    const topic = dutyTopic(duty);
    if (topic) topics.add(topic);
  }
  return topics;
}

export function dedupePlaybookTasks<T extends TopicSource>(tasks: T[], existing: Duty[]): T[] {
  const taken = activeTopics(existing);
  return tasks.filter((task) => {
    const topic = dutyTopic({ title: task.title ?? "" }, task);
    return !topic || !taken.has(topic);
  });
}
