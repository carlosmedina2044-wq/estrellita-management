"use client";

import type { CareDecor } from "@/lib/scene/care-decor";

/**
 * What the house has earned, standing on it all day. Separate from
 * `SceneDetails`: those come and go with the weather, the hour and the rooms,
 * and only two show at once. These are permanent — once a care level is
 * reached its decoration stays, and losing a level takes it away again. That
 * is the whole point of the layer: a "Settling in" house and a "Loved" house
 * had looked identical at noon.
 *
 * CSS and inline SVG placeholders shaped to the anchors the real art will use
 * (see `docs/SCENE_DETAILS_BRIEF.md`); swapping in the art means replacing a
 * `case` here. Purely decorative: `aria-hidden`, no pointer events, no
 * animation, so nothing here competes with the living details beside it.
 */
export function CareDecorLayer({ decor }: { decor: CareDecor[] }) {
  if (decor.length === 0) return null;
  return (
    <div aria-hidden className="care-decor pointer-events-none absolute inset-0">
      {decor.map((item) => (
        <div
          key={item.kind}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${item.x}%`, top: `${item.y}%` }}
        >
          <Decor kind={item.kind} />
        </div>
      ))}
    </div>
  );
}

function Decor({ kind }: { kind: CareDecor["kind"] }) {
  switch (kind) {
    case "planter":
      return (
        <svg viewBox="0 0 16 20" className="h-5 w-4" fill="none">
          <path d="M4 10h8l-1 8H5z" fill="#b98b62" />
          <circle cx="8" cy="6" r="4" fill="#6f9e5e" />
          <circle cx="5" cy="8" r="2.4" fill="#83b06f" />
          <circle cx="11" cy="8" r="2.4" fill="#83b06f" />
        </svg>
      );
    case "window-box":
      return (
        <svg viewBox="0 0 28 10" className="h-2.5 w-7" fill="none">
          <path d="M2 4h24l-1.5 5h-21z" fill="#8a6b4f" />
          <circle cx="6" cy="3" r="2" fill="#d98b9a" />
          <circle cx="11" cy="2.5" r="2" fill="#e8c06a" />
          <circle cx="16" cy="3" r="2" fill="#d98b9a" />
          <circle cx="21" cy="2.5" r="2" fill="#e8c06a" />
        </svg>
      );
    case "bench":
      return (
        <svg viewBox="0 0 24 14" className="h-3.5 w-6" fill="none">
          <rect x="2" y="6" width="20" height="2.2" rx="1" fill="#9c7550" />
          <rect x="2" y="2" width="20" height="1.8" rx="0.9" fill="#9c7550" />
          <rect x="3" y="8" width="1.8" height="5" fill="#7d5c3e" />
          <rect x="19" y="8" width="1.8" height="5" fill="#7d5c3e" />
        </svg>
      );
    case "wreath":
      return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
          <circle cx="8" cy="8" r="5.5" stroke="#5f8a52" strokeWidth="2.6" />
          <circle cx="8" cy="2.6" r="1.5" fill="#c4574f" />
        </svg>
      );
  }
}
