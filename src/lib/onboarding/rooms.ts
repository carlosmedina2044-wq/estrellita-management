import { tRoomTemplateName, tRoomTypeLabel } from "@/i18n/content";
import type { HomeType, RoomType, SystemRoomKind } from "@/lib/types";

export type RoomChoice = {
  key: string;
  type: RoomType;
  name: string;
  enabled: boolean;
  optional?: boolean;
  system?: SystemRoomKind;
};

export const ADD_ROOM_TYPES: { id: RoomType; labelKey: "content.room.bedroom" | "content.room.bathroom" | "content.room.office" | "content.room.basement" | "content.room.attic" | "content.room.patio" | "content.room.other" }[] = [
  { id: "bedroom", labelKey: "content.room.bedroom" },
  { id: "bathroom", labelKey: "content.room.bathroom" },
  { id: "office", labelKey: "content.room.office" },
  { id: "basement", labelKey: "content.room.basement" },
  { id: "attic", labelKey: "content.room.attic" },
  { id: "patio", labelKey: "content.room.patio" },
  { id: "other", labelKey: "content.room.other" },
];

/** English labels kept for tests / stable fallbacks; prefer tRoomTypeLabel at render. */
export function addRoomTypeLabel(type: RoomType): string {
  return tRoomTypeLabel(type);
}

export function roomTemplateFor(homeType: HomeType): RoomChoice[] {
  if (homeType === "apartment" || homeType === "condo") {
    return [
      { key: "kitchen", type: "kitchen", name: tRoomTemplateName("kitchen", "Kitchen"), enabled: true },
      { key: "living", type: "living", name: tRoomTemplateName("living", "Living Room"), enabled: true },
      { key: "bedroom", type: "bedroom", name: tRoomTemplateName("bedroom", "Bedroom"), enabled: true },
      { key: "bathroom", type: "bathroom", name: tRoomTemplateName("bathroom", "Bathroom"), enabled: true },
      {
        key: "balcony",
        type: "patio",
        name: tRoomTemplateName("balcony", "Balcony"),
        enabled: false,
        optional: true,
      },
    ];
  }

  const houseLike = homeType === "house" || homeType === "townhouse";
  return [
    { key: "kitchen", type: "kitchen", name: tRoomTemplateName("kitchen", "Kitchen"), enabled: true },
    { key: "living", type: "living", name: tRoomTemplateName("living", "Living Room"), enabled: true },
    {
      key: "primary",
      type: "primary_bedroom",
      name: tRoomTemplateName("primary", "Primary Bedroom"),
      enabled: true,
    },
    { key: "bed2", type: "bedroom", name: tRoomTemplateName("bed2", "Bedroom 2"), enabled: true },
    { key: "bath1", type: "bathroom", name: tRoomTemplateName("bath1", "Bathroom 1"), enabled: true },
    { key: "bath2", type: "bathroom", name: tRoomTemplateName("bath2", "Bathroom 2"), enabled: true },
    { key: "garage", type: "garage", name: tRoomTemplateName("garage", "Garage"), enabled: houseLike },
    { key: "laundry", type: "laundry", name: tRoomTemplateName("laundry", "Laundry"), enabled: true },
    {
      key: "exterior",
      type: "patio",
      name: tRoomTemplateName("exterior", "Outdoors"),
      enabled: houseLike,
      system: "exterior",
    },
    {
      key: "utility",
      type: "other",
      name: tRoomTemplateName("utility", "Home systems"),
      enabled: true,
      system: "whole-home",
    },
  ];
}

export function sampleHomeRooms(): RoomChoice[] {
  return roomTemplateFor("house").map((room) => ({ ...room, enabled: true }));
}

export function nextRoomKey(type: RoomType, existing: RoomChoice[]): string {
  const index = existing.filter((room) => room.type === type).length + 1;
  return `${type}-${index}`;
}
