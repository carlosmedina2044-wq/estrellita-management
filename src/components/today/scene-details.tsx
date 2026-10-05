"use client";

import { useId } from "react";
import type { SceneDetail } from "@/lib/scene/details";

/**
 * The small living details on the house, positioned on the stack's box.
 * These are CSS and inline-SVG placeholders shaped to the anchors and the
 * timing the real Lottie moments will use (see docs/SCENE_DETAILS_BRIEF.md);
 * swapping in the art means replacing a `case` here, nothing else. Purely
 * decorative: `aria-hidden`, no pointer events, paused while the compact bar
 * is up so scrolling stays smooth, still under Reduce Motion through the
 * global animation kill switch.
 */
export function SceneDetails({
  details,
  paused,
  asleep,
  night,
  wind = 0,
}: {
  details: SceneDetail[];
  paused?: boolean;
  asleep?: boolean;
  /** The sky is dark: smoke takes its cool, moonlit tint. */
  night?: boolean;
  /** 0-1 from the day's forecast. The laundry and the sprinkler read it, so a
   * blustery day looks like one instead of everything swaying on the same
   * fixed period whatever the weather line above it says. */
  wind?: number;
}) {
  if (details.length === 0) return null;
  return (
    <div
      aria-hidden
      className="scene-details pointer-events-none absolute inset-0"
      data-paused={paused ? "true" : "false"}
      style={
        {
          // Still air takes its time; a gale hurries. The angle widens with the
          // wind too, so a breezy day is visibly different from a calm one
          // rather than merely faster.
          "--sway-seconds": `${(5.2 - wind * 3).toFixed(2)}s`,
          "--sway-angle": `${(1.5 + wind * 6).toFixed(1)}deg`,
        } as React.CSSProperties
      }
    >
      {details.map((detail) => (
        <div
          key={detail.kind}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${detail.x}%`, top: `${detail.y}%` }}
        >
          <Detail kind={detail.kind} asleep={asleep} night={night} />
        </div>
      ))}
    </div>
  );
}

/**
 * The porch light. What reads as "someone is home" is the light a lamp throws,
 * not the lamp: the fitting is drawn about the size of the door handle it hangs
 * beside, and the wash falling down the wall below it does the work. It fades
 * up once when it comes on, then only flickers — a light that breathes 15%
 * wider every three seconds is the one thing a real one never does.
 */
function PorchLight() {
  const id = useId();
  return (
    // `overflow-visible` lets the wash fall past the box to the step without
    // moving the lamp off the anchor, which is the door head.
    <svg viewBox="0 0 26 26" className="detail-lantern block size-[26px] overflow-visible" fill="none">
      <defs>
        <radialGradient id={`${id}-bloom`}>
          <stop offset="0%" stopColor="#ffe3b0" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#ffb457" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#ff9c3a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-cone`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffc472" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#ffb457" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ff9c3a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="detail-lantern-glow">
        {/* The wash down the wall — a light has a direction; a blob does not. */}
        <path d="M10.9 12.3 H15.1 L21.2 31 H4.8 Z" fill={`url(#${id}-cone)`} />
        <circle cx="13" cy="12.2" r="7.6" fill={`url(#${id}-bloom)`} />
        <circle cx="13" cy="12.1" r="1.15" fill="#ffeccb" />
      </g>
      {/* The fitting itself, read as a silhouette against its own light. */}
      <path d="M13 7.6 V9" stroke="#2f2a25" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M10.7 12.3 L13 8.8 L15.3 12.3 Z" fill="#2f2a25" />
    </svg>
  );
}

const SMOKE_FRAMES = 36;

/**
 * A rendered loop played from a horizontal sprite strip: one image, N frames
 * side by side, stepped with CSS so it pauses and stills with every other
 * detail through the shared animation rules. Frame 0 is the still shown under
 * Reduce Motion.
 */
function SpriteLoop({
  src,
  frames,
  frameWidth,
  frameHeight,
  seconds,
  anchor = "center",
}: {
  src: string;
  frames: number;
  frameWidth: number;
  frameHeight: number;
  seconds: number;
  anchor?: "center" | "bottom";
}) {
  return (
    <span
      className="sprite-loop block"
      style={
        {
          width: frameWidth,
          height: frameHeight,
          marginTop: anchor === "bottom" ? -frameHeight / 2 : 0,
          backgroundImage: `url(${src})`,
          "--sprite-frames": frames,
          "--sprite-width": `${frameWidth}px`,
          "--sprite-seconds": `${seconds}s`,
        } as React.CSSProperties
      }
    />
  );
}

function Detail({ kind, asleep, night }: { kind: SceneDetail["kind"]; asleep?: boolean; night?: boolean }) {
  switch (kind) {
    case "lantern":
      return <PorchLight />;
    case "smoke":
      return (
        <SpriteLoop
          src={night ? "/fx/smoke-night.webp" : "/fx/smoke-day.webp"}
          frames={SMOKE_FRAMES}
          frameWidth={42}
          frameHeight={84}
          seconds={3.6}
          // The sprite's base sits on the chimney top, not its middle.
          anchor="bottom"
        />
      );
    case "string-lights":
      return (
        <span className="relative block h-2 w-24">
          <span className="absolute inset-x-0 top-1/2 h-px bg-black/30" />
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <span
              key={index}
              className="detail-bulb absolute top-1/2 block size-1.5 -translate-y-1/2 rounded-full"
              style={{ left: `${index * 20}%`, animationDelay: `${(index % 3) * 0.7}s` }}
            />
          ))}
        </span>
      );
    case "companion":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asleep ? "/props/cat-asleep.webp" : "/props/cat-awake.webp"}
          alt=""
          draggable={false}
          width={asleep ? 40 : 36}
          height={asleep ? 40 : 36}
          className="detail-cat block max-w-none"
        />
      );
    case "leaves":
      return <SpriteLoop src="/fx/leaves.webp" frames={36} frameWidth={34} frameHeight={45} seconds={7.2} />;
    case "laundry":
      return (
        <svg viewBox="0 0 40 16" className="detail-laundry h-4 w-10" fill="none">
          <line x1="0" y1="3" x2="40" y2="3" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
          <rect x="4" y="3" width="8" height="10" rx="1" fill="#f7f3ec" />
          <rect x="16" y="3" width="7" height="8" rx="1" fill="#d9c6b0" />
          <rect x="27" y="3" width="9" height="11" rx="1" fill="#e8ded2" />
        </svg>
      );
    case "sprinkler":
      return (
        <SpriteLoop
          src="/fx/sprinkler.webp"
          frames={36}
          frameWidth={60}
          frameHeight={36}
          seconds={3.6}
          // The nozzle is the sprite's bottom edge; it stands on the lawn.
          anchor="bottom"
        />
      );
  }
}
