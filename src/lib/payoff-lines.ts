import type { MessageKey } from "@/i18n";
import { dutyTopic } from "@/lib/duty-topics";
import type { IllustrationName } from "@/lib/illustrations";
import type { Duty } from "@/lib/types";

export function payoffKeyFor(
  duty: Pick<Duty, "title" | "frequency">,
): MessageKey | null {
  if (duty.frequency !== "quarterly" && duty.frequency !== "yearly") return null;
  const topic = dutyTopic(duty);
  if (topic === "hvac-filter") return "payoff.hvacFilter";
  if (topic === "dryer-vent") return "payoff.dryerVent";
  if (topic === "smoke-detectors") return "payoff.smokeDetectors";
  if (topic === "fridge-coils") return "payoff.fridgeCoils";
  if (topic === "caulk") return "payoff.caulk";
  if (topic === "water-heater-flush" || /water heater/i.test(duty.title)) return "payoff.waterHeater";
  if (topic === "gutters-clear" || /gutter/i.test(duty.title)) return "payoff.gutters";
  if (topic?.startsWith("irrigation-") || /irrigation|sprinkler/i.test(duty.title)) {
    return "payoff.irrigation";
  }
  if (topic?.startsWith("hvac-service-") || /furnace|hvac|a\/?c\b/i.test(duty.title)) {
    return "payoff.hvacService";
  }
  if (topic === "locks-rekey" || /lock/i.test(duty.title)) return "payoff.locks";
  return "payoff.generic";
}

export function payoffArtFor(
  duty: Pick<Duty, "title" | "frequency">,
  now = new Date(),
): IllustrationName | null {
  const key = payoffKeyFor(duty);
  if (!key) return null;
  if (key === "payoff.hvacFilter" || key === "payoff.hvacService") return "sys-hvac";
  if (key === "payoff.dryerVent") return "sys-laundry";
  if (key === "payoff.waterHeater") return "sys-water-heater";
  if (key === "payoff.fridgeCoils") return "sys-fridge";
  if (key === "payoff.gutters") {
    const month = now.getMonth();
    return month >= 8 && month <= 10 ? "season-fall" : "season-rain";
  }
  if (key === "payoff.irrigation") return "sys-irrigation";
  if (/freeze|winteriz|pipe/i.test(duty.title)) return "season-freeze";
  if (/pool/i.test(duty.title)) return "sys-pool";
  return null;
}
