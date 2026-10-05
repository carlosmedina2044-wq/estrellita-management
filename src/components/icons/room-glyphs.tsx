import type { ComponentType } from "react";
import {
  ArrowDownToLine,
  Bath,
  BedDouble,
  CarFront,
  CookingPot,
  DoorClosed,
  DoorOpen,
  House,
  Laptop,
  Shirt,
  Sofa,
  Trees,
  Utensils,
  Warehouse,
  WashingMachine,
  type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Room glyphs, drawn from the one icon set the rest of the app uses. They were
 * hand-drawn strokes that read as nothing in particular (a kitchen drawn as a
 * briefcase); each room type now has the object a person would point at.
 */
type GlyphProps = LucideProps & { className?: string };

function make(Icon: ComponentType<LucideProps>) {
  return function Glyph({ className, ...props }: GlyphProps) {
    return <Icon aria-hidden strokeWidth={1.75} className={cn("size-6 shrink-0", className)} {...props} />;
  };
}

export const KitchenGlyph = make(CookingPot);
export const DiningGlyph = make(Utensils);
export const LivingGlyph = make(Sofa);
export const BedroomGlyph = make(BedDouble);
export const BathGlyph = make(Bath);
export const LaundryGlyph = make(WashingMachine);
export const OfficeGlyph = make(Laptop);
export const GarageGlyph = make(CarFront);
export const HallwayGlyph = make(DoorOpen);
export const ClosetGlyph = make(Shirt);
export const BasementGlyph = make(ArrowDownToLine);
export const AtticGlyph = make(Warehouse);
export const OutdoorsGlyph = make(Trees);
/** The whole house: things that belong to no single room. */
export const SystemsGlyph = make(House);
export const OtherGlyph = make(DoorClosed);

export type RoomGlyphKind =
  | "kitchen"
  | "dining"
  | "living"
  | "bedroom"
  | "bath"
  | "laundry"
  | "office"
  | "garage"
  | "hallway"
  | "closet"
  | "basement"
  | "attic"
  | "outdoors"
  | "systems"
  | "other";

const BY_KIND: Record<RoomGlyphKind, (props: GlyphProps) => React.JSX.Element> = {
  kitchen: KitchenGlyph,
  dining: DiningGlyph,
  living: LivingGlyph,
  bedroom: BedroomGlyph,
  bath: BathGlyph,
  laundry: LaundryGlyph,
  office: OfficeGlyph,
  garage: GarageGlyph,
  hallway: HallwayGlyph,
  closet: ClosetGlyph,
  basement: BasementGlyph,
  attic: AtticGlyph,
  outdoors: OutdoorsGlyph,
  systems: SystemsGlyph,
  other: OtherGlyph,
};

export function RoomGlyph({ kind, className, ...props }: GlyphProps & { kind: RoomGlyphKind }) {
  const Comp = BY_KIND[kind];
  return <Comp className={className} {...props} />;
}
