import { cn } from "@/lib/utils";

export function WeekRing({
  done,
  planned,
  className,
}: {
  done: number;
  planned: number;
  className?: string;
}) {
  const size = 44;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = planned <= 0 ? 0 : Math.min(1, done / planned);
  const dash = circumference * progress;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      className={cn("size-11 shrink-0", className)}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className="stroke-border"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className="stroke-success"
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="num fill-foreground"
        fontSize="12"
        fontWeight="600"
      >
        {done}
      </text>
    </svg>
  );
}
