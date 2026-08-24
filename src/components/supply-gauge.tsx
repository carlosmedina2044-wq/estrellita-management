"use client";

function captionFor(fraction: number, runwayDays: number | null): string {
  const pct = Math.round(fraction * 100);
  if (runwayDays === 0) return "Out or nearly out";
  if (runwayDays != null && runwayDays <= 7) return `~${pct}% · runs out this week`;
  if (runwayDays != null) return `~${pct}% · about ${runwayDays} days`;
  return `~${pct}%`;
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
  const body = (
    <>
      <span className="block h-1 w-full overflow-hidden rounded-full bg-secondary">
        <span className="block h-full rounded-full bg-primary" style={{ width: fill }} />
      </span>
      <span className="mt-1 block text-[13px] text-muted-foreground">{caption}</span>
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
