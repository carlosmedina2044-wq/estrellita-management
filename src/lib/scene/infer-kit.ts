import { sizeDefaults, type OnboardingAnswers } from "@/lib/onboarding/generate";
import { PORTRAIT_MANIFEST } from "@/lib/scene/portrait";
import { KIT_TYPES, type KitType } from "@/lib/types";

type KitAnswers = Pick<OnboardingAnswers, "homeType" | "bedrooms" | "floors">;

function footprintFor(bedrooms: number | undefined): "compact" | "standard" | "wide" {
  if (bedrooms == null) return "standard";
  if (bedrooms <= 2) return "compact";
  if (bedrooms === 3) return "standard";
  return "wide";
}

/** Higher is a better guess. Onboarding never asks about garages or solar
 * directly (those are derived later, from room choices), so the signals
 * here are the ones actually available at this point in the flow: home
 * type, floor count, and bedroom count. This only has to produce a
 * reasonable first pick — the picker itself is a one-flick swipe away from
 * anything else, so it doesn't need to be exact. */
function score(kitType: KitType, answers: KitAnswers): number {
  const features = PORTRAIT_MANIFEST[kitType]?.features;
  if (!features) return -Infinity;
  let total = 0;
  // Onboarding's current flow never asks for floors/bedrooms directly — only
  // `homeType` is real user input by this step — so `sizeDefaults` (the same
  // fallback `generateHomeFromAnswers` uses) fills them in. Explicit values
  // still win when a caller (a test, or a future step) does provide them.
  const defaults = sizeDefaults(answers.homeType);
  const bedrooms = answers.bedrooms ?? defaults.bedrooms;
  const floors = answers.floors ?? defaults.floors;
  const wantsCompact = answers.homeType === "apartment" || answers.homeType === "condo";
  const targetFootprint = wantsCompact ? "compact" : footprintFor(bedrooms);
  if (features.footprint === targetFootprint) total += 3;
  const targetStoreys = floors >= 2 ? 2 : 1;
  if (features.storeys === targetStoreys) total += 2;
  return total;
}

/** All 21 kit types, best guess for `answers` first. */
export function rankKits(answers: KitAnswers): KitType[] {
  return [...KIT_TYPES].sort((a, b) => score(b, answers) - score(a, answers));
}
