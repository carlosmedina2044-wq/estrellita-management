"use client";

import { useState } from "react";
import { Check, ChevronDown, Timer, X } from "lucide-react";
import { toast } from "sonner";
import { IllustratedMoment } from "@/components/illustrated-moment";
import { Button } from "@/components/ui/button";
import { tDutyTitle } from "@/i18n/content";
import { useLocale } from "@/i18n/locale-provider";
import type { PowerHourApi } from "@/hooks/use-power-hour";
import { roomName } from "@/lib/home-model";
import { hapticPress } from "@/lib/native/haptics";
import { shareText as nativeShare } from "@/lib/native/share";
import { dutyMinutes, formatCountdown, POWER_HOUR_LENGTHS, remainingMs, type PowerHourPlan } from "@/lib/power-hour";
import type { Household } from "@/lib/types";
import { cn } from "@/lib/utils";

type Translate = ReturnType<typeof useLocale>["t"];

function planLine(t: Translate, plan: PowerHourPlan): string {
  return plan.count === 1
    ? t("powerHour.planOne", { minutes: plan.minutes })
    : t("powerHour.planMany", { count: plan.count, minutes: plan.minutes });
}

/** The quiet row on Today. It leads with how many things the default hour
 * would take on, and is absent when nothing is left. */
export function PowerHourEntry({ plan, onOpen }: { plan: PowerHourPlan; onOpen: () => void }) {
  const { t } = useLocale();
  if (plan.count === 0) return null;
  return (
    <button
      type="button"
      onClick={() => {
        void hapticPress();
        onOpen();
      }}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left ui-press"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
        <Timer className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block ui-body font-medium">{t("powerHour.start")}</span>
        <span className="num block ui-caption text-muted-foreground">{planLine(t, plan)}</span>
      </span>
    </button>
  );
}

/** Everything that happens full screen: choosing the length, the hour itself,
 * and how it went. Renders nothing while closed. */
export function PowerHourOverlay({ hour, household }: { hour: PowerHourApi; household: Household }) {
  const { t } = useLocale();
  const { phase } = hour;
  if (phase === "closed") return null;
  return (
    <div
      key={phase}
      role="dialog"
      aria-modal="true"
      aria-label={t("powerHour.title")}
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-background"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      {phase === "choosing" ? <Choosing hour={hour} /> : null}
      {phase === "running" ? <Running hour={hour} household={household} /> : null}
      {phase === "summary" ? <Summary hour={hour} /> : null}
    </div>
  );
}

function Choosing({ hour }: { hour: PowerHourApi }) {
  const { t } = useLocale();
  const { plan } = hour;
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="ui-title font-semibold">{t("powerHour.title")}</h2>
        <button
          type="button"
          aria-label={t("common.close")}
          onClick={hour.closeChooser}
          className="flex size-11 items-center justify-center rounded-full bg-secondary ui-press"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div>
        <p className="mb-2 px-1 ui-caption font-medium text-muted-foreground">{t("powerHour.lengthLabel")}</p>
        <div role="radiogroup" aria-label={t("powerHour.lengthLabel")} className="grid grid-cols-3 gap-2">
          {POWER_HOUR_LENGTHS.map((minutes) => {
            const selected = hour.length === minutes;
            return (
              <button
                key={minutes}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  void hapticPress();
                  hour.setLength(minutes);
                }}
                className={cn(
                  "num min-h-12 rounded-2xl px-2 ui-body font-semibold ui-press",
                  selected ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                )}
              >
                {t("powerHour.lengthOption", { minutes })}
              </button>
            );
          })}
        </div>
      </div>

      {plan.count === 0 ? (
        <p className="ui-body text-muted-foreground">{t("powerHour.nothing")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="num ui-title font-semibold">{planLine(t, plan)}</p>
          <ul className="ui-group">
            {plan.duties.slice(0, 5).map((duty) => (
              <li key={duty.id} className="ui-group-row px-4 py-3 ui-body">
                {tDutyTitle(duty.title)}
              </li>
            ))}
          </ul>
          {plan.count > 5 ? (
            <p className="px-1 ui-caption text-muted-foreground">
              {t("powerHour.thenMore", { count: plan.count - 5 })}
            </p>
          ) : null}
        </div>
      )}

      <div className="sticky bottom-0 -mx-5 mt-auto bg-background px-5 pb-1 pt-2">
        <Button className="h-14 w-full rounded-full ui-body" disabled={plan.count === 0} onClick={hour.start}>
          {t("powerHour.begin")}
        </Button>
      </div>
    </div>
  );
}

