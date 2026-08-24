"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatMonthTitle, sameDay, startOfMonth, startOfWeek, toISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

export function DayCalendar({
  month,
  selected,
  today,
  onSelect,
  onMonthChange,
}: {
  month: Date;
  selected: Date;
  today: Date;
  onSelect: (date: Date) => void;
  onMonthChange: (date: Date) => void;
}) {
  const start = startOfWeek(startOfMonth(month));
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));

  return (
    <div className="rounded-2xl bg-white px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className="flex size-9 items-center justify-center text-primary"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-5" />
        </button>
        <p className="ui-heading text-[17px] font-semibold">{formatMonthTitle(month)}</p>
        <button
          type="button"
          className="flex size-9 items-center justify-center text-primary"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          aria-label="Next month"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAYS.map((day, index) => (
          <p
            key={`${day}-${index}`}
            className="py-1 text-center text-[11px] font-medium text-muted-foreground"
          >
            {day}
          </p>
        ))}
        {days.map((day) => {
          const inMonth = day.getMonth() === month.getMonth();
          const isSelected = sameDay(day, selected);
          const isToday = sameDay(day, today);
          return (
            <button
              key={toISODate(day)}
              type="button"
              onClick={() => onSelect(day)}
              className={cn(
                "mx-auto flex size-9 items-center justify-center rounded-full text-[15px]",
                !inMonth && "text-muted-foreground/40",
                isSelected && "bg-primary font-semibold text-primary-foreground",
                !isSelected && isToday && "font-semibold text-primary",
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
