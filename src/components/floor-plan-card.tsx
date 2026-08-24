"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ArrowLeft } from "lucide-react";
import { FloorPlan, FloorSwitcher, type RoomWork } from "@/components/floor-plan";
import { Badge } from "@/components/ui/badge";
import { FLOOR_LAYOUTS, roomLayoutBounds } from "@/lib/floor-layouts";
import { FLOORS, roomDef } from "@/lib/house";
import type { Floor, Room } from "@/lib/types";
import { cn } from "@/lib/utils";

const ENLARGE_MS = 180;
const REVEAL_MS = 150;

type Mode = "idle" | "prelift" | "lifted" | "detail";
type Origin = { dx: number; dy: number; sx: number; sy: number };

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function originFromRoom(
  svg: SVGSVGElement | null,
  card: HTMLElement | null,
  floor: Floor,
  roomId: Room | null,
): Origin {
  const fallback = { dx: 0, dy: 24, sx: 0.28, sy: 0.22 };
  if (!svg || !card || !roomId) return fallback;
  const layout = FLOOR_LAYOUTS[floor].rooms.find((room) => room.id === roomId);
  if (!layout) return fallback;
  const box = roomLayoutBounds(layout);
  const ctm = svg.getScreenCTM();
  if (!ctm) return fallback;
  const a = new DOMPoint(box.x, box.y).matrixTransform(ctm);
  const b = new DOMPoint(box.x + box.w, box.y + box.h).matrixTransform(ctm);
  const room = {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
  const cardBox = card.getBoundingClientRect();
  if (cardBox.width < 8 || cardBox.height < 8 || room.width < 4 || room.height < 4) return fallback;
  return {
    dx: room.left + room.width / 2 - (cardBox.left + cardBox.width / 2),
    dy: room.top + room.height / 2 - (cardBox.top + cardBox.height / 2),
    sx: Math.max(0.12, room.width / cardBox.width),
    sy: Math.max(0.12, room.height / cardBox.height),
  };
}

export function FloorPlanCard({
  floor,
  selectedId,
  work,
  flipped,
  onSelectFloor,
  onSelectRoom,
  onBackToMap,
  children,
  footer,
}: {
  floor: Floor;
  selectedId: Room | null;
  work: Partial<Record<Room, RoomWork>>;
  flipped: boolean;
  onSelectFloor: (floor: Floor) => void;
  onSelectRoom: (room: Room) => void;
  onBackToMap: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const directionRef = useRef<"in" | "out">("in");
  const wasOpen = useRef(false);
  const modeRef = useRef<Mode>("idle");
  const runId = useRef(0);
  const titleId = useId();

  const [mode, setMode] = useState<Mode>("idle");
  const [animate, setAnimate] = useState(false);
  const [origin, setOrigin] = useState<Origin>({ dx: 0, dy: 0, sx: 0.3, sy: 0.24 });

  modeRef.current = mode;

  const selected = selectedId ? roomDef(selectedId) : null;
  const status = selectedId ? work[selectedId] : undefined;
  const openCount = status?.open ?? 0;
  const overdueCount = status?.overdue ?? 0;
  const floorLabel = FLOORS.find((item) => item.id === (selected?.floor ?? floor))?.label ?? "";
  const overlayOpen = mode !== "idle";
  const lifted = mode === "lifted" || mode === "detail";
  const revealed = mode === "detail";

  useEffect(() => {
    if (flipped === wasOpen.current) return;
    wasOpen.current = flipped;
    const id = ++runId.current;
    const reduced = prefersReducedMotion();
    let enlargeTimer = 0;
    let revealTimer = 0;

    if (flipped) {
      directionRef.current = "in";
      setOrigin(originFromRoom(svgRef.current, sceneRef.current, floor, selectedId));
      if (reduced) {
        setAnimate(false);
        setMode("detail");
      } else {
        setAnimate(false);
        setMode("prelift");
        enlargeTimer = window.setTimeout(() => {
          if (runId.current === id) setMode("detail");
        }, ENLARGE_MS);
      }
    } else if (reduced || modeRef.current === "idle") {
      setAnimate(false);
      setMode("idle");
    } else {
      directionRef.current = "out";
      setOrigin(originFromRoom(svgRef.current, sceneRef.current, floor, selectedId));
      if (modeRef.current === "detail") {
        setMode("lifted");
        revealTimer = window.setTimeout(() => {
          if (runId.current !== id) return;
          setMode("prelift");
          enlargeTimer = window.setTimeout(() => {
            if (runId.current === id) {
              setAnimate(false);
              setMode("idle");
            }
          }, ENLARGE_MS);
        }, REVEAL_MS);
      } else {
        setMode("prelift");
        enlargeTimer = window.setTimeout(() => {
          if (runId.current === id) {
            setAnimate(false);
            setMode("idle");
          }
        }, ENLARGE_MS);
      }
    }

    return () => {
      window.clearTimeout(enlargeTimer);
      window.clearTimeout(revealTimer);
    };
  }, [flipped, floor, selectedId]);

  useLayoutEffect(() => {
    if (mode !== "prelift" || directionRef.current !== "in") return;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimate(true);
        setMode("lifted");
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  useEffect(() => {
    if (!revealed) return;
    const frame = requestAnimationFrame(() =>
      backButtonRef.current?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [revealed, selectedId]);

  useEffect(() => {
    if (!overlayOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onBackToMap();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlayOpen, onBackToMap]);

  const heroStyle = {
    "--hero-dx": `${origin.dx}px`,
    "--hero-dy": `${origin.dy}px`,
    "--hero-sx": String(origin.sx),
    "--hero-sy": String(origin.sy),
  } as CSSProperties;

  function handleSelectFloor(nextFloor: Floor) {
    if (overlayOpen) onBackToMap();
    onSelectFloor(nextFloor);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-black/8 bg-white">
      <FloorSwitcher floor={floor} onSelectFloor={handleSelectFloor} />
      <div ref={sceneRef} className="room-hero-scene">
      <div aria-hidden={overlayOpen} inert={overlayOpen || undefined}>
        <FloorPlan
          floor={floor}
          selectedId={selectedId}
          work={work}
          onSelectRoom={onSelectRoom}
          svgRef={svgRef}
          dimmed={overlayOpen}
        />
      </div>

      {overlayOpen ? (
        <div className="room-hero-layer">
          <div
            className={cn("room-hero", animate && "is-animated", lifted && "is-lifted")}
            style={heroStyle}
          >
            <section className="room-hero-panel" aria-labelledby={titleId}>
              <header className="shrink-0 border-b border-black/6 px-4 pt-3 pb-3">
                <button
                  ref={backButtonRef}
                  type="button"
                  onClick={onBackToMap}
                  className="inline-flex h-8 items-center gap-1 text-[15px] font-medium text-primary"
                >
                  <ArrowLeft className="size-4" />
                  Map
                </button>
                <h2
                  id={titleId}
                  className="ui-heading mt-1 text-[28px] font-semibold leading-none"
                  style={{
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
                    fontFeatureSettings: '"liga" 0, "clig" 0, "dlig" 0, "calt" 0',
                    fontVariantLigatures: "none",
                    letterSpacing: "-0.022em",
                  }}
                >
                  {selected?.label ?? "Room"}
                </h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {floorLabel}
                  {openCount > 0 ? ` · ${openCount} open` : " · all clear"}
                  {overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {overdueCount > 0 ? (
                    <Badge variant="destructive" className="rounded-full">
                      {overdueCount} overdue
                    </Badge>
                  ) : null}
                  {openCount > 0 ? (
                    <Badge variant="secondary" className="rounded-full">
                      {openCount} open
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="rounded-full">
                      Clear
                    </Badge>
                  )}
                </div>
              </header>
              <div className={cn("room-hero-tasks", revealed && "is-revealed")}>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">{children}</div>
                {footer ? <div className="shrink-0 border-t border-border/80 p-3">{footer}</div> : null}
              </div>
            </section>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
