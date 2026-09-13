"use client";

import { seasonSectionModel } from "@/lib/playbooks";
import type { AppNavigateTarget, Household } from "@/lib/types";

export function SeasonSection({
  household,
  now,
  onNavigate,
}: {
  household: Household;
  now: Date;
  onNavigate?: (target: AppNavigateTarget) => void;
}) {
  const model = seasonSectionModel(household, now);
  if (model.fires.length === 0 && model.open.length === 0) return null;

  return (
    <section className="rounded-2xl bg-card px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="ui-heading ui-card font-semibold">This season</h2>
        <button
          type="button"
          className="inline-flex min-h-11 items-center ui-caption font-medium text-primary"
          onClick={() => onNavigate?.({ tab: "seasonal" })}
        >
          See the year
        </button>
      </div>
      <ul className="mt-3 grid gap-2">
        {model.fires.map((fire) => (
          <li key={`${fire.name}-${fire.firedAt}`}>
            <button
              type="button"
              className="flex min-h-11 w-full items-center text-left ui-body"
              onClick={() => onNavigate?.({ tab: "seasonal" })}
            >
              {fire.name} — {fire.taskCount} task{fire.taskCount === 1 ? "" : "s"} added to Today
            </button>
          </li>
        ))}
        {model.open.map((entry) => (
          <li key={entry.playbook.id}>
            <button
              type="button"
              className="flex min-h-11 w-full items-baseline justify-between gap-3 text-left ui-body"
              onClick={() => onNavigate?.({ tab: "seasonal", playbookId: entry.playbook.id })}
            >
              <span className="min-w-0 truncate font-medium">{entry.playbook.name}</span>
              <span className="shrink-0 ui-caption text-muted-foreground">
                {entry.done} of {entry.total} done
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
