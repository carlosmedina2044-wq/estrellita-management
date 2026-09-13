"use client";

import { useLocale } from "@/i18n/locale-provider";
import { tDutyTitle } from "@/i18n/content";
import { Check, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { dutySubtitle, installedAtFor } from "@/lib/duties";
import type { Duty, Household } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHIP = "h-5 rounded-full px-1.5 ui-caption font-medium";

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
  hideOverdueChip,
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
  hideOverdueChip?: boolean;
  onToggle: () => void;
  onOpen?: () => void;
}) {
  const { t } = useLocale();
  const title = tDutyTitle(duty.title);
  let subtitle = missingPartHint
    ? t("chore.noPart")
    : household
      ? dutySubtitle(duty, household.completions, now, installedAtFor(household, duty.id), household, overdue)
      : dutySubtitle(duty, [], now, undefined, undefined, overdue);
  if (
    overdue &&
    (partChip?.kind === "install_today" || partChip?.kind === "part_on_hand")
  ) {
    subtitle = t("chore.suppliesOnHand", { subtitle });
  }

  const statusChip = overdue && !hideOverdueChip
    ? { label: t("chore.overdue"), className: "", destructive: true }
    : partChip && partChip.kind === "arriving"
      ? { label: partChip.label, className: "bg-secondary text-muted-foreground" }
      : partChip && partChip.kind === "install_today"
        ? { label: partChip.label, className: "bg-success/15 text-success" }
        : upcoming
          ? { label: t("chore.upcoming"), className: "bg-secondary text-muted-foreground" }
          : null;

  return (
    <div className={cn("flex items-stretch bg-transparent px-2 py-1", done && "opacity-60")}>
      <button
        type="button"
        onClick={onToggle}
        className="flex size-11 shrink-0 items-center justify-center text-primary"
        aria-label={done ? t("chore.undoAria", { title }) : t("chore.completeAria", { title })}
      >
        {done ? (
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3.5" />
          </span>
        ) : (
          <Circle className="size-6 stroke-[2.2] text-foreground/55" />
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
                "ui-card font-medium leading-snug",
                done && "text-muted-foreground line-through",
              )}
            >
              {title}
            </span>
            {duty.audience === "cleaner" && !done ? (
              <Badge variant="secondary" className={CHIP}>
                {t("audience.cleaner")}
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
          <span className="mt-0.5 block truncate ui-caption text-muted-foreground">{subtitle}</span>
        </span>
      </button>
      {partChip && !done && partChip.kind === "order_first" ? (
        <button
          type="button"
          onClick={onPartChip}
          className="flex min-h-11 items-center self-center pr-3"
        >
          <Badge variant="secondary" className={cn(CHIP, "h-11 px-3")}>
            {partChip.label}
          </Badge>
        </button>
      ) : null}
    </div>
  );
}
