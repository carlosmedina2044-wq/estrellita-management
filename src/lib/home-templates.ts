import { defaultRoomName, systemRooms, type HomeTreeDraft } from "@/lib/home-model";
import type { HomeFloor, HomeRoom, RoomType } from "@/lib/types";

export type HomeTemplateId = "studio" | "single-story" | "two-story" | "townhouse";

export type HomeTemplate = {
  id: HomeTemplateId;
  name: string;
  hint: string;
  floors: { name: string; rooms: RoomType[] }[];
};

export const HOME_TEMPLATES: HomeTemplate[] = [
  {
    id: "studio",
    name: "Studio / Apartment",
    hint: "One open floor, kitchen, bath, and a living space.",
    floors: [{ name: "Main", rooms: ["kitchen", "living", "bathroom", "hallway"] }],
  },
  {
    id: "single-story",
    name: "Single-story",
    hint: "Kitchen, living, dining, two bedrooms, and a laundry.",
    floors: [
      {
        name: "Main",
        rooms: ["hallway", "living", "dining", "kitchen", "primary_bedroom", "bedroom", "bathroom", "laundry"],
      },
    ],
  },
  {
    id: "two-story",
    name: "Two-story",
    hint: "Living downstairs, bedrooms upstairs.",
    floors: [
      { name: "Main", rooms: ["hallway", "living", "dining", "kitchen", "bathroom", "laundry", "garage"] },
      { name: "Upstairs", rooms: ["primary_bedroom", "bedroom", "bedroom", "bathroom", "hallway"] },
    ],
  },
  {
    id: "townhouse",
    name: "Townhouse",
    hint: "Entry and garage below, living in the middle, beds above.",
    floors: [
      { name: "Lower", rooms: ["hallway", "garage", "laundry"] },
      { name: "Main", rooms: ["living", "dining", "kitchen", "bathroom"] },
      { name: "Upstairs", rooms: ["primary_bedroom", "bedroom", "bathroom"] },
    ],
  },
];

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "floor";
}

export function draftFromTemplate(template: HomeTemplate, homeName: string): HomeTreeDraft {
  const floors: HomeFloor[] = template.floors.map((floor, index) => ({
    id: `${slug(floor.name) || "floor"}-${index}`,
    name: floor.name,
    sortOrder: index,
  }));
  const rooms: HomeRoom[] = [];
  template.floors.forEach((floor, floorIndex) => {
    const floorId = floors[floorIndex].id;
    floor.rooms.forEach((type) => {
      rooms.push({
        id: crypto.randomUUID(),
        floorId,
        name: defaultRoomName(type, rooms),
        type,
        sortOrder: rooms.length,
      });
    });
  });
  return { homeName, floors, rooms: [...systemRooms(), ...rooms] };
}
