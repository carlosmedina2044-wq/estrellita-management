"use client";

import type { Ref } from "react";
import { FLOORS, roomDef } from "@/lib/house";
import { FLOOR_LAYOUTS, octagonPoints, type Shape } from "@/lib/floor-layouts";
import type { Floor, Room } from "@/lib/types";
import { cn } from "@/lib/utils";

export type RoomWork = { open: number; overdue: number };

export function FloorSwitcher({
  floor,
  onSelectFloor,
}: {
  floor: Floor;
  onSelectFloor: (floor: Floor) => void;
}) {
  return (
    <div className="relative z-10 flex gap-1 p-2">
      {FLOORS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelectFloor(item.id)}
          className={cn(
            "h-8 flex-1 rounded-full text-[13px] font-medium transition-colors",
            floor === item.id
              ? "bg-primary text-primary-foreground"
              : "bg-transparent text-muted-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function FloorPlan({
  floor,
  selectedId,
  work,
  onSelectRoom,
  svgRef,
  dimmed,
}: {
  floor: Floor;
  selectedId: Room | null;
  work: Partial<Record<Room, RoomWork>>;
  onSelectRoom: (room: Room) => void;
  svgRef?: Ref<SVGSVGElement>;
  dimmed?: boolean;
}) {
  const layout = FLOOR_LAYOUTS[floor];
  const [viewX, viewY, viewW, viewH] = layout.viewBox.split(" ").map(Number);

  return (
    <div className="px-3 pb-4">
      <svg
          ref={svgRef}
          viewBox={layout.viewBox}
          overflow="visible"
          className={cn("block w-full touch-manipulation select-none", dimmed && "opacity-60")}
          role="img"
          aria-label={`${FLOORS.find((item) => item.id === floor)?.label} floor plan`}
        >
        <rect x={viewX} y={viewY} width={viewW} height={viewH} fill={floor === "outside" ? "#ebe6dc" : "#f5f5f7"} />
        <FloorDecorations floor={floor} />

        {layout.rooms.map((room) => {
          const selected = selectedId === room.id;
          const status = work[room.id];
          const count = status?.open ?? 0;
          const overdue = (status?.overdue ?? 0) > 0;
          const def = roomDef(room.id);
          const box = room.shapes[0];
          const compact = box.type === "rect" && box.w < 48;
          const nameSize = compact ? 9 : def.short.length > 8 ? 10 : 11;
          return (
            <g
              key={room.id}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`${def.label}${count ? `, ${count} open` : ", clear"}`}
              className="cursor-pointer outline-none"
              onClick={() => onSelectRoom(room.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectRoom(room.id);
                }
              }}
            >
              {room.shapes.map((shape, index) => (
                <RoomShape
                  key={`${room.id}-${index}`}
                  shape={shape}
                  selected={selected}
                  hasWork={count > 0}
                  overdue={overdue}
                  room={room.id}
                />
              ))}
              <text
                x={room.label.x}
                y={room.label.y - (count > 0 && !compact ? 6 : 0)}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none"
                fill={selected ? "#ffffff" : "#1d1d1f"}
                fontSize={nameSize}
                fontWeight={600}
                fontFamily="-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
              >
                {def.short}
              </text>
              {count > 0 && !compact ? (
                <text
                  x={room.label.x}
                  y={room.label.y + 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none"
                  fill={selected ? "#ffffff" : overdue ? "#ff3b30" : "#007aff"}
                  fontSize={8}
                  fontWeight={600}
                  fontFamily="-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
                >
                  {count} open
                </text>
              ) : null}
            </g>
          );
        })}
        {floor === "outside" ? <YardFence /> : null}
      </svg>
    </div>
  );
}

function RoomShape({
  shape,
  selected,
  hasWork,
  overdue,
  room,
}: {
  shape: Shape;
  selected: boolean;
  hasWork: boolean;
  overdue: boolean;
  room: Room;
}) {
  const fill = selected ? "#007aff" : roomFill(room, hasWork, overdue);
  const stroke = selected ? "#007aff" : overdue ? "#c7c7cc" : hasWork ? "#b7d4f5" : "#d2d2d7";

  if (shape.type === "rect") {
    return (
      <rect
        x={shape.x}
        y={shape.y}
        width={shape.w}
        height={shape.h}
        rx={4}
        fill={fill}
        stroke={stroke}
        strokeWidth={selected ? 1.8 : 1}
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  if (shape.type === "ellipse") {
    return (
      <ellipse
        cx={shape.cx}
        cy={shape.cy}
        rx={shape.rx}
        ry={shape.ry}
        fill={fill}
        stroke={stroke}
        strokeWidth={selected ? 1.8 : 1}
      />
    );
  }

  return (
    <polygon
      points={octagonPoints(shape.cx, shape.cy, shape.r)}
      fill={fill}
      stroke={stroke}
      strokeWidth={selected ? 1.8 : 1}
    />
  );
}

function roomFill(room: Room, hasWork: boolean, overdue: boolean): string {
  if (overdue) return "#edf1f5";
  if (hasWork) return "#e8f1fc";
  if (room === "lawn") return "#eef3e6";
  if (room === "pool") return "#e6eef3";
  if (room === "patio" || room === "ramada") return "#eef2ec";
  if (room === "kitchen") return "#fafafa";
  if (room === "main-bath" || room === "upstairs-bath" || room === "downstairs-bath") return "#f4f6f8";
  if (room === "garage" || room === "shed" || room === "laundry") return "#f3f4f6";
  return "#f7f7f8";
}

function FloorDecorations({ floor }: { floor: Floor }) {
  if (floor === "downstairs") {
    return (
      <g className="pointer-events-none">
        <rect x={108} y={126} width={32} height={46} rx={4} fill="#eef0f3" stroke="#d2d2d7" strokeWidth={1} />
        <text x={124} y={151} textAnchor="middle" fill="#86868b" fontSize={8} fontWeight={600} fontFamily="-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif">
          Stairs
        </text>
        <rect x={32} y={176} width={8} height={28} rx={2} fill="#c7c7cc" />
        <rect x={328} y={86} width={8} height={28} rx={2} fill="#c7c7cc" />
        <text x={36} y={172} fill="#86868b" fontSize={7} fontFamily="-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif">
          FP
        </text>
        <text x={318} y={82} fill="#86868b" fontSize={7} fontFamily="-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif">
          FP
        </text>
      </g>
    );
  }

  if (floor === "upstairs") {
    return (
      <g className="pointer-events-none">
        <rect x={16} y={116} width={58} height={48} rx={4} fill="#eef0f3" stroke="#d2d2d7" strokeWidth={1} />
        <text x={45} y={142} textAnchor="middle" fill="#86868b" fontSize={8} fontWeight={600} fontFamily="-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif">
          Stairs
        </text>
        <rect x={80} y={22} width={34} height={24} rx={4} fill="#f4f6f8" stroke="#d2d2d7" strokeWidth={1} />
        <text x={97} y={36} textAnchor="middle" fill="#86868b" fontSize={7} fontWeight={600} fontFamily="-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif">
          WIC
        </text>
      </g>
    );
  }

  return (
    <g className="pointer-events-none">
      <rect x={16} y={8} width={368} height={280} rx={3} fill="none" stroke="#d0c8bc" strokeWidth={2.4} />
      <rect x={16} y={10} width={124} height={240} rx={3} fill="#efe8dc" />
    </g>
  );
}

function YardFence() {
  const pool = FLOOR_LAYOUTS.outside.rooms.find((room) => room.id === "pool")?.shapes[0];
  const fence =
    pool?.type === "ellipse"
      ? { x: pool.cx - pool.rx, y: pool.cy - pool.ry - 9, w: pool.rx * 2 + 10, h: pool.ry * 2 + 18 }
      : { x: 16, y: 85, w: 130, h: 70 };

  return (
    <g className="pointer-events-none">
      <rect
        x={fence.x}
        y={fence.y}
        width={fence.w}
        height={fence.h}
        rx={10}
        fill="none"
        stroke="#8f8270"
        strokeWidth={1.5}
      />
      {picketTicks(fence).map((tick, index) => (
        <line
          key={index}
          x1={tick.x1}
          y1={tick.y1}
          x2={tick.x2}
          y2={tick.y2}
          stroke="#8f8270"
          strokeWidth={1.15}
        />
      ))}
    </g>
  );
}

function picketTicks(box: { x: number; y: number; w: number; h: number }) {
  const step = 5;
  const len = 3.4;
  const ticks: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let x = box.x + 6; x < box.x + box.w - 4; x += step) {
    ticks.push({ x1: x, y1: box.y, x2: x, y2: box.y + len });
    ticks.push({ x1: x, y1: box.y + box.h, x2: x, y2: box.y + box.h - len });
  }
  for (let y = box.y + 8; y < box.y + box.h - 6; y += step) {
    ticks.push({ x1: box.x, y1: y, x2: box.x + len, y2: y });
    ticks.push({ x1: box.x + box.w, y1: y, x2: box.x + box.w - len, y2: y });
  }
  return ticks;
}
