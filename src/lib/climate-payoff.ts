import { climateLabel, deriveClimate } from "@/lib/climate";
import { DEFAULT_ATTRIBUTES } from "@/lib/household-defaults";
import { playbookApplies, PLAYBOOKS } from "@/lib/playbooks";
import type { HomeAttributes, HomeLocation, Tenure } from "@/lib/types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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
  const beats = matches.slice(0, 4).map((playbook) => {
    const when = playbook.triggerMonth ? MONTHS[playbook.triggerMonth - 1] : playbook.name;
    const what = playbook.tasks[0]?.title ?? playbook.name;
    return `${when}: ${what}`;
  });
  if (tenure === "new") {
    beats.push("We’ll add a new-home checklist too");
  }
  if (beats.length === 0) {
    beats.push("Seasonal checklists will show up as the year turns.");
  }
  return { headline, zoneLabel, beats };
}
