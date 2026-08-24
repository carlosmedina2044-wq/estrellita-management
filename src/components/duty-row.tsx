"use client";

import { Check, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { dutySubtitle, installedAtFor } from "@/lib/duties";
import type { Duty, Household } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DutyRow({
  duty,
  household,
  now,
  done,
  overdue,
  upcoming,
  onToggle,
  onOpen,
}: {
  duty: Duty;
  household?: Household;
  now?: Date;
  done?: boolean;
  overdue?: boolean;
  upcoming?: boolean;
  onToggle: () => void;
  onOpen?: () => void;
}) {
  const subtitle = household
    ? dutySubtitle(duty, household.completions, now, installedAtFor(household, duty.id), household)
    : dutySubtitle(duty);

  return (
    <div className={cn("flex items-stretch bg-transparent px-2 py-1", done && "opacity-60")}>
      <button
        type="button"
        onClick={onToggle}
        className="flex size-11 shrink-0 items-center justify-center text-primary"
        aria-label={done ? `Undo ${duty.title}` : `Complete ${duty.title}`}
      >
        {done ? (
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3.5" />
          </span>
        ) : (
          <Circle className={cn("size-6 stroke-[1.6]", overdue ? "text-destructive" : "text-black/20")} />
        )}
      </button>
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="flex min-w-0 flex-1 items-center py-2.5 pr-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "text-[17px] font-medium leading-snug",
                done && "text-muted-foreground line-through",
              )}
            >
              {duty.title}
            </span>
            {duty.audience === "cleaner" && !done ? (
              <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px] font-medium">
                Cleaner
              </Badge>
            ) : null}
            {overdue ? (
              <Badge variant="destructive" className="h-5 rounded-full px-1.5 text-[10px] font-medium">
                Overdue
              </Badge>
            ) : upcoming ? (
              <Badge variant="outline" className="h-5 rounded-full px-1.5 text-[10px] font-medium">
                Upcoming
              </Badge>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{subtitle}</span>
          {duty.notes.trim() ? (
            <span className="mt-1 block text-[13px] text-foreground/75">{duty.notes}</span>
          ) : null}
        </span>
      </button>
    </div>
  );
}
