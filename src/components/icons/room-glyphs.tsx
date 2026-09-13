import type { SVGProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const BASE = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type GlyphProps = SVGProps<SVGSVGElement> & { className?: string };

function Glyph({ className, children, ...props }: GlyphProps & { children: ReactNode }) {
  return (
    <svg {...BASE} aria-hidden className={cn("size-6 shrink-0", className)} {...props}>
      {children}
    </svg>
  );
}

/** Seven stroke glyphs from the system board (24 px / 2 px stroke). */
export function KitchenGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Z" />
      <path d="M8 10V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3" />
      <path d="M10 14h4" />
    </Glyph>
  );
}

export function LivingGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M4 14h16v5H4z" />
      <path d="M6 14V11a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3" />
      <path d="M8 9V7a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    </Glyph>
  );
}

export function BedroomGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M3 18v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5" />
      <path d="M3 18h18" />
      <path d="M6 11V8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3" />
    </Glyph>
  );
}

export function BathGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M5 12h14v3a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-3Z" />
      <path d="M7 12V7a2 2 0 0 1 2-2h1" />
      <path d="M5 19h14" />
    </Glyph>
  );
}

export function LaundryGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <circle cx="12" cy="13" r="4" />
      <path d="M8 6h2" />
    </Glyph>
  );
}

export function OutdoorsGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M12 4v7" />
      <path d="M8 8c0 4 2 6 4 8 2-2 4-4 4-8" />
      <path d="M5 20h14" />
      <path d="M12 15v5" />
    </Glyph>
  );
}

export function SystemsGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <path d="m5.6 5.6 2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </Glyph>
  );
}

export type RoomGlyphKind =
  | "kitchen"
  | "living"
  | "bedroom"
  | "bath"
  | "laundry"
  | "outdoors"
  | "systems";

const BY_KIND: Record<RoomGlyphKind, (props: GlyphProps) => ReactNode> = {
  kitchen: KitchenGlyph,
  living: LivingGlyph,
  bedroom: BedroomGlyph,
  bath: BathGlyph,
  laundry: LaundryGlyph,
  outdoors: OutdoorsGlyph,
  systems: SystemsGlyph,
};

export function RoomGlyph({ kind, className, ...props }: GlyphProps & { kind: RoomGlyphKind }) {
  const Comp = BY_KIND[kind];
  return <>{Comp({ className, ...props })}</>;
}
