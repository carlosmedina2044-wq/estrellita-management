import type { CareLevelId } from "@/lib/types";

/** Maps care level to the living-house or breathing-loop moment. */
export function houseMomentFor(level: CareLevelId): "living-house" | "breathing-loop" {
  return level === "loved" ? "breathing-loop" : "living-house";
}

export function careLevelIndex(level: CareLevelId): number {
  const order: CareLevelId[] = [
    "settling-in",
    "kept",
    "well-kept",
    "cared-for",
    "loved",
  ];
  return order.indexOf(level);
}
