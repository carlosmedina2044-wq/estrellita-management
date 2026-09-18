import type { MessageKey } from "@/i18n";
import { tActive } from "@/i18n";
import { tDutyTitle } from "@/i18n/content";
import { doneToday, todaysOpenDuties } from "@/lib/duties";
import { keptRooms } from "@/lib/kept-rooms";
import { closedDayRun, dayArc } from "@/lib/momentum";
import { houseLight } from "@/lib/scene/light";
import { portraitKit, portraitLayerUrls, resolveHomeSpec } from "@/lib/scene/portrait";
import { seasonFor } from "@/lib/scene/season";
import { phaseBoundaries, sunTimes } from "@/lib/scene/sun";
import { windowStates, type WindowState } from "@/lib/scene/window-rooms";
import type { Household } from "@/lib/types";

/** Max duty titles written to the lock-screen snapshot. */
export const WIDGET_TITLE_LIMIT = 3;

/**
 * Deliberately plaintext glance for WidgetKit. The vault key never leaves
 * Keychain ThisDeviceOnly + biometry ACL; the extension cannot decrypt.
 */
export type WidgetSnapshot = {
  dueCount: number;
  doneCount: number;
  updatedAt: string;
  titles: string[];
  dueLabel: string;
  doneLabel: string;
  emptyLabel: string;
  runLength: number;
  dayFraction: number;
  careLabel: string;
  runLabel: string;
  /** The house (E3-04). Style and season only, never a room name. */
  kitType: string;
  palette: string;
  season: string;
  /** Per-window paint in kit order, "lit" | "dim" | "off", comma-joined. */
  windowStates: string;
  /** Web paths of the layer files for this kit, palette and season. The
   * plugin copies them from the app bundle into the App Group container so
   * the extension can draw the house without duplicating 5 MB of portraits. */
  layerFiles: string[];
  /** Minutes of the day at which the sky changes phase, so the widget's
   * timeline paints the right sky without knowing where the home is. */
  phaseTimes: number[];
};

export function widgetSnapshotFor(household: Household, now = new Date()): WidgetSnapshot {
  const open = todaysOpenDuties(household, now);
  const done = doneToday(household, now);
  const privateMode = household.restockDigest.privateNotifications === true;
  const momentumOn = household.momentum.enabled;
  const runLength = momentumOn ? closedDayRun(household, now).current : 0;
  const dayFraction = momentumOn ? dayArc(household, now).fraction : 0;
  const level = household.momentum.care?.level ?? "settling-in";
  const careLabel = momentumOn ? tActive(`care.level.${level}` as MessageKey) : "";
  const runLabel =
    momentumOn && runLength > 0 ? tActive("widget.run", { count: runLength }) : "";
  const spec = resolveHomeSpec(household);
  const kit = portraitKit(spec.kitType);
  const { lat, lng } = household.location;
  const season = seasonFor(now, lat ?? null);
  const layers = portraitLayerUrls(spec.kitType, spec.palette, season);
  const arc = dayArc(household, now);
  const closedToday = arc.state === "closed";
  const light = houseLight(arc, "day", closedToday, season, 0, kit.windowCount || kit.windows.length || 1);
  const states: WindowState[] = closedToday
    ? kit.windows.map(() => "lit")
    : windowStates(spec, kit, keptRooms(household, now), light.windowsLit);
  const bounds = phaseBoundaries(lat != null && lng != null ? sunTimes(lat, lng, now) : null);
  return {
    kitType: spec.kitType,
    palette: spec.palette,
    season,
    windowStates: states.join(","),
    layerFiles: [layers.shadow, layers.night, layers.day, layers.lit, layers.foliageNight, layers.foliageDay, layers.snow],
    phaseTimes: [bounds.dawnStart, bounds.dawnEnd, bounds.goldenStart, bounds.goldenEnd, bounds.duskStart, bounds.duskEnd],
    dueCount: open.length,
    doneCount: done.length,
    updatedAt: now.toISOString(),
    titles: privateMode ? [] : open.slice(0, WIDGET_TITLE_LIMIT).map((duty) => tDutyTitle(duty.title)),
    dueLabel: tActive("widget.due", { count: open.length }),
    doneLabel: tActive("widget.done", { count: done.length }),
    emptyLabel: tActive("widget.empty"),
    runLength,
    dayFraction,
    careLabel,
    runLabel,
  };
}
