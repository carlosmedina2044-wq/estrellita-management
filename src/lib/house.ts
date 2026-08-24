import type { Audience, Room } from "@/lib/types";

/**
 * Legacy room identifiers from pre-release builds, kept only so old saved data
 * migrates cleanly. No personal or address-specific data lives here.
 */
const LEGACY_ROOM: Record<string, Room> = {
  bathroom: "bathroom",
  living: "living",
  bedroom: "bedroom",
  outdoor: "exterior",
  pets: "exterior",
  lawn: "exterior",
  pool: "exterior",
  patio: "exterior",
  "whole-home": "whole-home",
  entry: "hallway",
};

export function migrateRoom(value: string): Room {
  if (LEGACY_ROOM[value]) return LEGACY_ROOM[value];
  if (/^[A-Za-z0-9_-]{2,64}$/.test(value)) return value;
  return "whole-home";
}

export function inferAudience(title: string): Audience {
  const text = title.toLowerCase();
  if (/bathroom|vacuum|sheet|mop|dust|toilet|shower/.test(text)) return "cleaner";
  return "me";
}
