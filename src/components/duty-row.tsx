"use client";

import { Check, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { dutySubtitle, installedAtFor } from "@/lib/duties";
import type { Duty, Household } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHIP = "h-5 rounded-full px-1.5 text-[11px] font-medium";

export function DutyRow({
  duty,
  household,
  now,
  done,
  overdue,
  upcoming,
  partChip,
  onPartChip,
  missingPartHint,
  onToggle,
  onOpen,
}: {
  duty: Duty;
  household?: Household;
  now?: Date;
  done?: boolean;
  overdue?: boolean;
  upcoming?: boolean;
  partChip?: { kind: string; label: string } | null;
  onPartChip?: () => void;
  missingPartHint?: boolean;
  onToggle: () => void;
  onOpen?: () => void;
}) {
  let subtitle = missingPartHint
    ? "No part on hand. Order first, or mark done if you already have it."
    : household
      ? dutySubtitle(duty, household.completions, now, installedAtFor(household, duty.id), household, overdue)
      : dutySubtitle(duty, [], now, undefined, undefined, overdue);
  if (
    overdue &&
    (partChip?.kind === "install_today" || partChip?.kind === "part_on_hand")
  ) {
    subtitle = `Supplies on hand · ${subtitle}`;
  }

  const statusChip = overdue
    ? { label: "Overdue", className: "", destructive: true }
    : partChip && partChip.kind === "arriving"
      ? { label: partChip.label, className: "bg-secondary text-muted-foreground" }
      : partChip && partChip.kind === "install_today"
        ? { label: partChip.label, className: "bg-success/15 text-success" }
        : upcoming
          ? { label: "Upcoming", className: "bg-secondary text-muted-foreground" }
          : null;

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
          <Circle className="size-6 stroke-[1.6] text-foreground/20" />
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
              <Badge variant="secondary" className={CHIP}>
                Cleaner
              </Badge>
            ) : null}
            {statusChip && !done ? (
              statusChip.destructive ? (
                <Badge variant="destructive" className={CHIP}>
                  {statusChip.label}
                </Badge>
              ) : (
                <Badge variant="secondary" className={cn(CHIP, statusChip.className)}>
                  {statusChip.label}
                </Badge>
              )
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{subtitle}</span>
          {duty.notes.trim() ? (
            <span className="mt-1 block text-[13px] text-foreground/75">{duty.notes}</span>
          ) : null}
        </span>
      </button>
      {partChip && !done && partChip.kind === "order_first" ? (
        <button
          type="button"
          onClick={onPartChip}
          className="self-center pr-3"
        >
          <Badge variant="secondary" className={CHIP}>
            {partChip.label}
          </Badge>
        </button>
      ) : null}
    </div>
  );
}