function Running({ hour, household }: { hour: PowerHourApi; household: Household }) {
  const { t } = useLocale();
  const [showRest, setShowRest] = useState(false);
  const { session, next, rest } = hour;
  if (!session) return null;
  const time = formatCountdown(remainingMs(session, hour.nowMs));
  const doneIds = new Set(session.doneIds);
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="num ui-title font-semibold">{t("common.leftCount", { count: hour.left })}</p>
          <p
            className="num mt-1 text-[3.5rem] font-semibold leading-none tracking-tight"
            aria-label={t("powerHour.timeLeft", { time })}
          >
            {time}
          </p>
        </div>
        <Button
          variant="ghost"
          className="h-11 shrink-0 rounded-full px-3 text-muted-foreground"
          onClick={hour.end}
        >
          {t("powerHour.endEarly")}
        </Button>
      </div>

      <div
        role="img"
        aria-label={t("powerHour.progressAria", { done: session.doneIds.length, total: hour.total })}
        className="flex gap-1"
      >
        {session.dutyIds.map((id) => (
          <span
            key={id}
            className={cn(
              "h-1.5 min-w-0 flex-1 rounded-full motion-safe:transition-colors",
              doneIds.has(id) ? "bg-primary" : "bg-foreground/15",
            )}
          />
        ))}
      </div>

      {next ? (
        <section className="flex flex-col gap-4 rounded-3xl bg-card px-5 py-5">
          <div className="min-w-0">
            <p className="ui-caption font-medium text-muted-foreground">{t("powerHour.nextUp")}</p>
            <p className="ui-heading mt-1 text-[1.5rem] font-semibold leading-tight">{tDutyTitle(next.title)}</p>
            <p className="mt-1 ui-caption text-muted-foreground">
              {roomName(household, next.room)} · {t("today.effort", { minutes: dutyMinutes(next) })}
            </p>
          </div>
          <Button className="h-14 w-full rounded-full ui-body" onClick={() => hour.done(next)}>
            <Check className="size-5" aria-hidden />
            {t("common.done")}
          </Button>
          <Button
            variant="ghost"
            className="h-11 w-full rounded-full text-muted-foreground"
            onClick={() => hour.skip(next)}
          >
            {t("common.skip")}
          </Button>
        </section>
      ) : null}

      {rest.length > 0 ? (
        <div>
          <button
            type="button"
            aria-expanded={showRest}
            onClick={() => setShowRest((current) => !current)}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl px-1 ui-body font-medium text-muted-foreground ui-press"
          >
            <span>{t("powerHour.thenMore", { count: rest.length })}</span>
            <ChevronDown
              className={cn("size-4 motion-safe:transition-transform", showRest ? "rotate-180" : null)}
              aria-hidden
            />
          </button>
          {showRest ? (
            <ul className="ui-group mt-1">
              {rest.map((duty) => (
                <li key={duty.id} className="ui-group-row px-4 py-3 ui-body">
                  {tDutyTitle(duty.title)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <Button
        variant="ghost"
        className="mt-auto h-11 w-full rounded-full text-primary"
        onClick={hour.extend}
      >
        {t("powerHour.extend")}
      </Button>
    </div>
  );
}

function Summary({ hour }: { hour: PowerHourApi }) {
  const { t } = useLocale();
  const { summary } = hour;
  if (!summary) return null;
  const headline =
    hour.dayClosed && summary.done > 0
      ? t("powerHour.allDone")
      : hour.ending === "timesup"
        ? t("powerHour.timesUp", { count: summary.done })
        : t("powerHour.doneIn", { count: summary.done, minutes: summary.minutes });
  const detail =
    hour.dayClosed && summary.done > 0
      ? t("powerHour.doneIn", { count: summary.done, minutes: summary.minutes })
      : hour.todayLeft > 0
        ? t("powerHour.leftToday", { count: hour.todayLeft })
        : null;
  const canExtend = hour.ending === "timesup" && hour.left > 0;

  async function share() {
    const result = await nativeShare(
      t("powerHour.shareTitle"),
      t("powerHour.shareText", { count: summary?.done ?? 0, minutes: summary?.minutes ?? 0 }),
    );
    if (result === "failed") toast.error(t("share.failedList"));
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-5 px-5 pt-10 text-center">
      {hour.dayClosed && summary.done > 0 ? (
        <div className="flex size-24 items-center justify-center">
          <IllustratedMoment kind="shelf-scene" size={96} loop={false} autoplay />
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <h2 className="num text-[2rem] font-semibold leading-tight">{headline}</h2>
        {detail ? <p className="num ui-body text-muted-foreground">{detail}</p> : null}
      </div>
      <div className="mt-auto flex w-full flex-col gap-2">
        {canExtend ? (
          <Button variant="secondary" className="h-12 w-full rounded-full" onClick={hour.extend}>
            {t("powerHour.extend")}
          </Button>
        ) : null}
        {summary.done > 0 ? (
          <Button variant="ghost" className="h-11 w-full rounded-full text-primary" onClick={() => void share()}>
            {t("today.ceremonyShare")}
          </Button>
        ) : null}
        <Button className="h-14 w-full rounded-full ui-body" onClick={hour.dismiss}>
          {t("common.close")}
        </Button>
      </div>
    </div>
  );
}
