"use client";

import { visitorAnchor, type VisitorKind } from "@/lib/scene/visitor";

/**
 * The day's visitor, if the house has one. Its own layer rather than another
 * scene detail: the details are capped at two and ranked, and the one
 * unpredictable thing on the screen should never lose its slot to a lantern.
 *
 * Placeholders in CSS and inline SVG. Decorative: `aria-hidden`, no pointer
 * events, and still under Reduce Motion through the global animation kill
 * switch.
 */
export function VisitorLayer({ visitor, paused }: { visitor: VisitorKind | null; paused?: boolean }) {
  if (!visitor) return null;
  const { x, y } = visitorAnchor(visitor);
  return (
    <div
      aria-hidden
      className="scene-visitor pointer-events-none absolute inset-0"
      data-paused={paused ? "true" : "false"}
    >
      <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
        <Visitor kind={visitor} />
      </div>
    </div>
  );
}

function Visitor({ kind }: { kind: VisitorKind }) {
  switch (kind) {
    case "birds":
      return (
        <svg viewBox="0 0 40 16" className="visitor-birds h-4 w-10" fill="none" stroke="#4a4038" strokeWidth="1.2">
          <path d="M2 8q3-3 6 0q3-3 6 0" />
          <path d="M20 4q2.5-2.5 5 0q2.5-2.5 5 0" />
          <path d="M26 12q2-2 4 0q2-2 4 0" />
        </svg>
      );
    case "butterfly":
      return (
        <svg viewBox="0 0 16 14" className="visitor-butterfly h-3.5 w-4" fill="none">
          <ellipse cx="5" cy="6" rx="4" ry="5" fill="#e8a05c" opacity="0.9" />
          <ellipse cx="11" cy="6" rx="4" ry="5" fill="#e8a05c" opacity="0.9" />
          <rect x="7.4" y="2" width="1.2" height="10" rx="0.6" fill="#4a4038" />
        </svg>
      );
    case "rainbow":
      return (
        <svg viewBox="0 0 64 34" className="visitor-rainbow h-8 w-16" fill="none" strokeWidth="3">
          <path d="M6 32a26 26 0 0 1 52 0" stroke="#d9705f" opacity="0.7" />
          <path d="M12 32a20 20 0 0 1 40 0" stroke="#e8c06a" opacity="0.7" />
          <path d="M18 32a14 14 0 0 1 28 0" stroke="#7fa87f" opacity="0.7" />
          <path d="M24 32a8 8 0 0 1 16 0" stroke="#7fa8c9" opacity="0.7" />
        </svg>
      );
    case "moth":
      return (
        <svg viewBox="0 0 14 12" className="visitor-moth h-3 w-3.5" fill="#e6ddcb">
          <ellipse cx="4.5" cy="6" rx="3.5" ry="4" opacity="0.85" />
          <ellipse cx="9.5" cy="6" rx="3.5" ry="4" opacity="0.85" />
        </svg>
      );
    case "deer":
      return (
        <svg viewBox="0 0 28 24" className="visitor-deer h-6 w-7" fill="#8a6b4f">
          <path d="M9 23v-7h10v7h-2v-5h-6v5z" />
          <path d="M8 16h12v-4H8z" />
          <path d="M18 12h4v-3h-4z" />
          <path d="M21 9l-2-4M21 9l3-3" stroke="#8a6b4f" strokeWidth="1.2" fill="none" />
        </svg>
      );
  }
}
