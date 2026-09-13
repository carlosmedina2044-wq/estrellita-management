"use client";

import { tActive } from "@/i18n";

function captionFor(fraction: number, runwayDays: number | null): string {
  const pct = Math.round(fraction * 100);
  if (runwayDays === 0) return tActive("supply.outNearly");
  if (runwayDays != null && runwayDays <= 7) return tActive("supply.runsOutWeek", { pct });
  if (fraction >= 0.95 && runwayDays != null) return tActive("supply.fullDays", { days: runwayDays });
  if (runwayDays != null) return tActive("supply.pctDays", { pct, days: runwayDays });
  return tActive("supply.pctOnly", { pct });
}

export function SupplyGauge({
  fraction,
  runwayDays,
  onTap,
}: {
  fraction: number | null;
  runwayDays: number | null;
  onTap?: () => void;
}) {
  if (fraction == null) return null;
  const caption = captionFor(fraction, runwayDays);
  const fill = `${Math.min(100, Math.max(0, fraction * 100))}%`;
  const urgent: "out" | "soon" | null =
    runwayDays === 0 || fraction <= 0.05 ? "out" : runwayDays != null && runwayDays <= 14 ? "soon" : null;
  const fillClass =
    urgent === "out" ? "bg-destructive" : urgent === "soon" ? "bg-warning" : "bg-foreground/20";
  const body = (
    <>
      <span className="relative block h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <span className={`block h-full rounded-full ${fillClass}`} style={{ width: fill }} />
        {urgent ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,rgb(0_0_0/18%)_3px,rgb(0_0_0/18%)_5px)]"
          />
        ) : null}
      </span>
      <span className="mt-1 block ui-caption text-muted-foreground">{caption}</span>
    </>
  );
  if (!onTap) {
    return <div aria-label={caption}>{body}</div>;
  }
  return (
    <button type="button" className="w-full text-left" aria-label={caption} onClick={onTap}>
      {body}
    </button>
  );
}
