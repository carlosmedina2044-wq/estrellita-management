export type Season = "spring" | "summer" | "autumn" | "winter";

export function seasonFor(now: Date, lat: number | null): Season {
  const month = now.getMonth();
  const southern = lat != null && lat < 0;
  const northern: Season[] = [
    "winter",
    "winter",
    "spring",
    "spring",
    "spring",
    "summer",
    "summer",
    "summer",
    "autumn",
    "autumn",
    "autumn",
    "winter",
  ];
  const season = northern[month];
  if (!southern) return season;
  if (season === "summer") return "winter";
  if (season === "winter") return "summer";
  if (season === "spring") return "autumn";
  return "spring";
}
