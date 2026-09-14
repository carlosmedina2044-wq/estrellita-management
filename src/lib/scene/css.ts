import type { SkyStops } from "@/lib/scene/sky";

export function sceneCssVars(
  stops: SkyStops,
): Record<"--sky-top" | "--sky-mid" | "--sky-horizon" | "--ambient" | "--scene-text", string> {
  return {
    "--sky-top": stops.top,
    "--sky-mid": stops.mid,
    "--sky-horizon": stops.horizon,
    "--ambient": stops.ambient,
    "--scene-text": stops.textTone === "ink" ? "#1d1d1f" : "#f7f3ec",
  };
}
