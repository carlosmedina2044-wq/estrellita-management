"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ZipSheet } from "@/components/zip-prompt";
import { climateLabel, deriveClimate } from "@/lib/climate";
import { matchingPlaybooks, PLAYBOOKS, playbookApplies } from "@/lib/playbooks";
import type { Household } from "@/lib/types";

export function SeasonalView({
  household,
  weatherLine,
  needsZip,
  weatherError,
  onSavePostalCode,
  onAccept,
  onDecline,
  onToggleAttribute,
}: {
  household: Household;
  weatherLine: string;
  needsZip?: boolean;
  weatherError: string | null;
  onSavePostalCode?: (zip: string) => Promise<{ ok: boolean; error?: string }>;
  onAccept: (playbookId: string, titles?: string[]) => void;
  onDecline: (playbookId: string) => void;
  onToggleAttribute: (key: "hasPool" | "hasIrrigation" | "hasGutters" | "hasFireplace" | "hasBasement" | "hasEvaporativeCooler") => void;
}) {
  const month = new Date().getMonth() + 1;
  const suggested = matchingPlaybooks(household, month);
  const year = new Date().getFullYear();
  const decided = new Set(
    household.playbookDecisions.filter((item) => item.year === year).map((item) => item.playbookId),
  );
  const [zipOpen, setZipOpen] = useState(false);
  const missingZip = needsZip ?? (!household.location.postalCode && household.location.lat == null);
  const zone = climateLabel(deriveClimate(household.location));
  const subtitle = missingZip || weatherLine.startsWith(zone) ? weatherLine : `${zone} · ${weatherLine}`;

  return (
    <div className="flex flex-col gap-5 pb-8">
      <header>
        <h1 className="ui-heading text-[34px] font-semibold tracking-tight">Seasonal</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        {weatherError ? (
          <p className="mt-2 text-sm text-destructive">Weather last failed: {weatherError}. Seasonal checklists still work.</p>
        ) : household.weatherStatus.lastSuccessAt ? (
          <p className="mt-2 text-xs text-muted-foreground">Last forecast {household.weatherStatus.lastSuccessAt.slice(0, 16)}</p>
        ) : null}
        {missingZip && onSavePostalCode ? (
          <button
            type="button"
            className="mt-3 w-full rounded-2xl bg-white px-4 py-4 text-left"
            onClick={() => setZipOpen(true)}
          >
            <p className="font-medium text-primary">Add your ZIP</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We’ll use it for weather and which seasonal jobs apply here.
            </p>
          </button>
        ) : null}
      </header>

      <section>
        <h2 className="ui-heading text-[20px] font-semibold">This month</h2>
        {suggested.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing new to accept this month.</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {suggested.map((playbook) => (
              <li key={playbook.id} className="rounded-2xl bg-white px-4 py-4">
                <p className="font-medium">{playbook.name}</p>
                <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
                  {playbook.tasks.map((task) => (
                    <li key={task.title}>{task.title}</li>
                  ))}
                </ul>
                {decided.has(playbook.id) ? (
                  <p className="mt-2 text-xs text-muted-foreground">Already decided this year.</p>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <Button className="h-10 flex-1" onClick={() => onAccept(playbook.id)}>
                      Accept all
                    </Button>
                    <Button variant="secondary" className="h-10 flex-1" onClick={() => onDecline(playbook.id)}>
                      Not this year
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="ui-heading text-[20px] font-semibold">Home attributes</h2>
        <p className="mt-1 text-sm text-muted-foreground">Toggles change which playbooks match.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["hasPool", "Pool"],
              ["hasIrrigation", "Irrigation"],
              ["hasGutters", "Gutters"],
              ["hasFireplace", "Fireplace"],
              ["hasBasement", "Basement"],
              ["hasEvaporativeCooler", "Swamp cooler"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => onToggleAttribute(key)}
              className={
                household.attributes[key]
                  ? "h-10 rounded-full bg-primary px-3 text-[13px] font-medium text-primary-foreground"
                  : "h-10 rounded-full bg-secondary px-3 text-[13px] font-medium"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="ui-heading text-[20px] font-semibold">All playbooks</h2>
        <ul className="mt-3 grid gap-2">
          {PLAYBOOKS.map((playbook) => (
            <li key={playbook.id} className="rounded-2xl bg-card px-4 py-3">
              <p className="font-medium">{playbook.name}</p>
              <p className="text-xs text-muted-foreground">
                {playbook.season} · {playbookApplies(playbook, household) ? "matches this home" : "does not match"}
              </p>
              <Button variant="secondary" className="mt-2 h-9" onClick={() => onAccept(playbook.id)}>
                Enable
              </Button>
            </li>
          ))}
        </ul>
      </section>
      {onSavePostalCode ? (
        <ZipSheet
          open={zipOpen}
          initialZip={household.location.postalCode}
          onOpenChange={setZipOpen}
          onSave={onSavePostalCode}
        />
      ) : null}
    </div>
  );
}
