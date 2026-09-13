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
        <h2 className="ui-heading text-[20px] font-semibold">This season</h2>
        <button
          type="button"
          className="text-[13px] font-medium text-primary"
          onClick={() => onNavigate?.({ tab: "seasonal" })}
        >
          See the year
        </button>
      </div>
      <ul className="mt-3 grid gap-2">
        {model.fires.map((fire) => (
          <li key={`${fire.name}-${fire.firedAt}`} className="text-[15px]">
            {fire.name} — {fire.taskCount} task{fire.taskCount === 1 ? "" : "s"} added to Today
          </li>
        ))}
        {model.open.map((entry) => (
          <li key={entry.playbook.id} className="flex items-baseline justify-between gap-3 text-[15px]">
            <span className="min-w-0 truncate font-medium">{entry.playbook.name}</span>
            <span className="shrink-0 text-[13px] text-muted-foreground">
              {entry.done} of {entry.total} done
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
