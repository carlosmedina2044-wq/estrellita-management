import type { HomeType, RoomType, SystemRoomKind } from "@/lib/types";

export type RoomChoice = {
  key: string;
  type: RoomType;
  name: string;
  enabled: boolean;
  optional?: boolean;
  system?: SystemRoomKind;
};

export const ADD_ROOM_TYPES: { id: RoomType; label: string }[] = [
  { id: "bedroom", label: "Bedroom" },
  { id: "bathroom", label: "Bathroom" },
  { id: "office", label: "Office" },
  { id: "basement", label: "Basement" },
  { id: "attic", label: "Attic" },
  { id: "patio", label: "Patio" },
  { id: "other", label: "Other" },
];

export function roomTemplateFor(homeType: HomeType): RoomChoice[] {
  if (homeType === "apartment" || homeType === "condo") {
    return [
      { key: "kitchen", type: "kitchen", name: "Kitchen", enabled: true },
      { key: "living", type: "living", name: "Living Room", enabled: true },
      { key: "bedroom", type: "bedroom", name: "Bedroom", enabled: true },
      { key: "bathroom", type: "bathroom", name: "Bathroom", enabled: true },
      { key: "balcony", type: "patio", name: "Balcony", enabled: false, optional: true },
    ];
  }

  const houseLike = homeType === "house" || homeType === "townhouse";
  return [
    { key: "kitchen", type: "kitchen", name: "Kitchen", enabled: true },
    { key: "living", type: "living", name: "Living Room", enabled: true },
    { key: "primary", type: "primary_bedroom", name: "Primary Bedroom", enabled: true },
    { key: "bed2", type: "bedroom", name: "Bedroom 2", enabled: true },
    { key: "bath1", type: "bathroom", name: "Bathroom 1", enabled: true },
    { key: "bath2", type: "bathroom", name: "Bathroom 2", enabled: true },
    { key: "garage", type: "garage", name: "Garage", enabled: houseLike },
    { key: "laundry", type: "laundry", name: "Laundry", enabled: true },
    {
      key: "exterior",
      type: "patio",
      name: "Exterior/Yard",
      enabled: houseLike,
      system: "exterior",
    },
    { key: "utility", type: "other", name: "HVAC/Utility", enabled: true, system: "whole-home" },
  ];
}

export function sampleHomeRooms(): RoomChoice[] {
  return roomTemplateFor("house").map((room) => ({ ...room, enabled: true }));
}

export function nextRoomKey(type: RoomType, existing: RoomChoice[]): string {
  const index = existing.filter((room) => room.type === type).length + 1;
  return `${type}-${index}`;
}
