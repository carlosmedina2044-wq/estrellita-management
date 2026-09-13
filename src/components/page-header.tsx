import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  action,
  onBack,
  backLabel = "Back",
}: {
  title: string;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-1">
        {onBack ? (
          <button
            type="button"
            aria-label={backLabel}
            onClick={onBack}
            className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full text-foreground"
          >
            <ChevronLeft className="size-6" />
          </button>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? <p className="ui-caption text-muted-foreground">{eyebrow}</p> : null}
          <h1 className="ui-heading ui-display font-semibold tracking-tight">{title}</h1>
          {subtitle ? <div className="mt-1 ui-caption text-muted-foreground">{subtitle}</div> : null}
        </div>
      </div>
      <div className="flex size-11 shrink-0 items-center justify-center">{action ?? null}</div>
    </header>
  );
}
