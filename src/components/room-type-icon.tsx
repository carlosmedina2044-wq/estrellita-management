import {
  Archive,
  Bath,
  Bed,
  Briefcase,
  Car,
  CookingPot,
  DoorOpen,
  Home,
  Shirt,
  Sofa,
  Trees,
  UtensilsCrossed,
  Warehouse,
} from "lucide-react";
import type { HomeRoom, RoomType } from "@/lib/types";

const ICONS: Record<RoomType, typeof Home> = {
  kitchen: CookingPot,
  living: Sofa,
  dining: UtensilsCrossed,
  primary_bedroom: Bed,
  bedroom: Bed,
  bathroom: Bath,
  office: Briefcase,
  laundry: Shirt,
  garage: Car,
  hallway: DoorOpen,
  closet: Archive,
  basement: Warehouse,
  attic: Home,
  patio: Trees,
  other: Home,
};

export function RoomTypeIcon({ room, className }: { room: HomeRoom; className?: string }) {
  if (room.system === "exterior") return <Trees className={className} aria-hidden />;
  if (room.system === "whole-home") return <Home className={className} aria-hidden />;
  const Icon = ICONS[room.type] ?? Home;
  return <Icon className={className} aria-hidden />;
}
