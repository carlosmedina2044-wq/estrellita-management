import { tActive } from "@/i18n";
import { tDutyTitle, tMonthName, tPlaybookName } from "@/i18n/content";
import { climateLabel, deriveClimate } from "@/lib/climate";
import { DEFAULT_ATTRIBUTES } from "@/lib/household-defaults";
import { playbookApplies, PLAYBOOKS } from "@/lib/playbooks";
import type { HomeAttributes, HomeLocation, Tenure } from "@/lib/types";

export type ClimatePayoff = {
  headline: string;
  zoneLabel: string;
  beats: string[];
};

/** Immediate onboarding payoff: what this climate means for the house. */
export function climatePayoff(
  location: HomeLocation,
  attributes: HomeAttributes = DEFAULT_ATTRIBUTES,
  tenure?: Tenure,
): ClimatePayoff {
  const zone = deriveClimate(location);
  const zoneLabel = climateLabel(zone);
  const place = location.placeName?.trim();
  const headline = place ? `${place} · ${zoneLabel}` : zoneLabel;
  const matches = PLAYBOOKS.filter(
    (playbook) => playbook.climateZones !== "all" && playbookApplies(playbook, { location, attributes, tenure }),
  ).sort((a, b) => (a.triggerMonth ?? 99) - (b.triggerMonth ?? 99));
  const beats = matches.slice(0, 6).map((playbook) => {
    const name = tPlaybookName(playbook.id, playbook.name);
    const when = playbook.triggerMonth ? tMonthName(playbook.triggerMonth - 1) : name;
    const what = playbook.tasks[0]?.title ? tDutyTitle(playbook.tasks[0].title) : name;
    return `${when}: ${what}`;
  });
  if (tenure === "new") {
    beats.push(tActive("climate.newHomeToo"));
  }
  if (beats.length === 0) {
    beats.push(tActive("climate.seasonalShow"));
  }
  return { headline, zoneLabel, beats };
}
