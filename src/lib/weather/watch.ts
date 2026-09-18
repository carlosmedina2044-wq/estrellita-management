import type { MessageKey } from "@/i18n";
import { tActive } from "@/i18n";
import { tTriggerName } from "@/i18n/content";
import { deriveClimate, roundCoord } from "@/lib/climate";
import { attributesMatch } from "@/lib/playbooks";
import type { Household } from "@/lib/types";
import { triggerAppliesInZone, WEATHER_TRIGGERS, type WeatherMetric } from "@/lib/weather/provider";

export type WeatherWatchEntry = {
  id: string;
  metric: WeatherMetric;
  op: "<" | ">" | ">=";
  value: number;
  withinDays: number;
  cooldownDays: number;
  title: string;
  body: string;
};

export type WeatherWatch = {
  latitude: number;
  longitude: number;
  entries: WeatherWatchEntry[];
};

/**
 * What the native background refresh watches for while the app is closed:
 * one entry per weather trigger that applies to this home, with its zone-
 * resolved threshold and the notification copy already localised, plus the
 * home's coordinates rounded to two decimals (about a kilometre). This is the
 * only way a freeze warning can arrive before the freeze: the vault key is
 * bound to Face ID, so nothing native can read the household in the
 * background — the list is published in plaintext on purpose, like the
 * widget snapshot, and carries nothing a forecast request does not already
 * need. Null when the home has no coordinates or no applicable trigger.
 */
export function weatherWatchList(household: Household): WeatherWatch | null {
  const { lat, lng } = household.location;
  if (lat == null || lng == null) return null;
  const zone = deriveClimate(household.location);
  const privateMode = household.restockDigest.privateNotifications === true;
  const entries: WeatherWatchEntry[] = WEATHER_TRIGGERS.filter(
    (trigger) => triggerAppliesInZone(trigger, zone) && attributesMatch(trigger.requires, household.attributes),
  ).map((trigger) => ({
    id: trigger.id,
    metric: trigger.condition.metric,
    op: trigger.condition.op,
    value: trigger.condition.byZone?.[zone] ?? trigger.condition.value,
    withinDays: trigger.condition.withinDays,
    cooldownDays: trigger.cooldownDays,
    title: privateMode
      ? tActive("notify.weatherPrivateTitle")
      : tActive("notify.weatherTitle", { name: tTriggerName(trigger.id, trigger.name) }),
    body: privateMode ? tActive("notify.weatherPrivateBody") : tActive(`notify.weather.${trigger.id}` as MessageKey),
  }));
  if (entries.length === 0) return null;
  return { latitude: roundCoord(lat), longitude: roundCoord(lng), entries };
}
