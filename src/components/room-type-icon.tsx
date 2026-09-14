import type { HomeRoom, RoomType } from "@/lib/types";
import {
  BathGlyph,
  BedroomGlyph,
  KitchenGlyph,
  LaundryGlyph,
  LivingGlyph,
  OutdoorsGlyph,
  RoomGlyph,
  SystemsGlyph,
  type RoomGlyphKind,
} from "@/components/icons/room-glyphs";

export const TYPE_TO_GLYPH: Record<RoomType, RoomGlyphKind> = {
  kitchen: "kitchen",
  living: "living",
  dining: "living",
  primary_bedroom: "bedroom",
  bedroom: "bedroom",
  bathroom: "bath",
  office: "living",
  laundry: "laundry",
  garage: "systems",
  hallway: "systems",
  closet: "bedroom",
  basement: "systems",
  attic: "systems",
  patio: "outdoors",
  other: "systems",
};

export function RoomTypeIcon({ room, className }: { room: HomeRoom; className?: string }) {
  if (room.system === "exterior") return <OutdoorsGlyph className={className} />;
  if (room.system === "whole-home") return <SystemsGlyph className={className} />;
  const kind = TYPE_TO_GLYPH[room.type] ?? "systems";
  return <RoomGlyph kind={kind} className={className} />;
}

export {
  BathGlyph,
  BedroomGlyph,
  KitchenGlyph,
  LaundryGlyph,
  LivingGlyph,
  OutdoorsGlyph,
  RoomGlyph,
  SystemsGlyph,
  type RoomGlyphKind,
};
