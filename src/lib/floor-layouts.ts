import type { Floor, Room } from "@/lib/types";

export type RectShape = { type: "rect"; x: number; y: number; w: number; h: number };
export type EllipseShape = { type: "ellipse"; cx: number; cy: number; rx: number; ry: number };
export type OctagonShape = { type: "octagon"; cx: number; cy: number; r: number };
export type Shape = RectShape | EllipseShape | OctagonShape;

export type RoomLayout = {
  id: Room;
  shapes: Shape[];
  label: { x: number; y: number };
};

export type FloorLayout = {
  viewBox: string;
  rooms: RoomLayout[];
};

export const FLOOR_LAYOUTS: Record<Floor, FloorLayout> = {
  downstairs: {
    viewBox: "14 6 368 290",
    rooms: [
      { id: "patio", shapes: [{ type: "rect", x: 28, y: 8, w: 312, h: 40 }], label: { x: 184, y: 28 } },
      { id: "kitchen", shapes: [{ type: "rect", x: 104, y: 52, w: 92, h: 68 }], label: { x: 150, y: 86 } },
      {
        id: "living-room",
        shapes: [{ type: "rect", x: 200, y: 52, w: 140, h: 108 }],
        label: { x: 286, y: 122 },
      },
      { id: "nook", shapes: [{ type: "rect", x: 200, y: 52, w: 50, h: 44 }], label: { x: 225, y: 74 } },
      {
        id: "dining-room",
        shapes: [{ type: "rect", x: 28, y: 52, w: 72, h: 68 }],
        label: { x: 64, y: 86 },
      },
      { id: "family-room", shapes: [{ type: "rect", x: 28, y: 124, w: 68, h: 156 }], label: { x: 62, y: 202 } },
      { id: "laundry", shapes: [{ type: "rect", x: 144, y: 126, w: 52, h: 42 }], label: { x: 170, y: 147 } },
      { id: "entry", shapes: [{ type: "rect", x: 144, y: 172, w: 52, h: 108 }], label: { x: 170, y: 226 } },
      { id: "guest-room", shapes: [{ type: "rect", x: 200, y: 166, w: 74, h: 114 }], label: { x: 248, y: 236 } },
      { id: "downstairs-bath", shapes: [{ type: "rect", x: 206, y: 174, w: 40, h: 36 }], label: { x: 226, y: 192 } },
      { id: "garage", shapes: [{ type: "rect", x: 278, y: 166, w: 94, h: 114 }], label: { x: 325, y: 223 } },
    ],
  },
  upstairs: {
    viewBox: "8 8 328 268",
    rooms: [
      { id: "main-bath", shapes: [{ type: "rect", x: 16, y: 16, w: 58, h: 96 }], label: { x: 45, y: 64 } },
      {
        id: "main-bedroom",
        shapes: [{ type: "rect", x: 74, y: 16, w: 146, h: 96 }],
        label: { x: 147, y: 64 },
      },
      { id: "carlos-office", shapes: [{ type: "rect", x: 220, y: 16, w: 104, h: 96 }], label: { x: 272, y: 64 } },
      { id: "upstairs-hall", shapes: [{ type: "rect", x: 74, y: 116, w: 146, h: 48 }], label: { x: 147, y: 140 } },
      { id: "upstairs-bath", shapes: [{ type: "rect", x: 220, y: 116, w: 104, h: 48 }], label: { x: 272, y: 140 } },
      { id: "elliotts-room", shapes: [{ type: "rect", x: 118, y: 168, w: 98, h: 96 }], label: { x: 167, y: 216 } },
      { id: "adriana-office", shapes: [{ type: "rect", x: 220, y: 168, w: 104, h: 96 }], label: { x: 272, y: 216 } },
    ],
  },
  outside: {
    // Appraisal sketch (9835 N Meadow Flower Pl): house/patio at the bottom,
    // hardscape + pool on the left third, grass the right two-thirds.
    viewBox: "10 4 380 288",
    rooms: [
      { id: "lawn", shapes: [{ type: "rect", x: 140, y: 10, w: 244, h: 240 }], label: { x: 262, y: 128 } },
      { id: "ramada", shapes: [{ type: "octagon", cx: 86, cy: 44, r: 22 }], label: { x: 86, y: 44 } },
      { id: "pool", shapes: [{ type: "ellipse", cx: 76, cy: 120, rx: 60, ry: 26 }], label: { x: 76, y: 120 } },
      { id: "shed", shapes: [{ type: "rect", x: 18, y: 188, w: 40, h: 56 }], label: { x: 38, y: 216 } },
      { id: "patio", shapes: [{ type: "rect", x: 28, y: 254, w: 336, h: 34 }], label: { x: 196, y: 271 } },
    ],
  },
};

export function boundsOfShape(shape: Shape): { x: number; y: number; w: number; h: number } {
  if (shape.type === "rect") return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
  if (shape.type === "ellipse") {
    return { x: shape.cx - shape.rx, y: shape.cy - shape.ry, w: shape.rx * 2, h: shape.ry * 2 };
  }
  return { x: shape.cx - shape.r, y: shape.cy - shape.r, w: shape.r * 2, h: shape.r * 2 };
}

export function roomLayoutBounds(room: RoomLayout): { x: number; y: number; w: number; h: number } {
  const boxes = room.shapes.map(boundsOfShape);
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.w));
  const bottom = Math.max(...boxes.map((box) => box.y + box.h));
  return { x, y, w: right - x, h: bottom - y };
}

export function octagonPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 8 }, (_, index) => {
    const angle = Math.PI / 8 + index * (Math.PI / 4);
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(" ");
}
