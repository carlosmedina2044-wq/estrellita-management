"use client";

import { ChevronRight } from "lucide-react";
import { DutyRow } from "@/components/duty-row";
import { isOverdueFor } from "@/lib/duties";
import { FLOORS } from "@/lib/house";
import type { Duty, Floor, Household, Room } from "@/lib/types";
import { cn } from "@/lib/utils";

const HEADING_STYLE = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
  fontFeatureSettings: '"liga" 0, "clig" 0, "dlig" 0, "calt" 0',
  fontVariantLigatures: "none" as const,
  fontVariantCaps: "normal" as const,
  letterSpacing: "-0.022em",
};

export function FloorDutyList({
  floor,
  groups,
  household,
  now,
  selectedId,
  detailOpen,
  onSelectRoom,
  onToggle,
  onOpenDuty,
}: {
  floor: Floor;
  groups: { id: Room; label: string; duties: Duty[] }[];
  household: Household;
  now: Date;
  selectedId: Room | null;
  detailOpen: boolean;
  onSelectRoom: (room: Room) => void;
  onToggle: (duty: Duty, completed: boolean) => void;
  onOpenDuty?: (duty: Duty) => void;
}) {
  const openCount = groups.reduce((sum, group) => sum + group.duties.length, 0);
  const floorLabel = FLOORS.find((item) => item.id === floor)?.label ?? "This floor";
  const title = openCount === 0 ? `${floorLabel} is clear` : "On this floor";

  return (
    <section>
      <header className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 className="ui-heading text-[22px] font-semibold leading-none" style={HEADING_STYLE}>
          {title}
        </h2>
        {openCount > 0 ? (
          <span className="text-[13px] font-medium text-muted-foreground">
            {openCount} job{openCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </header>

      {groups.length === 0 ? (
        <div className="ui-group px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing pending on this floor.
        </div>
      ) : (
        <div className="grid gap-5">
          {groups.map((group) => {
            const overdue = group.duties.filter((duty) => isOverdueFor(duty, household, now)).length;
            const active = selectedId === group.id && detailOpen;
            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => onSelectRoom(group.id)}
                  className="mb-2 flex w-full items-center justify-between gap-3 px-1 text-left"
                >
                  <span
                    className={cn(
                      "text-[13px] font-semibold tracking-[0.04em] text-muted-foreground uppercase",
                      active && "text-primary",
                    )}
                  >
                    {group.label}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[13px] text-muted-foreground">
                    {overdue > 0 ? <span className="font-medium text-[#ff3b30]">Due</span> : null}
                    <span>
                      {group.duties.length} open
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground/70" />
                  </span>
                </button>
                <div className="ui-group">
                  {group.duties.map((duty) => (
                    <div key={duty.id} className="ui-group-row">
                      <DutyRow
                        duty={duty}
                        household={household}
                        now={now}
                        overdue={isOverdueFor(duty, household, now)}
                        onToggle={() => onToggle(duty, false)}
                        onOpen={onOpenDuty ? () => onOpenDuty(duty) : undefined}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
