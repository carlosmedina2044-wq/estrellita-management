"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { tDutyTitle } from "@/i18n/content";
import { Check, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { dutySubtitle, installedAtFor } from "@/lib/duties";
import { prefersReducedMotion } from "@/lib/motion";
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
  exiting,
  onExitComplete,
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
  exiting?: boolean;
  onExitComplete?: () => void;
  onToggle: () => void;
  onOpen?: () => void;
}) {
  const { t } = useLocale();
  const reduceMotion = prefersReducedMotion();
  const shellRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const onExitCompleteRef = useRef(onExitComplete);
  const showDone = Boolean(done || exiting);
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

  useEffect(() => {
    onExitCompleteRef.current = onExitComplete;
  }, [onExitComplete]);

  useEffect(() => {
    if (!exiting) {
      const shell = shellRef.current;
      const path = pathRef.current;
      if (shell) {
        shell.style.height = "";
        shell.style.opacity = "";
        shell.style.transition = "";
      }
      if (path) {
        path.style.strokeDashoffset = "1";
        path.style.transition = "none";
      }
      return;
    }
    if (reduceMotion) {
      const timer = window.setTimeout(() => onExitCompleteRef.current?.(), 0);
      return () => window.clearTimeout(timer);
    }
    const shell = shellRef.current;
    const path = pathRef.current;
    if (!shell) return;
    const height = shell.offsetHeight;
    shell.style.height = `${height}px`;
    shell.style.opacity = "1";
    if (path) {
      path.style.strokeDashoffset = "1";
      path.style.transition = "none";
      window.requestAnimationFrame(() => {
        path.style.transition = "stroke-dashoffset 200ms ease-out";
        path.style.strokeDashoffset = "0";
      });
    }
    const collapseTimer = window.setTimeout(() => {
      shell.style.transition =
        "height 220ms cubic-bezier(0.32,0.72,0,1), opacity 220ms ease-out";
      shell.style.height = "0px";
      shell.style.opacity = "0";
    }, 200 + 300);
    const doneTimer = window.setTimeout(() => onExitCompleteRef.current?.(), 200 + 300 + 220);
    return () => {
      window.clearTimeout(collapseTimer);
      window.clearTimeout(doneTimer);
    };
  }, [exiting, reduceMotion]);

  return (
    <div ref={shellRef} className="overflow-hidden">
      <div className={cn("flex items-stretch bg-transparent px-2 py-1", showDone && "opacity-60")}>
        <button
          type="button"
          onClick={onToggle}
          className="flex size-11 shrink-0 items-center justify-center text-primary active:bg-foreground/6"
          aria-label={showDone ? t("chore.undoAria", { title }) : t("chore.completeAria", { title })}
        >
          {showDone ? (
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {exiting && !done ? (
                <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden>
                  <path
                    ref={pathRef}
                    d="M5 13l4 4L19 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={1}
                    style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
                  />
                </svg>
              ) : (
                <Check className="size-3.5" />
              )}
            </span>
          ) : (
            <Circle className="size-6 stroke-[2.2] text-foreground/55" />
          )}
        </button>
        <button
          type="button"
          onClick={onOpen}
          disabled={!onOpen || exiting}
          className="flex min-w-0 flex-1 items-center py-2.5 pr-3 text-left active:bg-foreground/6"
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "ui-card font-medium leading-snug",
                  showDone && "text-muted-foreground line-through",
                )}
              >
                {title}
              </span>
              {duty.audience === "cleaner" && !showDone ? (
                <Badge variant="secondary" className={CHIP}>
                  {t("audience.cleaner")}
                </Badge>
              ) : null}
              {statusChip && !showDone ? (
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
        {partChip && !showDone && partChip.kind === "order_first" ? (
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
    </div>
  );
}
