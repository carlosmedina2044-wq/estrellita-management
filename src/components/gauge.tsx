"use client";

import { tActive } from "@/i18n";
import { cn } from "@/lib/utils";

export type GaugeSegment = {
  /** 0–1 share of the track. */
  fraction: number;
  /** solid = have, hatched = on the way, empty = need (drawn as remaining track). */
  kind: "have" | "on_the_way" | "need";
};

function captionFor(fraction: number, runwayDays: number | null): string {
  const pct = Math.round(fraction * 100);
  if (runwayDays === 0) return tActive("supply.outNearly");
  if (runwayDays != null && runwayDays <= 7) return tActive("supply.runsOutWeek", { pct });
  if (fraction >= 0.95 && runwayDays != null) return tActive("supply.fullDays", { days: runwayDays });
  if (runwayDays != null) return tActive("supply.pctDays", { pct, days: runwayDays });
  return tActive("supply.pctOnly", { pct });
}

/**
 * Shared supply / fund gauge.
 * solid = have, hatched = on the way, empty = need.
 */
export function Gauge({
  fraction,
  runwayDays,
  onTheWayFraction = 0,
  onTap,
  className,
  showCaption = true,
  "aria-label": ariaLabel,
}: {
  fraction: number | null;
  runwayDays?: number | null;
  /** Optional share already ordered / in transit (drawn hatched after solid). */
  onTheWayFraction?: number;
  onTap?: () => void;
  className?: string;
  showCaption?: boolean;
  "aria-label"?: string;
}) {
  if (fraction == null) return null;
  const have = Math.min(1, Math.max(0, fraction));
  const transit = Math.min(1 - have, Math.max(0, onTheWayFraction));
  const caption = showCaption ? captionFor(have, runwayDays ?? null) : null;
  const label = ariaLabel ?? caption ?? undefined;
  const urgent: "out" | "soon" | null =
    runwayDays === 0 || have <= 0.05 ? "out" : runwayDays != null && runwayDays <= 14 ? "soon" : null;
  const haveClass =
    urgent === "out" ? "bg-overdue" : urgent === "soon" ? "bg-soon" : "bg-foreground/25";

  const body = (
    <>
      <span className={cn("relative block h-2.5 w-full overflow-hidden rounded-full bg-secondary", className)}>
        <span className={cn("absolute inset-y-0 left-0 rounded-full", haveClass)} style={{ width: `${have * 100}%` }} />
        {transit > 0 ? (
          <span
            className="absolute inset-y-0 rounded-full bg-signal/70"
            style={{
              left: `${have * 100}%`,
              width: `${transit * 100}%`,
              backgroundImage:
                "repeating-linear-gradient(-45deg,transparent,transparent 3px,rgb(0_0_0/18%)_3px,rgb(0_0_0/18%)_5px)",
            }}
            aria-hidden
          />
        ) : null}
        {urgent && transit <= 0 ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,rgb(0_0_0/18%)_3px,rgb(0_0_0/18%)_5px)]"
          />
        ) : null}
      </span>
      {caption ? <span className="mt-1 block ui-caption tabular-nums text-muted-foreground">{caption}</span> : null}
    </>
  );

  if (!onTap) {
    return <div aria-label={label}>{body}</div>;
  }
  return (
    <button type="button" className="w-full text-left" aria-label={label} onClick={onTap}>
      {body}
    </button>
  );
}

/** @deprecated Prefer Gauge — kept as a thin alias for existing call sites. */
export function SupplyGauge(props: {
  fraction: number | null;
  runwayDays: number | null;
  onTap?: () => void;
}) {
  return <Gauge {...props} />;
}
