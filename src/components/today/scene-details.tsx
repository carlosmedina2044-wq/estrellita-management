"use client";

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
}: {
  details: SceneDetail[];
  paused?: boolean;
  asleep?: boolean;
}) {
  if (details.length === 0) return null;
  return (
    <div aria-hidden className="scene-details pointer-events-none absolute inset-0" data-paused={paused ? "true" : "false"}>
      {details.map((detail) => (
        <div
          key={detail.kind}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${detail.x}%`, top: `${detail.y}%` }}
        >
          <Detail kind={detail.kind} asleep={asleep} />
        </div>
      ))}
    </div>
  );
}

function Detail({ kind, asleep }: { kind: SceneDetail["kind"]; asleep?: boolean }) {
  switch (kind) {
    case "lantern":
      return <span className="detail-lantern block size-7 rounded-full" />;
    case "smoke":
      return (
        <span className="relative block h-10 w-6">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="detail-puff absolute bottom-0 left-1/2 block size-2.5 rounded-full"
              style={{ animationDelay: `${index * 1.3}s` }}
            />
          ))}
        </span>
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
        <svg viewBox="0 0 24 16" className={asleep ? "detail-cat h-3 w-6" : "detail-cat h-4 w-6"} fill="currentColor">
          {asleep ? (
            <path d="M2 12c0-3 3-5 7-5h6c3 0 6 1.5 6 4v1H2z" />
          ) : (
            <path d="M4 15v-6l-1-5 3 2h4l3-2-1 5v1h4c3 0 5 2 5 4v1H4z" />
          )}
        </svg>
      );
    case "leaves":
      return (
        <span className="relative block h-3 w-10">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className="detail-leaf absolute block h-1.5 w-2.5 rounded-full"
              style={{ left: `${index * 22}%`, top: `${(index % 2) * 40}%`, transform: `rotate(${index * 35 - 20}deg)` }}
            />
          ))}
        </span>
      );
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
        <svg viewBox="0 0 24 12" className="detail-sprinkler h-3 w-6" fill="#9fc5ea">
          {[0, 1, 2, 3, 4].map((index) => {
            const angle = (Math.PI * (index + 1)) / 6;
            return <circle key={index} cx={12 + Math.cos(angle) * 10} cy={11 - Math.sin(angle) * 10} r="1.1" />;
          })}
          <rect x="11" y="9" width="2" height="3" fill="#6b5a48" />
        </svg>
      );
  }
}
