import type { ReactNode } from "react";

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  action,
}: {
  title: string;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[13px] text-muted-foreground">{eyebrow}</p> : null}
        <h1 className="ui-heading text-[28px] font-semibold tracking-tight">{title}</h1>
        {subtitle ? <div className="mt-1 text-[13px] text-muted-foreground">{subtitle}</div> : null}
      </div>
      {action ? <div className="shrink-0 pt-1">{action}</div> : null}
    </header>
  );
}
