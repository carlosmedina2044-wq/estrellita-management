"use client";

import { ChevronRight } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/*
 * Inset-grouped list pieces for Settings, in the order an iPhone reader expects:
 * a small muted header, one or more tonal groups of rows, an optional footnote.
 * Rows are separated by hairlines (`.ui-group-row`), never by cards in cards.
 * Values sit on the right in muted type; only things you can act on are tinted.
 */

/** A header over one or more groups, with an optional footnote underneath. */
export function SettingsSection({
  title,
  footer,
  children,
  className,
}: {
  title?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {title ? (
        <h2 className="mb-1.5 px-4 ui-caption font-medium text-muted-foreground">{title}</h2>
      ) : null}
      <div className="flex flex-col gap-3">{children}</div>
      {footer ? <div className="mt-1.5 px-4 ui-caption text-muted-foreground">{footer}</div> : null}
    </section>
  );
}

export function SettingsGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("ui-group", className)}>{children}</div>;
}

/** A free-form row: use for chips, helper text or anything that is not label + value. */
export function SettingsRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("ui-group-row px-4 py-3", className)}>{children}</div>;
}

export function RowText({ title, help }: { title: ReactNode; help?: ReactNode }) {
  return (
    <span className="min-w-0">
      <span className="block ui-body font-medium">{title}</span>
      {help ? <span className="mt-0.5 block ui-caption text-muted-foreground">{help}</span> : null}
    </span>
  );
}

export function ToggleRow({
  title,
  help,
  checked,
  disabled,
  onCheckedChange,
  ariaLabel,
}: {
  title: ReactNode;
  help?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (next: boolean) => void;
  ariaLabel?: string;
}) {
  const id = useId();
  return (
    <div className="ui-group-row flex items-center justify-between gap-3 px-4 py-3">
      <span id={id} className="min-w-0 flex-1">
        <span className="block ui-body font-medium">{title}</span>
        {help ? <span className="mt-0.5 block ui-caption text-muted-foreground">{help}</span> : null}
      </span>
      <Switch
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : id}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

/** A row that opens something: label on the left, value and chevron on the right. */
export function NavRow({
  title,
  help,
  value,
  onClick,
  href,
  tone = "default",
  chevron = true,
}: {
  title: ReactNode;
  help?: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: "default" | "destructive";
  chevron?: boolean;
}) {
  const className = cn(
    "ui-group-row flex w-full min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 text-left active:bg-foreground/6",
    tone === "destructive" && "text-destructive",
  );
  const inner = (
    <>
      <RowText title={title} help={help} />
      <span className="ml-auto flex min-w-0 max-w-full items-center gap-1.5 ui-body text-muted-foreground">
        {value ? <span className="min-w-0 max-w-[14rem] break-words">{value}</span> : null}
        {chevron ? <ChevronRight className="size-4" aria-hidden /> : null}
      </span>
    </>
  );
  if (href) {
    return (
      <a className={className} href={href}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {inner}
    </button>
  );
}

/** Label on the left, the current choice on the right; the system picker opens on tap. */
export function SelectRow({
  label,
  value,
  onValueChange,
  display,
  children,
}: {
  label: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  display: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="ui-group-row flex flex-wrap items-center justify-between gap-x-3 px-4 py-1.5">
      <span className="min-w-0 max-w-full py-1 ui-body font-medium">{label}</span>
      <div className="ml-auto min-w-0 max-w-full">
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger
            className="min-h-11 w-full justify-end whitespace-normal text-right data-[size=default]:h-auto bg-transparent px-0 ui-body text-muted-foreground dark:bg-transparent"
            aria-label={typeof label === "string" ? label : undefined}
          >
            <SelectValue placeholder={display}>{display}</SelectValue>
          </SelectTrigger>
          {children}
        </Select>
      </div>
    </div>
  );
}

/** Label on the left, a plain editable value on the right. No outline, no fill. */
export function TextRow({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="ui-group-row flex flex-wrap items-center gap-x-3 px-4 py-1">
      <span className="max-w-full py-1 ui-body font-medium">{label}</span>
      <span className="min-w-0 flex-1 basis-32">{children}</span>
    </label>
  );
}

/** Class for an input that sits inline in a row. */
export const INLINE_INPUT = "h-11 bg-transparent px-0 text-right ui-body dark:bg-transparent";
