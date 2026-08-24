"use client";

import { startOfDay } from "@/lib/dates";
import { roomName } from "@/lib/home-model";
import type { Household } from "@/lib/types";

export function LogView({ household }: { household: Household }) {
  const today = startOfDay(new Date());
  const todayCompletions = household.completions.filter(
    (item) => startOfDay(new Date(item.completedAt)) === today,
  );
  const mine = todayCompletions.filter((item) => item.actor === "me").length;
  const cleaner = todayCompletions.filter((item) => item.actor === "cleaner").length;
  const visits = [...household.visits].reverse();

  return (
    <div className="flex flex-col gap-5">
      <header className="pt-1">
        <p className="text-sm text-muted-foreground">{household.householdName}</p>
        <h1 className="ui-heading text-[34px] font-semibold tracking-tight">Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What got done, and whether it was you or the cleaner.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <Stat label="You today" value={String(mine)} />
        <Stat label="Cleaner today" value={String(cleaner)} />
      </section>

      <section className="grid gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Today
        </h2>
        {todayCompletions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Check something off on Home and it will show up here.
          </p>
        ) : (
          <div className="ui-group">
            {[...todayCompletions].reverse().map((item) => {
              const duty = household.duties.find((entry) => entry.id === item.dutyId);
              return (
                <div key={item.id} className="ui-group-row px-4 py-3">
                  <p className="text-[17px] font-medium leading-snug">{duty?.title ?? "Duty"}</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {item.actor === "cleaner" ? household.cleanerName || "Cleaner" : "You"}
                    {duty ? ` · ${roomName(household, duty.room)}` : ""}
                    {` · ${new Date(item.completedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Visits
        </h2>
        {visits.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            When you hand the phone to a cleaner, the visit is recorded here.
          </p>
        ) : (
          visits.map((visit) => {
            const count = household.completions.filter((item) => item.visitId === visit.id).length;
            return (
              <div key={visit.id} className="rounded-2xl border border-border bg-card px-4 py-3">
                <p className="font-medium">{visit.cleanerName}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(visit.startedAt).toLocaleString()} · {count} jobs
                  {visit.endedAt ? "" : " · in progress"}
                </p>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-3xl">{value}</p>
    </div>
  );
}
