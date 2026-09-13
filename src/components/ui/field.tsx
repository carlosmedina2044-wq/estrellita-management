"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectTrigger } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function isControl(element: ReactElement): boolean {
  return element.type === Input || element.type === Textarea || element.type === SelectTrigger;
}

function withId(element: ReactElement, id: string): ReactElement {
  const props = element.props as { id?: string };
  return cloneElement(element, { id: props.id ?? id } as never);
}

/** Walk wrappers / Select trees and put `id` on the first real control. */
function bindControlId(element: ReactElement, id: string): ReactElement {
  if (isControl(element)) return withId(element, id);

  const props = element.props as { children?: ReactNode };
  if (props.children == null) {
    // Custom field components may forward `id` (e.g. SavedRetailerField later).
    return withId(element, id);
  }

  let changed = false;
  const next = Children.map(props.children, (child) => {
    if (changed || !isValidElement(child)) return child;
    if (isControl(child as ReactElement)) {
      changed = true;
      return withId(child as ReactElement, id);
    }
    const bound = bindControlId(child as ReactElement, id);
    if (bound !== child) {
      changed = true;
      return bound;
    }
    return child;
  });

  if (changed) return cloneElement(element, undefined, next);
  return withId(element, id);
}

/** Label + control with a stable `htmlFor`/`id` pair from `useId()`. */
export function Field({
  label,
  children,
  className,
  labelClassName,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
}) {
  const id = useId();
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className={labelClassName ?? "text-xs font-medium text-muted-foreground"}>
        {label}
      </Label>
      {Children.map(children, (child, index) => {
        if (index > 0 || !isValidElement(child)) return child;
        return bindControlId(child as ReactElement, id);
      })}
    </div>
  );
}
