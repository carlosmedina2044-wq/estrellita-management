"use client";

import { useMemo } from "react";
import { useLocale } from "@/i18n/locale-provider";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatMonthTitle, sameDay, startOfMonth, startOfWeek, toISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function DayCalendar({
  month,
  selected,
  today,
  marks,
  onSelect,
  onMonthChange,
}: {
  month: Date;
  selected: Date;
  today: Date;
  marks?: Set<string>;
  onSelect: (date: Date) => void;
  onMonthChange: (date: Date) => void;
}) {
  const { t, dateLocale } = useLocale();
  const weekdays = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(dateLocale, { weekday: "short" });
    // 2026-09-13 is a Sunday — walk one week for locale-aware abbreviations.
    const sunday = new Date(2026, 8, 13);
    return Array.from({ length: 7 }, (_, index) => formatter.format(addDays(sunday, index)));
  }, [dateLocale]);
  const start = startOfWeek(startOfMonth(month));
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));

  return (
    <div className="rounded-2xl bg-card px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className="flex size-11 items-center justify-center text-primary"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          aria-label={t("calendar.prevMonth")}
        >
          <ChevronLeft className="size-5" />
        </button>
        <p className="ui-heading ui-card font-semibold">{formatMonthTitle(month)}</p>
        <button
          type="button"
          className="flex size-11 items-center justify-center text-primary"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          aria-label={t("calendar.nextMonth")}
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {weekdays.map((day, index) => (
          <p
            key={`${day}-${index}`}
            className="py-1 text-center ui-caption font-medium text-muted-foreground"
          >
            {day}
          </p>
        ))}
        {days.map((day) => {
          const inMonth = day.getMonth() === month.getMonth();
          const isSelected = sameDay(day, selected);
          const isToday = sameDay(day, today);
          const iso = toISODate(day);
          const hasDone = Boolean(marks?.has(iso));
          const dayLabel = String(day.getDate());
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(day)}
              aria-label={hasDone ? `${dayLabel}. ${t("calendar.hasDone")}` : dayLabel}
              className={cn(
                "relative mx-auto flex size-11 items-center justify-center rounded-full ui-body",
                !inMonth && "text-muted-foreground/40",
                isSelected && "bg-primary font-semibold text-primary-foreground",
                !isSelected && isToday && "font-semibold text-primary",
              )}
            >
              {day.getDate()}
              {hasDone ? (
                <span
                  className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-done"
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
